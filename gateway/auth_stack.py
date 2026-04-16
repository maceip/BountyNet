from __future__ import annotations

import hashlib
import json
import os
import secrets
import time
import urllib.request
import uuid
from typing import Any

from flask import Blueprint, jsonify, request

from gateway import store

try:
    from eth_account import Account
    from eth_account.messages import encode_defunct
except Exception:  # pragma: no cover - optional at runtime
    Account = None  # type: ignore[assignment]
    encode_defunct = None  # type: ignore[assignment]


auth_stack_bp = Blueprint("auth_stack", __name__)

_SESSION_TTL_SECONDS = int(os.getenv("BOUNTYNET_AUTH_SESSION_TTL_SECONDS", "604800"))
_CHALLENGE_TTL_SECONDS = int(os.getenv("BOUNTYNET_AUTH_CHALLENGE_TTL_SECONDS", "300"))
_MAGIC_LINK_TTL_SECONDS = int(os.getenv("BOUNTYNET_MAGIC_LINK_TTL_SECONDS", "900"))
_MAGIC_LINK_DEV_ECHO = os.getenv("BOUNTYNET_DEV_MAGIC_LINK_ECHO", "1").lower() in {"1", "true", "yes"}
_AUTH_BOOTSTRAP_SECRET = (os.getenv("BOUNTYNET_AUTH_BOOTSTRAP_SECRET") or "").strip()
_AUTH_DEV_FACTOR_SECRET = (os.getenv("BOUNTYNET_AUTH_DEV_FACTOR_SECRET") or "").strip()


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _random_token(prefix: str) -> str:
    return f"{prefix}{secrets.token_urlsafe(32)}"


def _now() -> float:
    return time.time()


def _request_ip_hash() -> str:
    return _sha256((request.headers.get("X-Forwarded-For") or request.remote_addr or "").strip())


def _request_ua_hash() -> str:
    return _sha256((request.headers.get("User-Agent") or "").strip())


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _normalize_eth(address: str) -> str:
    return (address or "").strip().lower()


def _normalize_generic(value: str) -> str:
    return (value or "").strip().lower()


def _factor_adapter_url(factor_type: str) -> str:
    mapping = {
        "passkey": "BOUNTYNET_AUTH_PASSKEY_VERIFY_URL",
        "wallet_eth": "BOUNTYNET_AUTH_ETH_VERIFY_URL",
        "wallet_sol": "BOUNTYNET_AUTH_SOL_VERIFY_URL",
        "wallet_btc": "BOUNTYNET_AUTH_BTC_VERIFY_URL",
        "nfc_euid": "BOUNTYNET_AUTH_NFC_VERIFY_URL",
    }
    env_key = mapping.get(factor_type, "")
    if not env_key:
        return ""
    return (os.getenv(env_key) or "").strip()


def _identifier_kind_for_factor(factor_type: str) -> str:
    return {
        "wallet_eth": "eth",
        "wallet_sol": "sol",
        "wallet_btc": "btc",
        "passkey": "passkey_handle",
        "nfc_euid": "euid",
    }.get(factor_type, factor_type)


def _default_aal_for_factor(factor_type: str) -> int:
    if factor_type == "nfc_euid":
        return 3
    if factor_type in {"wallet_eth", "wallet_sol", "wallet_btc", "passkey"}:
        return 2
    return 1


def _factor_message(factor_type: str, challenge_id: str, nonce: str, identifier: str) -> str:
    domain = (os.getenv("BOUNTYNET_AUTH_DOMAIN") or "bountynet.local").strip()
    return (
        "BountyNet Sign-In\n"
        f"Domain: {domain}\n"
        f"Factor: {factor_type}\n"
        f"Challenge: {challenge_id}\n"
        f"Nonce: {nonce}\n"
        f"Identifier: {identifier}\n"
    )


def _dev_factor_proof_expected(
    factor_type: str,
    challenge_id: str,
    nonce: str,
    identifier: str,
) -> str:
    payload = f"{_AUTH_DEV_FACTOR_SECRET}:{factor_type}:{challenge_id}:{nonce}:{identifier}"
    return _sha256(payload)


def _verify_with_http_adapter(
    factor_type: str,
    challenge: dict[str, Any],
    body: dict[str, Any],
) -> dict[str, Any]:
    url = _factor_adapter_url(factor_type)
    if not url:
        return {"ok": False, "error": "adapter_unconfigured"}
    req_body = {
        "factor_type": factor_type,
        "challenge_id": challenge.get("id", ""),
        "nonce": challenge.get("nonce", ""),
        "challenge_payload": challenge.get("payload", {}),
        "request_payload": body,
    }
    encoded = json.dumps(req_body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:  # nosec - controlled destination via env
            raw = resp.read().decode("utf-8")
            payload = json.loads(raw) if raw else {}
            return {
                "ok": bool(payload.get("ok")),
                "identifier_value": _normalize_generic(payload.get("identifier") or ""),
                "aal": int(payload.get("aal") or _default_aal_for_factor(factor_type)),
                "metadata": payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {},
                "error": payload.get("error") or "",
            }
    except Exception as exc:
        return {"ok": False, "error": f"adapter_request_failed:{exc}"}


def _verify_factor_generic(
    factor_type: str,
    challenge: dict[str, Any],
    body: dict[str, Any],
) -> dict[str, Any]:
    identifier_raw = (
        body.get("identifier")
        if body.get("identifier") is not None
        else body.get("address")
    )
    identifier = _normalize_generic(identifier_raw or "")
    proof = (body.get("proof") or "").strip()
    if not identifier:
        return {"ok": False, "error": "identifier required"}
    if not proof:
        return {"ok": False, "error": "proof required"}
    if _AUTH_DEV_FACTOR_SECRET:
        expected = _dev_factor_proof_expected(
            factor_type=factor_type,
            challenge_id=challenge["id"],
            nonce=challenge["nonce"],
            identifier=identifier,
        )
        if proof != expected:
            return {"ok": False, "error": "invalid proof"}
        return {
            "ok": True,
            "identifier_value": identifier,
            "aal": _default_aal_for_factor(factor_type),
            "metadata": {"verification_mode": "dev_secret"},
        }
    adapter_result = _verify_with_http_adapter(factor_type=factor_type, challenge=challenge, body=body)
    if not adapter_result.get("ok"):
        return {
            "ok": False,
            "error": adapter_result.get("error") or "verification failed",
        }
    if not adapter_result.get("identifier_value"):
        return {"ok": False, "error": "adapter missing identifier"}
    return {
        "ok": True,
        "identifier_value": adapter_result["identifier_value"],
        "aal": int(adapter_result.get("aal") or _default_aal_for_factor(factor_type)),
        "metadata": adapter_result.get("metadata") if isinstance(adapter_result.get("metadata"), dict) else {},
    }


def _factor_mode(factor_type: str) -> str:
    if factor_type == "wallet_eth" and Account is not None and encode_defunct is not None:
        return "native"
    if _AUTH_DEV_FACTOR_SECRET:
        return "dev_secret"
    if _factor_adapter_url(factor_type):
        return "adapter"
    return "unconfigured"


def _load_active_challenge(challenge_id: str, factor_type: str) -> tuple[dict[str, Any] | None, tuple[dict[str, Any], int] | None]:
    challenge = store.auth_challenge_get(challenge_id)
    if not challenge:
        return None, ({"error": "challenge not found"}, 404)
    if challenge.get("factor_type") != factor_type:
        return None, ({"error": "challenge factor mismatch"}, 400)
    if float(challenge.get("consumed_at") or 0) > 0:
        return None, ({"error": "challenge already consumed"}, 400)
    if float(challenge.get("expires_at") or 0) <= _now():
        return None, ({"error": "challenge expired"}, 400)
    return challenge, None


def _extract_session_token() -> str:
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.startswith("Bearer bna_"):
        return auth.split(" ", 1)[1].strip()
    return ""


def _principal_roles(principal_id: str) -> list[str]:
    authz = store.auth_authorizations_list(principal_id)
    roles = {item.get("role", "").strip() for item in authz if item.get("role")}
    roles.add("viewer")
    return sorted(roles)


def _issue_session(principal_id: str, aal: int, device_fingerprint: str) -> dict[str, Any]:
    token = _random_token("bna_sess_")
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    session_secret_hash = _sha256(token)
    device_hash = _sha256(device_fingerprint) if device_fingerprint else ""
    roles = _principal_roles(principal_id)
    store.auth_session_create(
        session_id=session_id,
        principal_id=principal_id,
        session_secret_hash=session_secret_hash,
        device_fingerprint_hash=device_hash,
        aal=aal,
        roles=roles,
        expires_at=_now() + _SESSION_TTL_SECONDS,
    )
    return {
        "token": token,
        "session_id": session_id,
        "principal_id": principal_id,
        "aal": aal,
        "roles": roles,
        "expires_at": int(_now() + _SESSION_TTL_SECONDS),
    }


def resolve_request_session(min_aal: int = 1) -> dict[str, Any] | None:
    token = _extract_session_token()
    if not token:
        return None
    session = store.auth_session_get_by_secret_hash(_sha256(token))
    if not session:
        return None
    if float(session.get("revoked_at") or 0) > 0:
        return None
    if float(session.get("expires_at") or 0) <= _now():
        return None
    if int(session.get("aal") or 1) < int(min_aal):
        return None
    expected_device_hash = (session.get("device_fingerprint_hash") or "").strip()
    if expected_device_hash:
        supplied = (request.headers.get("X-BN-Device-Fingerprint") or "").strip()
        if not supplied or _sha256(supplied) != expected_device_hash:
            return None
    principal = store.auth_principal_get(session["principal_id"])
    if not principal:
        return None
    return {
        "session": session,
        "principal": principal,
        "roles": session.get("roles") or [],
    }


def request_session_authorized(role: str | None = None, min_aal: int = 1) -> bool:
    payload = resolve_request_session(min_aal=min_aal)
    if not payload:
        return False
    if role and role not in (payload.get("roles") or []):
        return False
    request.auth_session = payload
    return True


def _resolve_or_create_principal(identifier_kind: str, value_norm: str, display_name: str = "") -> tuple[str, bool]:
    existing = store.auth_identifier_get(identifier_kind, value_norm)
    if existing:
        return existing["principal_id"], False
    principal_id = f"pr_{uuid.uuid4().hex[:16]}"
    store.auth_principal_create(principal_id=principal_id, display_name=display_name)
    store.auth_identifier_upsert(
        identifier_id=f"id_{uuid.uuid4().hex[:16]}",
        principal_id=principal_id,
        kind=identifier_kind,
        value_norm=value_norm,
        verified_at=0.0,
        metadata={},
    )
    return principal_id, True


def _wallet_message(challenge_id: str, nonce: str, address: str) -> str:
    return _factor_message("wallet_eth", challenge_id, nonce, _normalize_eth(address))


@auth_stack_bp.route("/auth/challenge", methods=["POST"])
def create_challenge():
    body = request.json or {}
    factor_type = (body.get("factor_type") or "").strip()
    purpose = (body.get("purpose") or "login").strip() or "login"
    principal_hint = (body.get("principal_hint") or "").strip()
    if factor_type not in {
        "passkey",
        "wallet_eth",
        "wallet_sol",
        "wallet_btc",
        "nfc_euid",
        "email_magic_link",
    }:
        return jsonify({"error": "unsupported factor_type"}), 400
    challenge_id = f"chal_{uuid.uuid4().hex[:16]}"
    nonce = secrets.token_urlsafe(24)
    payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
    expires_at = _now() + _CHALLENGE_TTL_SECONDS
    store.auth_challenge_create(
        challenge_id=challenge_id,
        factor_type=factor_type,
        purpose=purpose,
        nonce=nonce,
        principal_hint=principal_hint,
        payload=payload,
        ip_hash=_request_ip_hash(),
        ua_hash=_request_ua_hash(),
        expires_at=expires_at,
    )
    response: dict[str, Any] = {
        "challenge_id": challenge_id,
        "factor_type": factor_type,
        "nonce": nonce,
        "expires_at": int(expires_at),
    }
    if factor_type in {"wallet_eth", "wallet_sol", "wallet_btc", "passkey", "nfc_euid"}:
        identifier = _normalize_generic((payload.get("address") or payload.get("identifier") or "").strip())
        response["message_template"] = _factor_message(factor_type, challenge_id, nonce, identifier)
        response["verification_mode"] = _factor_mode(factor_type)
    return jsonify(response), 201


@auth_stack_bp.route("/auth/verifiers/status", methods=["GET"])
def verifier_status():
    factors = ["wallet_eth", "wallet_sol", "wallet_btc", "passkey", "nfc_euid", "email_magic_link"]
    return jsonify(
        {
            "factors": {factor: _factor_mode(factor) if factor != "email_magic_link" else "native" for factor in factors},
            "adapter_urls": {
                "wallet_eth": bool(_factor_adapter_url("wallet_eth")),
                "wallet_sol": bool(_factor_adapter_url("wallet_sol")),
                "wallet_btc": bool(_factor_adapter_url("wallet_btc")),
                "passkey": bool(_factor_adapter_url("passkey")),
                "nfc_euid": bool(_factor_adapter_url("nfc_euid")),
            },
        }
    )


@auth_stack_bp.route("/auth/verify", methods=["POST"])
def verify_factor():
    body = request.json or {}
    factor_type = (body.get("factor_type") or "").strip()
    challenge_id = (body.get("challenge_id") or "").strip()
    if factor_type not in {"wallet_eth", "wallet_sol", "wallet_btc", "passkey", "nfc_euid"}:
        return jsonify({"error": "factor not supported by /auth/verify", "factor_type": factor_type}), 400

    challenge, challenge_error = _load_active_challenge(challenge_id=challenge_id, factor_type=factor_type)
    if challenge_error:
        payload, code = challenge_error
        return jsonify(payload), code
    assert challenge is not None

    device_fingerprint = (body.get("device_fingerprint") or "").strip()
    if not device_fingerprint:
        return jsonify({"error": "device_fingerprint required"}), 400

    verification: dict[str, Any]
    if factor_type == "wallet_eth" and Account is not None and encode_defunct is not None:
        address = _normalize_eth(body.get("address") or "")
        signature = (body.get("signature") or "").strip()
        if not address or not signature:
            return jsonify({"error": "address and signature required"}), 400
        message = _wallet_message(challenge_id, challenge["nonce"], address)
        try:
            recovered = _normalize_eth(Account.recover_message(encode_defunct(text=message), signature=signature))
        except Exception:
            return jsonify({"error": "signature verification failed"}), 400
        if recovered != address:
            return jsonify({"error": "signature does not match address"}), 400
        verification = {
            "ok": True,
            "identifier_value": address,
            "aal": _default_aal_for_factor(factor_type),
            "metadata": {"verification_mode": "eth_account"},
        }
    else:
        verification = _verify_factor_generic(factor_type=factor_type, challenge=challenge, body=body)
        if not verification.get("ok"):
            error = verification.get("error") or "verification failed"
            if error in {"adapter_unconfigured"}:
                return (
                    jsonify(
                        {
                            "error": "verifier unavailable",
                            "factor_type": factor_type,
                            "hint": "set BOUNTYNET_AUTH_DEV_FACTOR_SECRET for local dev or configure factor adapter URL",
                        }
                    ),
                    501,
                )
            return jsonify({"error": error}), 400

    store.auth_challenge_consume(challenge_id)
    identifier_kind = _identifier_kind_for_factor(factor_type)
    identifier_value = _normalize_generic(verification.get("identifier_value") or "")
    principal_id, _ = _resolve_or_create_principal(identifier_kind, identifier_value)
    store.auth_identifier_upsert(
        identifier_id=f"id_{uuid.uuid4().hex[:16]}",
        principal_id=principal_id,
        kind=identifier_kind,
        value_norm=identifier_value,
        verified_at=_now(),
        metadata={
            "last_factor": factor_type,
            **(verification.get("metadata") if isinstance(verification.get("metadata"), dict) else {}),
        },
    )
    issued = _issue_session(
        principal_id=principal_id,
        aal=int(verification.get("aal") or _default_aal_for_factor(factor_type)),
        device_fingerprint=device_fingerprint,
    )
    return jsonify({"status": "verified", "factor_type": factor_type, **issued})


@auth_stack_bp.route("/auth/magic-link/request", methods=["POST"])
def request_magic_link():
    body = request.json or {}
    email = _normalize_email(body.get("email") or "")
    if not email:
        return jsonify({"error": "email required"}), 400
    principal_id, _ = _resolve_or_create_principal("email", email, display_name=email)
    token = _random_token("bna_ml_")
    token_hash = _sha256(token)
    expires_at = _now() + _MAGIC_LINK_TTL_SECONDS
    store.auth_magic_link_create(
        magic_id=f"ml_{uuid.uuid4().hex[:16]}",
        principal_id=principal_id,
        email_norm=email,
        token_hash=token_hash,
        ip_hash=_request_ip_hash(),
        expires_at=expires_at,
    )
    response: dict[str, Any] = {
        "status": "queued",
        "email": email,
        "expires_at": int(expires_at),
    }
    if _MAGIC_LINK_DEV_ECHO:
        response["dev_magic_link_token"] = token
    return jsonify(response), 202


@auth_stack_bp.route("/auth/magic-link/consume", methods=["POST"])
def consume_magic_link():
    body = request.json or {}
    token = (body.get("token") or "").strip()
    device_fingerprint = (body.get("device_fingerprint") or "").strip()
    if not token or not device_fingerprint:
        return jsonify({"error": "token and device_fingerprint required"}), 400
    used = store.auth_magic_link_use(_sha256(token))
    if not used:
        return jsonify({"error": "invalid or expired token"}), 400
    principal_id = used.get("principal_id") or ""
    email_norm = used.get("email_norm") or ""
    if not principal_id:
        principal_id, _ = _resolve_or_create_principal("email", email_norm, display_name=email_norm)
    store.auth_identifier_upsert(
        identifier_id=f"id_{uuid.uuid4().hex[:16]}",
        principal_id=principal_id,
        kind="email",
        value_norm=email_norm,
        verified_at=_now(),
        metadata={"last_factor": "email_magic_link"},
    )
    issued = _issue_session(principal_id=principal_id, aal=1, device_fingerprint=device_fingerprint)
    return jsonify({"status": "verified", "factor_type": "email_magic_link", **issued})


@auth_stack_bp.route("/auth/session/me", methods=["GET"])
def auth_session_me():
    payload = resolve_request_session(min_aal=1)
    if not payload:
        return jsonify({"error": "unauthenticated"}), 401
    session = payload["session"]
    principal = payload["principal"]
    return jsonify(
        {
            "session_id": session["id"],
            "principal": principal,
            "roles": payload.get("roles") or [],
            "aal": session.get("aal", 1),
            "expires_at": int(session.get("expires_at") or 0),
        }
    )


@auth_stack_bp.route("/auth/logout", methods=["POST"])
def auth_logout():
    payload = resolve_request_session(min_aal=1)
    if not payload:
        return jsonify({"status": "ok"})
    store.auth_session_revoke(payload["session"]["id"])
    return jsonify({"status": "ok"})


@auth_stack_bp.route("/auth/bootstrap/admin", methods=["POST"])
def bootstrap_admin():
    body = request.json or {}
    identifier_kind = (body.get("identifier_kind") or "email").strip() or "email"
    identifier_value_raw = (
        body.get("identifier_value")
        if body.get("identifier_value") is not None
        else body.get("email")
    )
    identifier_value = (
        _normalize_email(identifier_value_raw or "")
        if identifier_kind == "email"
        else _normalize_eth(identifier_value_raw or "")
    )
    secret = (body.get("bootstrap_secret") or "").strip()
    if identifier_kind not in {"email", "eth", "sol", "btc", "passkey_handle", "euid"}:
        return jsonify({"error": "unsupported identifier_kind"}), 400
    if not identifier_value:
        return jsonify({"error": "identifier_value required"}), 400
    if _AUTH_BOOTSTRAP_SECRET and secret != _AUTH_BOOTSTRAP_SECRET:
        return jsonify({"error": "bootstrap secret mismatch"}), 403
    identifier = store.auth_identifier_get(identifier_kind, identifier_value)
    principal_id = identifier["principal_id"] if identifier else f"pr_{uuid.uuid4().hex[:16]}"
    if not identifier:
        store.auth_principal_create(principal_id=principal_id, display_name=identifier_value)
        store.auth_identifier_upsert(
            identifier_id=f"id_{uuid.uuid4().hex[:16]}",
            principal_id=principal_id,
            kind=identifier_kind,
            value_norm=identifier_value,
            verified_at=0.0,
            metadata={"bootstrap": True},
        )
    existing = store.auth_authorizations_list(principal_id)
    if not any(item.get("role") == "admin" for item in existing):
        store.auth_authorization_grant(
            authz_id=f"authz_{uuid.uuid4().hex[:16]}",
            principal_id=principal_id,
            role="admin",
            scope="*",
            granted_by="bootstrap",
            expires_at=0.0,
            metadata={"method": "bootstrap"},
        )
    return jsonify(
        {
            "status": "granted",
            "principal_id": principal_id,
            "role": "admin",
            "identifier_kind": identifier_kind,
            "identifier_value": identifier_value,
        }
    )
