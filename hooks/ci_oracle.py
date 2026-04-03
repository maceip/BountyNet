"""
CI Oracle webhook — green build triggers on-chain validation + payout.

Receives GitHub check_run.completed with conclusion: success.
Calls ValidationRegistry.validation_response(100) then anyone can resolve the escrow.
"""
import os
import json
import hmac
import hashlib
from flask import Flask, request, jsonify
from web3 import Web3
from eth_account import Account
from eth_utils import keccak
from eth_abi import encode

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
ARC_RPC = os.environ.get("QUICKNODE_ARC_HTTP", "https://rpc.testnet.arc.network")
ORACLE_KEY = os.environ.get("DEPLOYER_PRIVATE_KEY", "")
VALIDATION_REGISTRY = os.environ.get("VALIDATION_REGISTRY", "")
BOUNTY_ESCROW = os.environ.get("BOUNTY_ESCROW", "")

w3 = Web3(Web3.HTTPProvider(ARC_RPC))


def verify_signature(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def send_tx(to, data):
    oracle = Account.from_key(ORACLE_KEY)
    nonce = w3.eth.get_transaction_count(oracle.address)
    tx = {
        "from": oracle.address,
        "to": w3.to_checksum_address(to),
        "data": data,
        "nonce": nonce,
        "gasPrice": w3.eth.gas_price,
        "gas": 300000,
        "chainId": 5042002,
    }
    signed = oracle.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return w3.eth.wait_for_transaction_receipt(tx_hash)


@app.route("/oracle", methods=["POST"])
def oracle_webhook():
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, sig):
        return jsonify({"error": "bad signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.json

    if event != "check_run":
        return jsonify({"status": "ignored"})

    check = payload.get("check_run", {})
    if payload.get("action") != "completed" or check.get("conclusion") != "success":
        return jsonify({"status": "ignored", "reason": "not a success"})

    repo = payload["repository"]["full_name"]
    sha = check.get("head_sha", "")[:8]
    name = check.get("name", "build")

    # The validation hash ties the CI proof to the original bounty
    val_hash = keccak(f"ci-proof:{repo}:{sha}:{name}".encode())

    print(f"[oracle] CI GREEN: {repo} @ {sha} ({name})")

    # Submit validation response: PASS (100)
    resp_sig = keccak(b"validation_response(bytes32,uint8,bytes32,string)")[:4]
    resp_data = "0x" + (resp_sig + encode(
        ["bytes32", "uint8", "bytes32", "string"],
        [val_hash, 100, keccak(b"green"), "ci-pass"]
    )).hex()

    try:
        receipt = send_tx(VALIDATION_REGISTRY, resp_data)
        print(f"[oracle] validation tx: {receipt.transactionHash.hex()[:18]}... status={receipt.status}")
        return jsonify({
            "status": "validated",
            "validation_hash": "0x" + val_hash.hex(),
            "tx": receipt.transactionHash.hex(),
        })
    except Exception as e:
        print(f"[oracle] tx failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8092)
