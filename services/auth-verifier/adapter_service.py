from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from flask import Flask, jsonify, request

try:
    from eth_account import Account
    from eth_account.messages import encode_defunct
except Exception:  # pragma: no cover
    Account = None  # type: ignore[assignment]
    encode_defunct = None  # type: ignore[assignment]


app = Flask(__name__)

_DEV_SECRET = (os.getenv("BOUNTYNET_AUTH_ADAPTER_DEV_SECRET") or "adapter-dev-secret").strip()


def _normalize(value: str) -> str:
    return (value or "").strip().lower()


def _dev_proof_expected(factor_type: str, challenge_id: str, nonce: str, identifier: str) -> str:
    payload = f"{_DEV_SECRET}:{factor_type}:{challenge_id}:{nonce}:{identifier}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _default_aal(factor_type: str) -> int:
    if factor_type == "nfc_euid":
        return 3
    if factor_type in {"wallet_eth", "wallet_sol", "wallet_btc", "passkey"}:
        return 2
    return 1


def _eth_message(challenge_id: str, nonce: str, identifier: str) -> str:
    domain = (os.getenv("BOUNTYNET_AUTH_DOMAIN") or "bountynet.local").strip()
    return (
        "BountyNet Sign-In\n"
        f"Domain: {domain}\n"
        "Factor: wallet_eth\n"
        f"Challenge: {challenge_id}\n"
        f"Nonce: {nonce}\n"
        f"Identifier: {identifier}\n"
    )


def _verify_dev_generic(factor_type: str, challenge_id: str, nonce: str, identifier: str, proof: str) -> dict[str, Any]:
    expected = _dev_proof_expected(factor_type, challenge_id, nonce, identifier)
    if proof != expected:
        return {"ok": False, "error": "invalid proof"}
    return {
        "ok": True,
        "identifier": identifier,
        "aal": _default_aal(factor_type),
        "metadata": {"verification_mode": "adapter_dev_secret"},
    }


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "auth-verifier-adapter"})


@app.post("/verify")
def verify():
    body = request.json or {}
    factor_type = (body.get("factor_type") or "").strip()
    challenge_id = (body.get("challenge_id") or "").strip()
    nonce = (body.get("nonce") or "").strip()
    req_payload = body.get("request_payload") if isinstance(body.get("request_payload"), dict) else {}

    if factor_type not in {"wallet_eth", "wallet_sol", "wallet_btc", "passkey", "nfc_euid"}:
        return jsonify({"ok": False, "error": "unsupported factor_type"}), 400
    if not challenge_id or not nonce:
        return jsonify({"ok": False, "error": "challenge_id and nonce required"}), 400

    identifier = _normalize(
        req_payload.get("identifier")
        if req_payload.get("identifier") is not None
        else req_payload.get("address", "")
    )
    if not identifier:
        return jsonify({"ok": False, "error": "identifier/address required"}), 400

    if factor_type == "wallet_eth" and Account is not None and encode_defunct is not None:
        signature = (req_payload.get("signature") or "").strip()
        if signature:
            message = _eth_message(challenge_id, nonce, identifier)
            try:
                recovered = _normalize(Account.recover_message(encode_defunct(text=message), signature=signature))
            except Exception:
                recovered = ""
            if recovered == identifier:
                return jsonify(
                    {
                        "ok": True,
                        "identifier": identifier,
                        "aal": 2,
                        "metadata": {"verification_mode": "adapter_eth_account"},
                    }
                )

    proof = (req_payload.get("proof") or "").strip()
    result = _verify_dev_generic(
        factor_type=factor_type,
        challenge_id=challenge_id,
        nonce=nonce,
        identifier=identifier,
        proof=proof,
    )
    code = 200 if result.get("ok") else 400
    return jsonify(result), code


if __name__ == "__main__":
    host = os.getenv("BOUNTYNET_AUTH_ADAPTER_HOST", "127.0.0.1")
    port = int(os.getenv("BOUNTYNET_AUTH_ADAPTER_PORT", "8099"))
    app.run(host=host, port=port)
