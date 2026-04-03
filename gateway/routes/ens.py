"""
ENS CCIP-Read route — resolves *.maceip.eth via off-chain lookup.

GET /ens/{sender}/{data}.json  — EIP-3668 gateway endpoint
GET /ens/lookup/{subdomain}    — direct lookup (debug)
"""
import os
import time
from flask import Blueprint, jsonify
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak
from eth_abi import encode
from gateway.chain import get_agent_wallet, get_next_agent_id, ESCROW, IDENTITY

ens_bp = Blueprint("ens", __name__)

GATEWAY_KEY = os.environ.get("RELAYER_PRIVATE_KEY", "")
PARENT = "maceip.eth"
TTL = 300

STATIC_NAMES = {
    "deployer": os.environ.get("DEPLOYER_ADDRESS", ""),
    "treasury": os.environ.get("TREASURY_ADDRESS", ""),
    "relayer": os.environ.get("RELAYER_ADDRESS", ""),
    "bounty": os.environ.get("BOUNTY_ESCROW", ""),
    "escrow": os.environ.get("BOUNTY_ESCROW", ""),
    "identity": os.environ.get("IDENTITY_REGISTRY", ""),
    "validation": os.environ.get("VALIDATION_REGISTRY", ""),
}


def resolve(subdomain: str) -> str | None:
    if subdomain in STATIC_NAMES and STATIC_NAMES[subdomain]:
        return STATIC_NAMES[subdomain]

    agent_id = None
    if subdomain.startswith("agent-") or subdomain.startswith("solver-"):
        try:
            agent_id = int(subdomain.split("-", 1)[1])
        except ValueError:
            pass
    elif subdomain.isdigit():
        agent_id = int(subdomain)

    if agent_id is not None:
        try:
            wallet = get_agent_wallet(agent_id)
            if wallet != "0x0000000000000000000000000000000000000000":
                return wallet
        except Exception:
            pass

    return None


@ens_bp.route("/ens/<sender>/<data>.json")
def ccip_read(sender: str, data: str):
    try:
        call_data = bytes.fromhex(data[2:] if data.startswith("0x") else data)
    except ValueError:
        return jsonify({"error": "invalid hex"}), 400

    selector = call_data[:4].hex()

    # addr(bytes32 node) = 0x3b3b57de
    if selector == "3b3b57de":
        address = os.environ.get("DEPLOYER_ADDRESS", "0x" + "0" * 40)
        result = encode(["address"], [address])
    else:
        return jsonify({"error": f"unsupported: {selector}"}), 400

    expiry = int(time.time()) + TTL
    extra = call_data

    if GATEWAY_KEY:
        msg_hash = keccak(result + expiry.to_bytes(8, 'big') + extra)
        sig = Account.sign_message(encode_defunct(msg_hash), private_key=GATEWAY_KEY)
        signature = sig.signature
    else:
        signature = b"\x00" * 65

    response = encode(["bytes", "uint64", "bytes"], [result, expiry, signature])
    return jsonify({"data": "0x" + response.hex()})


@ens_bp.route("/ens/lookup/<subdomain>")
def lookup(subdomain: str):
    addr = resolve(subdomain)
    if addr:
        return jsonify({"name": f"{subdomain}.{PARENT}", "address": addr})
    return jsonify({"error": "not found"}), 404
