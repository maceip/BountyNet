"""
CI Oracle — TEE-attested validation + on-chain resolution.

Two paths:
  1. POST /oracle         — receives check_run webhook, signs via TEE, submits to ValidationRegistry
  2. POST /oracle/verify  — verify a TEE proof signature locally (EIP-191)

The TEE oracle runs as an external attestation service (`services/oracle-tee/`).
Gateway calls its direct API at ORACLE_TEE_URL/oracle/sign to get a
TEE-signed proof, then submits that signature to the ValidationRegistry.
"""
import logging
import os
import requests
from flask import Blueprint, request, jsonify
from gateway.events import emit
from eth_utils import keccak
from eth_abi import decode as eth_decode, encode
from gateway.github.app_auth import verify_webhook
from eth_account import Account
from gateway.chain import send_tx, sig as fn_sig, call, VALIDATION, ORACLE_KEY

oracle_bp = Blueprint("oracle", __name__)
_log = logging.getLogger(__name__)

ORACLE_TEE_URL = os.environ.get("ORACLE_TEE_URL", "http://localhost:8095")
ORACLE_AUX_RPC = os.environ.get(
    "ORACLE_AUX_CHAIN_RPC",
    os.environ.get("COSTON2_RPC", ""),
)
ORACLE_AUX_PROOF_STORE = os.environ.get(
    "ORACLE_AUX_PROOF_STORE",
    os.environ.get("COSTON2_PROOF_STORE", ""),
)
ORACLE_AUX_CHAIN_ID = int(os.environ.get("ORACLE_AUX_CHAIN_ID", "114"))
# Auxiliary / proof-store txs may use a separate operator key
_AUX_ORACLE_KEY = os.environ.get("ORACLE_TEE_KEY", "") or ORACLE_KEY


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


def store_proof_auxiliary(val_hash: bytes, proof: dict, repo: str, check_name: str) -> dict | None:
    """Store TEE-signed proof on auxiliary OracleProofStore (if configured)."""
    if not _AUX_ORACLE_KEY or not ORACLE_AUX_PROOF_STORE or not ORACLE_AUX_RPC:
        return None
    try:
        from web3 import Web3
        from eth_abi import encode as abi_encode

        w3c = Web3(Web3.HTTPProvider(ORACLE_AUX_RPC))
        acct = Account.from_key(_AUX_ORACLE_KEY)

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
            "to": w3c.to_checksum_address(ORACLE_AUX_PROOF_STORE),
            "data": data,
            "nonce": w3c.eth.get_transaction_count(acct.address),
            "gas": 300_000,
            "gasPrice": max(w3c.eth.gas_price, 25_000_000_000),
            "chainId": ORACLE_AUX_CHAIN_ID,
        }
        signed = acct.sign_transaction(tx)
        tx_hash = w3c.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3c.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        return {"aux_tx": tx_hash.hex(), "aux_block": receipt.blockNumber}
    except Exception as e:
        _log.warning("auxiliary proof store failed: %s", e)
        return None


def _validation_needs_request(request_hash: bytes) -> bool:
    """True if ValidationRegistry has no row for request_hash yet."""
    if not VALIDATION or len(request_hash) != 32:
        return False
    data = "0x" + (
        fn_sig("get_status(bytes32)")
        + encode(["bytes32"], [request_hash])
    ).hex()
    try:
        raw = call(VALIDATION, data)
        _validator, _agent_id, _response, last_update = eth_decode(
            ["address", "uint256", "uint8", "uint256"],
            raw,
        )
        return int(last_update) == 0
    except Exception:
        return True


def submit_tee_validation(
    repo: str,
    sha: str,
    check_name: str,
    solver_agent_id: int = 0,
) -> dict | None:
    """
    Full oracle flow:
      0. validation_request (relayer as designated validator) when solver_agent_id set
      1. Get TEE-signed proof
      2. Store proof on auxiliary chain (if configured)
      3. validation_response on ValidationRegistry (same relayer key)
    """
    if not VALIDATION:
        return None
    if not ORACLE_KEY:
        _log.warning("submit_tee_validation: DEPLOYER_PRIVATE_KEY not set")
        return None

    val_hash = keccak(f"ci-proof:{repo}:{sha}:{check_name}".encode())

    acct = Account.from_key(ORACLE_KEY)
    if solver_agent_id > 0 and _validation_needs_request(val_hash):
        req_data = "0x" + (
            fn_sig("validation_request(address,uint256,string,bytes32)")
            + encode(
                ["address", "uint256", "string", "bytes32"],
                [
                    acct.address,
                    solver_agent_id,
                    f"github:{repo}:{sha}",
                    val_hash,
                ],
            )
        ).hex()
        try:
            send_tx(VALIDATION, req_data)
        except Exception as e:
            _log.warning("validation_request failed: %s", e)
            return None

    # Get TEE signature
    proof = get_tee_signature(repo, sha, check_name, "success")

    # Store proof on auxiliary chain (optional cross-network attestation)
    aux_result = None
    if proof:
        aux_result = store_proof_auxiliary(val_hash, proof, repo, check_name)

    if not proof:
        emit(
            "oracle",
            f"Oracle skipped validation (no TEE proof): {repo}@{sha} — check ORACLE_TEE_URL",
            repo=repo,
            data={"tee": False},
        )
        return None

    # Submit validation with TEE attestation
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

    try:
        result = send_tx(VALIDATION, data)
        tee_msg = f"TEE-attested proof signed by {proof['signer'][:10]}..."
        aux_msg = (
            f", auxiliary proof store block #{aux_result['aux_block']}"
            if aux_result
            else ""
        )
        emit("oracle", f"Oracle validated: {repo}@{sha} — {tee_msg}{aux_msg}",
             repo=repo, data={"tee": True, "aux_store": bool(aux_result)})

        return {
            "validation_hash": "0x" + val_hash.hex(),
            "tee_attested": True,
            "tee_signer": proof["signer"],
            "tee_proof": proof,
            "auxiliary_store": aux_result,
            **result,
        }
    except Exception as e:
        _log.warning("validation tx failed: %s", e)
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

    from gateway import store

    rows = store.bounty_prs_for_repo(repo)
    agent_hint = int(rows[0][1].get("solver_agent_id") or 0) if rows else 0
    result = submit_tee_validation(repo, sha, name, agent_hint)
    if result:
        return jsonify({"status": "validated", **result})
    return jsonify({"error": "validation failed"}), 500


@oracle_bp.route("/oracle/verify", methods=["POST"])
def verify_proof():
    """Verify a TEE proof signature locally (EIP-191 over the raw CI proof hash)."""
    body = request.json or {}
    proof = body.get("proof")
    if not proof:
        return jsonify({"error": "proof required"}), 400

    from eth_account import Account
    from eth_utils import keccak

    try:
        raw = bytes.fromhex(str(proof["message_hash"]).removeprefix("0x"))
        prefixed = keccak(b"\x19Ethereum Signed Message:\n32" + raw)
        v = int(proof["v"])
        r = bytes.fromhex(str(proof["r"]).removeprefix("0x"))
        s = bytes.fromhex(str(proof["s"]).removeprefix("0x"))
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"invalid proof fields: {e}"}), 400

    try:
        recovered = Account.recover_hash(
            prefixed,
            vrs=(v, int.from_bytes(r, "big"), int.from_bytes(s, "big")),
        )
    except Exception as e:
        return jsonify({"claimed_signer": proof.get("signer"), "valid": False, "error": str(e)}), 400

    claimed = (proof.get("signer") or "").lower()
    valid = recovered.lower() == claimed
    return jsonify({
        "claimed_signer": proof.get("signer"),
        "recovered_signer": recovered,
        "message_hash": proof["message_hash"],
        "v": v,
        "valid": valid,
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
