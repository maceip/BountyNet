"""
CI Oracle — green build triggers on-chain validation + payout.

POST /oracle  — receives check_run.completed(success)
"""
import os
import hmac
import hashlib
from flask import Blueprint, request, jsonify
from eth_utils import keccak
from eth_abi import encode
from gateway.chain import send_tx, VALIDATION, sig as fn_sig

oracle_bp = Blueprint("oracle", __name__)
SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")


def verify(payload: bytes, sig: str) -> bool:
    if not SECRET:
        return True
    expected = "sha256=" + hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


@oracle_bp.route("/oracle", methods=["POST"])
def oracle():
    if not verify(request.data, request.headers.get("X-Hub-Signature-256", "")):
        return jsonify({"error": "bad signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    if event != "check_run":
        return jsonify({"status": "ignored"})

    payload = request.json
    check = payload.get("check_run", {})
    if payload.get("action") != "completed" or check.get("conclusion") != "success":
        return jsonify({"status": "ignored"})

    repo = payload["repository"]["full_name"]
    sha = check.get("head_sha", "")[:8]
    name = check.get("name", "build")

    val_hash = keccak(f"ci-proof:{repo}:{sha}:{name}".encode())

    # Submit validation: PASS (100)
    data = "0x" + (fn_sig("validation_response(bytes32,uint8,bytes32,string)") + encode(
        ["bytes32", "uint8", "bytes32", "string"],
        [val_hash, 100, keccak(b"green"), "ci-pass"]
    )).hex()

    try:
        result = send_tx(VALIDATION, data)
        return jsonify({"status": "validated", "validation_hash": "0x" + val_hash.hex(), **result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
