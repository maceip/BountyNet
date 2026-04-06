"""
BountyNet CI Oracle — Flare TEE extension handlers.

Runs inside a registered TEE node on Flare Coston2.
Receives CI proof requests, signs them with the TEE-held key.
The signature can be verified on Arc (or any EVM chain) via ecrecover.

Operations:
  ORACLE/VALIDATE — Sign a CI pass/fail proof
  ORACLE/ATTEST   — Sign a GitHub OIDC attestation hash

On-chain flow:
  1. Gateway calls InstructionSender.sign(proof_bytes) on Coston2
  2. Flare TEE relay dispatches to this handler
  3. Handler signs proof with TEE-held private key
  4. Signed result posted back on-chain (Coston2)
  5. Gateway reads the signature, submits to Arc's ValidationRegistry

Direct HTTP path:
  Gateway may POST /oracle/sign to this service (same key material as the TEE route).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from base.types import Framework
from base.encoding import hex_to_bytes, bytes_to_hex
from .config import VERSION, OP_TYPE_ORACLE, OP_COMMAND_VALIDATE, OP_COMMAND_ATTEST
from .crypto import sign_ci_proof, parse_private_key, get_address

logger = logging.getLogger(__name__)

# TEE-held private key — injected via key update or env
_private_key: Optional[bytes] = None
_sign_port: str = "9090"

# Image identity — set at startup
_source_hash: str = ""
_image_digest: str = ""


def _load_source_hash() -> str:
    """Load pre-computed source hash from build, or compute live."""
    import hashlib, glob, os
    # Try build-time hash first
    hash_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".source_hash")
    if os.path.exists(hash_file):
        return open(hash_file).read().strip()
    # Compute live
    h = hashlib.sha256()
    base = os.path.dirname(os.path.dirname(__file__))
    for f in sorted(glob.glob(os.path.join(base, "**/*.py"), recursive=True)):
        h.update(open(f, "rb").read())
    return h.hexdigest()


def _load_image_digest() -> str:
    """Get Docker image digest from /proc/self/cgroup or env."""
    import os
    # Check env first (set by docker inspect at deploy time)
    d = os.environ.get("IMAGE_DIGEST", "")
    if d:
        return d
    # Try to read container ID from cgroup
    try:
        with open("/proc/self/cgroup") as f:
            for line in f:
                if "docker" in line:
                    return line.strip().split("/")[-1][:12]
    except Exception:
        pass
    return "unknown"


def set_sign_port(port: str) -> None:
    global _sign_port
    _sign_port = port


def init_identity() -> None:
    """Load source hash and image digest at startup."""
    global _source_hash, _image_digest
    _source_hash = _load_source_hash()
    _image_digest = _load_image_digest()
    logger.info("oracle identity: source=%s image=%s", _source_hash[:16], _image_digest[:16])


def set_key_from_env(hex_key: str) -> None:
    """Load private key from environment (testnet / bring-up)."""
    global _private_key
    if hex_key:
        raw = bytes.fromhex(hex_key.removeprefix("0x"))
        _private_key = parse_private_key(raw)
        logger.info("oracle TEE key loaded from env, signer=%s", get_address(_private_key))


def register(framework: Framework) -> None:
    """Register the ORACLE handlers with the Flare TEE framework."""
    framework.handle(OP_TYPE_ORACLE, OP_COMMAND_VALIDATE, handle_validate)
    framework.handle(OP_TYPE_ORACLE, OP_COMMAND_ATTEST, handle_attest)
    # Also register KEY operations for key injection via on-chain
    framework.handle("KEY", "UPDATE", handle_key_update)


def report_state() -> Any:
    return {
        "hasKey": _private_key is not None,
        "signer": get_address(_private_key) if _private_key else None,
        "source_hash": _source_hash,
        "image_digest": _image_digest,
        "version": VERSION,
        "type": "bountynet-ci-oracle",
    }


def handle_key_update(msg: str) -> tuple[Optional[str], int, Optional[str]]:
    """Receive encrypted private key from TEE node."""
    global _private_key
    if not msg:
        return None, 0, "empty message"

    try:
        key_bytes = hex_to_bytes(msg)
        _private_key = parse_private_key(key_bytes)
        logger.info("oracle key updated, signer=%s", get_address(_private_key))
        return None, 1, None
    except Exception as e:
        return None, 0, f"key update failed: {e}"


def handle_validate(msg: str) -> tuple[Optional[str], int, Optional[str]]:
    """
    Sign a CI validation proof.

    Input (hex-encoded JSON):
      { "repo": "owner/repo", "sha": "abc12345", "check_name": "build", "conclusion": "success" }

    Output (hex-encoded JSON):
      { "message_hash": "0x...", "v": 27, "r": "0x...", "s": "0x...", "signer": "0x..." }
    """
    if _private_key is None:
        return None, 0, "no oracle key — run key update first"

    if not msg:
        return None, 0, "empty message"

    try:
        payload_bytes = hex_to_bytes(msg)
        payload = json.loads(payload_bytes)
    except Exception as e:
        return None, 0, f"invalid payload: {e}"

    repo = payload.get("repo", "")
    sha = payload.get("sha", "")
    check_name = payload.get("check_name", "build")
    conclusion = payload.get("conclusion", "success")

    if not repo or not sha:
        return None, 0, "repo and sha required"

    try:
        proof = sign_ci_proof(_private_key, repo, sha, check_name, conclusion, _source_hash, _image_digest)
        result_json = json.dumps(proof).encode()
        return bytes_to_hex(result_json), 1, None
    except Exception as e:
        return None, 0, f"signing failed: {e}"


def handle_attest(msg: str) -> tuple[Optional[str], int, Optional[str]]:
    """
    Sign a GitHub OIDC attestation hash.

    Input: hex-encoded 32-byte hash (the context_hash from the attest action)
    Output: hex-encoded signature (r || s || v, 65 bytes)
    """
    if _private_key is None:
        return None, 0, "no oracle key"

    if not msg:
        return None, 0, "empty message"

    try:
        import coincurve
        from base.crypto import keccak256

        msg_bytes = hex_to_bytes(msg)
        prefixed = keccak256(b"\x19Ethereum Signed Message:\n32" + msg_bytes)

        key = coincurve.PrivateKey(_private_key)
        sig = key.sign_recoverable(prefixed, hasher=None)

        return bytes_to_hex(sig), 1, None
    except Exception as e:
        return None, 0, f"attest signing failed: {e}"


# ── Direct HTTP endpoint (gateway-local signing API) ────────────

def sign_ci_proof_direct(repo: str, sha: str, check_name: str, conclusion: str) -> dict:
    """
    Sign a CI proof directly — called by the gateway without going through
    Flare's on-chain dispatch. Same key, same signature, faster path.

    Returns the proof dict or raises.
    """
    if _private_key is None:
        raise RuntimeError("oracle TEE key not loaded")
    return sign_ci_proof(_private_key, repo, sha, check_name, conclusion, _source_hash, _image_digest)
