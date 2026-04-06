"""
Android Key Attestation — challenge/response with server-side chain + challenge checks.

POST /attest/android-key/challenge — issue nonce + challenge bytes (base64)
POST /attest/android-key/verify   — { nonce, cert_chain_b64: [DER base64, leaf first] }
  On success, response includes bind_token (JWT) to POST /identity/android-attestation/bind
  with the user's Dynamic JWT — associates leaf SPKI hash with their agent_id.

Uses Google hardware attestation roots (same source as android/keyattestation roots.json):
https://android.googleapis.com/attestation/root

Challenge is embedded in the leaf certificate extension OID 1.3.6.1.4.1.11129.2.1.17
(KeyDescription), field index 4 (ASN.1 SEQUENCE), matching android/keyattestation Extension.kt.
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import threading
import time
from typing import Any

import jwt as pyjwt
import requests
from asn1crypto.core import OctetString, Sequence
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from flask import Blueprint, jsonify, request

android_key_bp = Blueprint("android_key", __name__, url_prefix="/attest/android-key")

GOOGLE_ATTESTATION_ROOTS_URL = "https://android.googleapis.com/attestation/root"
KEY_DESCRIPTION_OID = x509.ObjectIdentifier("1.3.6.1.4.1.11129.2.1.17")

_LOCK = threading.Lock()
# nonce -> (challenge bytes, unix time issued)
_challenges: dict[str, tuple[bytes, float]] = {}
_CHALLENGE_TTL_SEC = 600

# Single-use JWT jti after a successful /verify (bind flow).
_JTI_USED_R: dict[str, float] = {}
_JTI_USED_TTL_SEC = 7200

# agent_id -> [{ spki_sha256_hex, bound_at }, ...]  (in-memory; replace with DB in production)
_agent_spki_by_agent: dict[int, list[dict[str, Any]]] = {}

BIND_TOKEN_TTL_SEC = 600


def _bind_secret() -> str:
    return os.environ.get(
        "BOUNTYNET_ATTEST_BIND_SECRET",
        "dev-bind-secret-change-me-32b-min!!",
    )


def _prune_used_jti() -> None:
    now = time.time()
    dead = [k for k, t in _JTI_USED_R.items() if now - t > _JTI_USED_TTL_SEC]
    for k in dead:
        _JTI_USED_R.pop(k, None)


def issue_attest_bind_token(spki_hex: str) -> str:
    """HS256 JWT proving the gateway verified this attestation (short-lived, for POST .../bind)."""
    now = time.time()
    payload = {
        "spki_sha256_hex": spki_hex,
        "iat": int(now),
        "exp": int(now) + BIND_TOKEN_TTL_SEC,
        "jti": secrets.token_urlsafe(18),
    }
    return pyjwt.encode(payload, _bind_secret(), algorithm="HS256")


def verify_and_consume_bind_token(token: str) -> str | None:
    """
    Validate bind JWT, enforce single-use jti, return spki_sha256_hex, or None.
    """
    try:
        payload = pyjwt.decode(token, _bind_secret(), algorithms=["HS256"])
    except pyjwt.PyJWTError:
        return None
    spki = payload.get("spki_sha256_hex")
    jti = payload.get("jti")
    if not isinstance(spki, str) or not jti:
        return None
    try:
        spki_norm = spki.lower()
        if len(spki_norm) != 64:
            return None
        bytes.fromhex(spki_norm)
    except ValueError:
        return None
    with _LOCK:
        _prune_used_jti()
        if jti in _JTI_USED_R:
            return None
        _JTI_USED_R[jti] = time.time()
    return spki_norm


def record_android_spki_binding(agent_id: int, spki_hex: str) -> None:
    spki_norm = spki_hex.lower()
    with _LOCK:
        rows = _agent_spki_by_agent.setdefault(agent_id, [])
        if not any(r["spki_sha256_hex"] == spki_norm for r in rows):
            rows.append({"spki_sha256_hex": spki_norm, "bound_at": time.time()})


def list_android_spki_bindings(agent_id: int) -> list[dict[str, Any]]:
    with _LOCK:
        return [dict(r) for r in _agent_spki_by_agent.get(agent_id, [])]


def _prune_challenges() -> None:
    now = time.time()
    dead = [k for k, (_, t) in _challenges.items() if now - t > _CHALLENGE_TTL_SEC]
    for k in dead:
        _challenges.pop(k, None)


def _google_roots() -> list[x509.Certificate]:
    r = requests.get(GOOGLE_ATTESTATION_ROOTS_URL, timeout=30)
    r.raise_for_status()
    pem_list: list[str] = json.loads(r.text)
    out: list[x509.Certificate] = []
    for pem in pem_list:
        out.append(x509.load_pem_x509_certificate(pem.encode("utf-8"), default_backend()))
    return out


def _load_chain(cert_chain_b64: list[str]) -> list[x509.Certificate]:
    chain: list[x509.Certificate] = []
    for b64 in cert_chain_b64:
        der = base64.b64decode(b64, validate=True)
        chain.append(x509.load_der_x509_certificate(der, default_backend()))
    return chain


def _verify_chain_signatures(chain: list[x509.Certificate], roots: list[x509.Certificate]) -> bool:
    if len(chain) < 2:
        return False
    for i in range(len(chain) - 1):
        try:
            chain[i].verify_directly_issued_by(chain[i + 1])
        except Exception:
            return False
    root_fp = {c.fingerprint(hashes.SHA256()) for c in roots}
    return chain[-1].fingerprint(hashes.SHA256()) in root_fp


def _extract_attestation_challenge(leaf: x509.Certificate) -> bytes | None:
    try:
        ext = leaf.extensions.get_extension_for_oid(KEY_DESCRIPTION_OID)
    except x509.ExtensionNotFound:
        return None
    val = ext.value
    if not isinstance(val, x509.UnrecognizedExtension):
        return None
    blob: bytes = val.value
    if not blob:
        return None

    def _parse_key_description(der: bytes) -> bytes | None:
        seq = Sequence.load(der)
        if len(seq) < 5:
            return None
        ch = seq[4].native
        if ch is None:
            return None
        return bytes(ch) if isinstance(ch, (bytes, bytearray, memoryview)) else None

    try:
        return _parse_key_description(blob)
    except Exception:
        pass
    try:
        inner = OctetString.load(blob).native
        if isinstance(inner, bytes):
            return _parse_key_description(inner)
    except Exception:
        return None
    return None


@android_key_bp.route("/challenge", methods=["POST"])
def issue_challenge():
    """Return a fresh attestation challenge bound to a nonce (single-use verify)."""
    raw = secrets.token_bytes(32)
    nonce = secrets.token_urlsafe(24)
    with _LOCK:
        _prune_challenges()
        _challenges[nonce] = (raw, time.time())
    return jsonify(
        {
            "nonce": nonce,
            "challenge_b64": base64.b64encode(raw).decode("ascii"),
        }
    )


@android_key_bp.route("/verify", methods=["POST"])
def verify_attestation():
    body: dict[str, Any] = request.json or {}
    nonce = body.get("nonce")
    chain_b64 = body.get("cert_chain_b64")
    if not nonce or not isinstance(chain_b64, list) or not chain_b64:
        return jsonify({"error": "nonce and cert_chain_b64[] required"}), 400

    with _LOCK:
        _prune_challenges()
        entry = _challenges.pop(nonce, None)
    if not entry:
        return jsonify({"error": "unknown or expired nonce"}), 400
    expected_challenge, _ = entry

    try:
        chain = _load_chain([str(x) for x in chain_b64])
        roots = _google_roots()
        if not _verify_chain_signatures(chain, roots):
            return jsonify({"verified": False, "error": "certificate chain failed validation"}), 400
        leaf = chain[0]
        got = _extract_attestation_challenge(leaf)
        if got is None:
            return jsonify({"verified": False, "error": "no key attestation extension on leaf"}), 400
        if got != expected_challenge:
            return jsonify(
                {
                    "verified": False,
                    "error": "attestation challenge mismatch",
                    "challenge_ok": False,
                }
            ), 400
        leaf_spki = leaf.public_key().public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        spki_hash = hashes.Hash(hashes.SHA256())
        spki_hash.update(leaf_spki)
        digest = spki_hash.finalize().hex().lower()
        bind_token = issue_attest_bind_token(digest)
        return jsonify(
            {
                "verified": True,
                "challenge_ok": True,
                "leaf_spki_sha256_hex": digest,
                "bind_token": bind_token,
                "bind_expires_in": BIND_TOKEN_TTL_SEC,
            }
        )
    except Exception as e:
        return jsonify({"verified": False, "error": str(e)}), 400
