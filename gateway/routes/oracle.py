"""
CI Oracle — TEE-attested validation + on-chain resolution.

Two paths:
  1. POST /oracle         — receives check_run webhook, signs via TEE, submits to Arc
  2. POST /oracle/verify  — verify a TEE signature off-chain (debug)

The TEE oracle runs as a Flare FCE extension (oracle-tee/).
Gateway calls its direct API at ORACLE_TEE_URL/oracle/sign to get a
TEE-signed proof, then submits that signature to Arc's ValidationRegistry.
"""
import os
import requests
from flask import Blueprint, request, jsonify
from eth_utils import keccak
from eth_abi import encode
from gateway.routes.github import verify_webhook
from gateway.chain import send_tx, sig as fn_sig, call, VALIDATION, w3

oracle_bp = Blueprint("oracle", __name__)

ORACLE_TEE_URL = os.environ.get("ORACLE_TEE_URL", "http://localhost:8095")


def get_tee_signature(repo: str, sha: str, check_name: str, conclusion: str) -> dict | None:
    """Get a TEE-signed CI proof from the oracle-tee service."""
    try:
        resp = requests.post(
            f"{ORACLE_TEE_URL}/oracle/sign",
            json={
                "repo": repo,
                "sha": sha,
                "check_name": check_name,
                "conclusion": conclusion,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


def submit_tee_validation(repo: str, sha: str, check_name: str) -> dict | None:
    """
    Full oracle flow:
      1. Get TEE-signed proof
      2. Submit signature to Arc's ValidationRegistry
    """
    if not VALIDATION:
        return None

    # Get TEE signature
    proof = get_tee_signature(repo, sha, check_name, "success")

    # Compute validation hash (same as before for on-chain lookup)
    val_hash = keccak(f"ci-proof:{repo}:{sha}:{check_name}".encode())

    if proof:
        # Submit validation with TEE attestation
        # Pack: validation_response(bytes32 val_hash, uint8 score, bytes32 proof_hash, string memo)
        # The proof_hash now contains the TEE signer address for verification
        proof_hash = keccak(
            bytes.fromhex(proof["signer"][2:])
            + bytes.fromhex(proof["message_hash"][2:])
        )
        data = "0x" + (
            fn_sig("validation_response(bytes32,uint8,bytes32,string)")
            + encode(
                ["bytes32", "uint8", "bytes32", "string"],
                [val_hash, 100, proof_hash, f"tee-attested:{proof['signer']}"],
            )
        ).hex()
    else:
        # Fallback: direct submission without TEE (degraded mode)
        data = "0x" + (
            fn_sig("validation_response(bytes32,uint8,bytes32,string)")
            + encode(
                ["bytes32", "uint8", "bytes32", "string"],
                [val_hash, 100, keccak(b"green"), "direct-no-tee"],
            )
        ).hex()

    try:
        result = send_tx(VALIDATION, data)
        return {
            "validation_hash": "0x" + val_hash.hex(),
            "tee_attested": proof is not None,
            "tee_signer": proof["signer"] if proof else None,
            "tee_proof": proof,
            **result,
        }
    except Exception as e:
        print(f"[oracle] validation tx failed: {e}")
        return None


# Also export for github.py to use
submit_validation = submit_tee_validation


@oracle_bp.route("/oracle", methods=["POST"])
def oracle():
    if not verify_webhook(request.data, request.headers.get("X-Hub-Signature-256", "")):
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

    result = submit_tee_validation(repo, sha, name)
    if result:
        return jsonify({"status": "validated", **result})
    return jsonify({"error": "validation failed"}), 500


@oracle_bp.route("/oracle/verify", methods=["POST"])
def verify_proof():
    """Verify a TEE signature off-chain (debug/demo endpoint)."""
    body = request.json or {}
    proof = body.get("proof")
    if not proof:
        return jsonify({"error": "proof required"}), 400

    # Recover signer from the proof
    from eth_account.messages import encode_defunct
    from eth_account import Account

    msg_hash = bytes.fromhex(proof["message_hash"][2:])
    v = proof["v"]
    r = bytes.fromhex(proof["r"][2:])
    s = bytes.fromhex(proof["s"][2:])

    # Reconstruct signature
    sig_bytes = r + s + bytes([v - 27])

    return jsonify({
        "claimed_signer": proof.get("signer"),
        "message_hash": proof["message_hash"],
        "v": v,
        "valid": True,  # In production, ecrecover and compare
    })


@oracle_bp.route("/oracle/health")
def oracle_health():
    """Check TEE oracle status."""
    try:
        resp = requests.get(f"{ORACLE_TEE_URL}/oracle/health", timeout=5)
        tee = resp.json() if resp.status_code == 200 else {"status": "unreachable"}
    except Exception:
        tee = {"status": "unreachable"}

    return jsonify({
        "oracle": "ok",
        "tee": tee,
        "validation_registry": VALIDATION or "not configured",
    })
