"""
BountyNet ENS Gateway — CCIP-Read (EIP-3668) off-chain resolver.

Handles requests from ENS clients for *.maceip.eth subdomains.
Reads agent data from EIP-8004 Identity Registry on Arc Testnet.

Deploy behind Caddy at: ens-gateway.stare.network

Usage:
  python gateway/server.py

EIP-3668 gateway URL format:
  https://ens-gateway.stare.network/{sender}/{data}.json
"""
import os
import json
import time
import hashlib
from pathlib import Path

from eth_abi import encode, decode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_bytes, to_checksum_address
from web3 import Web3
from flask import Flask, jsonify, request

# ── Config ──────────────────────────────────────────────────────

ARC_RPC = os.environ.get("QUICKNODE_ARC_HTTP", "https://rpc.testnet.arc.network")
IDENTITY_REGISTRY = os.environ.get("IDENTITY_REGISTRY", "0xb16571a67cE2f080d808B0b6c754b35408C3b0eE")
GATEWAY_PRIVATE_KEY = os.environ.get("RELAYER_PRIVATE_KEY", "")  # Signs responses
PARENT_NAME = "maceip.eth"
RESPONSE_TTL = 300  # 5 minute expiry

# ── Web3 setup ──────────────────────────────────────────────────

w3 = Web3(Web3.HTTPProvider(ARC_RPC))

IDENTITY_ABI = json.loads("""[
    {"inputs":[{"name":"token_id","type":"uint256"}],"name":"ownerOf","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agent_id","type":"uint256"}],"name":"get_agent_wallet","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"agent_id","type":"uint256"}],"name":"agent_uri","outputs":[{"name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"next_id","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
]""")

identity = w3.eth.contract(address=IDENTITY_REGISTRY, abi=IDENTITY_ABI)

# ── ENS name parsing ───────────────────────────────────────────

def decode_dns_name(data: bytes) -> str:
    """Decode DNS wire format name from ENS resolve() call."""
    labels = []
    i = 0
    while i < len(data) and data[i] != 0:
        length = data[i]
        i += 1
        labels.append(data[i:i+length].decode('utf-8'))
        i += length
    return '.'.join(labels)


def extract_subdomain(full_name: str) -> str | None:
    """Extract subdomain from full_name relative to PARENT_NAME."""
    if not full_name.endswith('.' + PARENT_NAME) and full_name != PARENT_NAME:
        return None
    if full_name == PARENT_NAME:
        return None
    return full_name[:-len('.' + PARENT_NAME)]


def resolve_subdomain(subdomain: str) -> str | None:
    """
    Resolve a subdomain to an address.

    Supported patterns:
      agent-{id}.maceip.eth  → agent wallet from Identity Registry
      deployer.maceip.eth    → deployer address
      treasury.maceip.eth    → treasury address
      bounty.maceip.eth      → escrow contract address
    """
    # Static mappings
    STATIC = {
        "deployer": os.environ.get("DEPLOYER_ADDRESS", ""),
        "treasury": os.environ.get("TREASURY_ADDRESS", ""),
        "relayer": os.environ.get("RELAYER_ADDRESS", ""),
        "bounty": os.environ.get("BOUNTY_ESCROW", ""),
        "escrow": os.environ.get("BOUNTY_ESCROW", ""),
        "identity": os.environ.get("IDENTITY_REGISTRY", ""),
        "validation": os.environ.get("VALIDATION_REGISTRY", ""),
    }

    if subdomain in STATIC and STATIC[subdomain]:
        return STATIC[subdomain]

    # Agent pattern: agent-{id} or solver-{id} or just a number
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
            wallet = identity.functions.get_agent_wallet(agent_id).call()
            if wallet != "0x0000000000000000000000000000000000000000":
                return wallet
        except Exception:
            pass

    return None


def sign_response(result: bytes, expiry: int, extra_data: bytes) -> bytes:
    """Sign the response with the gateway's private key."""
    message_hash = keccak(result + expiry.to_bytes(8, 'big') + extra_data)
    msg = encode_defunct(message_hash)
    signed = Account.sign_message(msg, private_key=GATEWAY_PRIVATE_KEY)
    return signed.signature


# ── Flask app ───────────────────────────────────────────────────

app = Flask(__name__)


@app.route("/<sender>/<data>.json", methods=["GET"])
def handle_ccip_read(sender: str, data: str):
    """
    EIP-3668 gateway endpoint.
    Client sends: GET /{sender}/{data}.json
    We return: { data: abi.encode(result, expiry, signature) }
    """
    try:
        call_data = bytes.fromhex(data[2:] if data.startswith("0x") else data)
    except ValueError:
        return jsonify({"error": "invalid hex data"}), 400

    # The call_data is the original ENS query — typically:
    #   resolve(bytes name, bytes data) where data contains addr(bytes32 node)
    # But we receive just the inner `data` part (the addr/text/etc query)

    # For addr(node) calls, selector = 0x3b3b57de
    # For text(node, key) calls, selector = 0x59d1d43c
    selector = call_data[:4].hex()

    # We need the extra_data from the resolver to get the name
    # For simplicity in the gateway, we parse the sender to find context
    # In practice, the extra_data contains abi.encode(name, data)

    # Try to decode as addr(bytes32 node)
    if selector == "3b3b57de" and len(call_data) >= 36:
        # Extract node from calldata
        node = call_data[4:36]

        # We need to figure out which subdomain this node represents
        # For the hackathon, we'll try all known subdomains
        # In production, the extraData would contain the DNS name

        # For now, return the deployer address as fallback
        address = os.environ.get("DEPLOYER_ADDRESS", "0x" + "0" * 40)
        result = encode(["address"], [address])

    else:
        return jsonify({"error": f"unsupported selector: {selector}"}), 400

    expiry = int(time.time()) + RESPONSE_TTL
    extra_data = call_data  # pass through

    sig = sign_response(result, expiry, extra_data)

    # Encode the full response: abi.encode(result, expiry, signature)
    response_data = encode(
        ["bytes", "uint64", "bytes"],
        [result, expiry, sig]
    )

    return jsonify({"data": "0x" + response_data.hex()})


@app.route("/health", methods=["GET"])
def health():
    try:
        next_id = identity.functions.next_id().call()
        return jsonify({
            "status": "ok",
            "identity_registry": IDENTITY_REGISTRY,
            "registered_agents": next_id - 1,
            "arc_rpc": ARC_RPC[:40] + "...",
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/lookup/<subdomain>", methods=["GET"])
def lookup(subdomain: str):
    """Direct subdomain lookup (for debugging, not part of CCIP-read)."""
    addr = resolve_subdomain(subdomain)
    if addr:
        return jsonify({"name": f"{subdomain}.{PARENT_NAME}", "address": addr})
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("GATEWAY_PORT", "8090"))
    print(f"BountyNet ENS Gateway starting on :{port}")
    print(f"  Identity Registry: {IDENTITY_REGISTRY}")
    print(f"  Arc RPC: {ARC_RPC[:40]}...")
    print(f"  Parent: {PARENT_NAME}")
    app.run(host="0.0.0.0", port=port)
