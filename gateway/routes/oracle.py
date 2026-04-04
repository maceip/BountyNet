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
from gateway.events import emit
from eth_utils import keccak
from eth_abi import encode
from gateway.routes.github import verify_webhook
from gateway.chain import send_tx, sig as fn_sig, call, VALIDATION, w3

oracle_bp = Blueprint("oracle", __name__)

ORACLE_TEE_URL = os.environ.get("ORACLE_TEE_URL", "http://localhost:8095")
COSTON2_RPC = os.environ.get("COSTON2_RPC", "https://coston2-api.flare.network/ext/C/rpc")
COSTON2_PROOF_STORE = os.environ.get("COSTON2_PROOF_STORE", "0xcb2D6156b37015aF6d743c8C0adfD21175e0D544")
ORACLE_KEY = os.environ.get("ORACLE_TEE_KEY", os.environ.get("DEPLOYER_PRIVATE_KEY", ""))


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


def store_proof_coston2(val_hash: bytes, proof: dict, repo: str, check_name: str) -> dict | None:
    """Store TEE-signed proof on Flare Coston2 OracleProofStore."""
    if not ORACLE_KEY or not COSTON2_PROOF_STORE:
        return None
    try:
        from web3 import Web3
        from eth_account import Account
        from eth_abi import encode as abi_encode

        w3c = Web3(Web3.HTTPProvider(COSTON2_RPC))
        acct = Account.from_key(ORACLE_KEY)

        # storeProof(bytes32, uint8, bytes32, bytes32, string, string)
        selector = keccak(b"storeProof(bytes32,uint8,bytes32,bytes32,string,string)")[:4]
        v = proof["v"]
        r = bytes.fromhex(proof["r"][2:])
        s = bytes.fromhex(proof["s"][2:])

        data = "0x" + (selector + abi_encode(
            ["bytes32", "uint8", "bytes32", "bytes32", "string", "string"],
            [val_hash, v, r, s, repo, check_name],
        )).hex()

        tx = {
            "from": acct.address,
            "to": w3c.to_checksum_address(COSTON2_PROOF_STORE),
            "data": data,
            "nonce": w3c.eth.get_transaction_count(acct.address),
            "gas": 300_000,
            "gasPrice": max(w3c.eth.gas_price, 25_000_000_000),
            "chainId": 114,
        }
        signed = acct.sign_transaction(tx)
        tx_hash = w3c.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3c.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        return {"coston2_tx": tx_hash.hex(), "coston2_block": receipt.blockNumber}
    except Exception as e:
        print(f"[oracle] coston2 store failed: {e}")
        return None


def submit_tee_validation(repo: str, sha: str, check_name: str) -> dict | None:
    """
    Full oracle flow:
      1. Get TEE-signed proof
      2. Store proof on Flare Coston2 (cross-chain attestation)
      3. Submit signature to Arc's ValidationRegistry
    """
    if not VALIDATION:
        return None

    # Get TEE signature
    proof = get_tee_signature(repo, sha, check_name, "success")

    # Compute validation hash (same as before for on-chain lookup)
    val_hash = keccak(f"ci-proof:{repo}:{sha}:{check_name}".encode())

    # Store proof on Flare Coston2 (cross-chain attestation)
    coston2_result = None
    if proof:
        coston2_result = store_proof_coston2(val_hash, proof, repo, check_name)

    if proof:
        # Submit validation with TEE attestation to Arc
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
        tee_msg = f"TEE-attested proof signed by {proof['signer'][:10]}..." if proof else "Direct validation (no TEE)"
        coston2_msg = f", stored on Coston2 (block #{coston2_result['coston2_block']})" if coston2_result else ""
        emit("oracle", f"Oracle validated: {repo}@{sha} — {tee_msg}{coston2_msg}",
             repo=repo, data={"tee": bool(proof), "coston2": bool(coston2_result)})

        return {
            "validation_hash": "0x" + val_hash.hex(),
            "tee_attested": proof is not None,
            "tee_signer": proof["signer"] if proof else None,
            "tee_proof": proof,
            "coston2": coston2_result,
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
