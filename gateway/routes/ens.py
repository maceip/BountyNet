"""
CCIP-Read gateway route — off-chain resolution for `*.<BOUNTYNET_CCIP_PARENT>`.

Supports:
  addr(bytes32 node)                   — EIP-137 default address (primary registry chain)
  addr(bytes32 node, uint256 coinType) — ENSIP-25 chain-specific address

coinType uses ENSIP-11: 0x80000000 + chainId for EVM networks.

GET /ens/{sender}/{data}.json  — EIP-3668 gateway endpoint
GET /ens/lookup/{subdomain}    — direct lookup (debug)
"""
import os
import time
from flask import Blueprint, request, jsonify
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak
from eth_abi import encode, decode
from gateway.chain import (
    get_agent_wallet,
    get_next_agent_id,
    ESCROW,
    IDENTITY,
    CCIP_PARENT,
)

ens_bp = Blueprint("ens", __name__)

GATEWAY_KEY = os.environ.get("RELAYER_PRIVATE_KEY", "")
PARENT = CCIP_PARENT
TTL = 300

# Static name → address mapping
STATIC_NAMES = {
    "deployer": os.environ.get("DEPLOYER_ADDRESS", ""),
    "treasury": os.environ.get("TREASURY_ADDRESS", ""),
    "relayer": os.environ.get("RELAYER_ADDRESS", ""),
    "bounty": os.environ.get("BOUNTY_ESCROW", ""),
    "escrow": os.environ.get("BOUNTY_ESCROW", ""),
    "identity": os.environ.get("IDENTITY_REGISTRY", ""),
    "validation": os.environ.get("VALIDATION_REGISTRY", ""),
    "oracle": "0x75528655c2337848C16E6AEB3B98eedDa693F31d",
}

# coinType = 0x80000000 + chainId (ENSIP-11)
PRIMARY_COIN_TYPE = 0x80000000 + 5042002   # default IdentityRegistry deployment chain
AUX_COIN_TYPE = 0x80000000 + 114          # optional auxiliary proof-store chain
COIN_SEPOLIA = 0x80000000 + 11155111
COIN_ETH = 60

AUX_CHAIN_STATIC = {
    "oracle": "0x75528655c2337848C16E6AEB3B98eedDa693F31d",
    "proofs": os.environ.get(
        "ORACLE_AUX_PROOF_STORE",
        os.environ.get("COSTON2_PROOF_STORE", ""),
    ),
}


def resolve(subdomain: str, coin_type: int = PRIMARY_COIN_TYPE) -> str | None:
    """Resolve a subdomain to an address, optionally for a specific chain."""

    # Static names resolve the same on all chains (infrastructure addresses)
    if subdomain in STATIC_NAMES and STATIC_NAMES[subdomain]:
        if coin_type == AUX_COIN_TYPE and subdomain in AUX_CHAIN_STATIC and AUX_CHAIN_STATIC[subdomain]:
            return AUX_CHAIN_STATIC[subdomain]
        return STATIC_NAMES[subdomain]

    # Agent resolution: agent-N, solver-N, or bare number
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
            if wallet == "0x0000000000000000000000000000000000000000":
                return None

            if coin_type == AUX_COIN_TYPE:
                return wallet

            return wallet
        except Exception:
            pass

    return None


# ── CCIP-Read endpoint ─────────────────────────────────────────

@ens_bp.route("/ens/<sender>/<data>.json")
def ccip_read(sender: str, data: str):
    try:
        call_data = bytes.fromhex(data[2:] if data.startswith("0x") else data)
    except ValueError:
        return jsonify({"error": "invalid hex"}), 400

    selector = call_data[:4].hex()

    # addr(bytes32 node) = 0x3b3b57de — default address
    if selector == "3b3b57de":
        node = call_data[4:36]
        subdomain = _node_to_subdomain(node)
        address = resolve(subdomain) if subdomain else os.environ.get("DEPLOYER_ADDRESS", "0x" + "0" * 40)
        result = encode(["address"], [address or "0x" + "0" * 40])

    # addr(bytes32 node, uint256 coinType) = 0xf1cb7e06 — ENSIP-25 chain-specific
    elif selector == "f1cb7e06":
        node = call_data[4:36]
        coin_type = int.from_bytes(call_data[36:68], "big")
        subdomain = _node_to_subdomain(node)
        address = resolve(subdomain, coin_type) if subdomain else None

        if address and coin_type in (PRIMARY_COIN_TYPE, AUX_COIN_TYPE, COIN_SEPOLIA, COIN_ETH, 60):
            # EVM address — encode as 20 bytes
            addr_bytes = bytes.fromhex(address[2:] if address.startswith("0x") else address)
            result = encode(["bytes"], [addr_bytes])
        else:
            result = encode(["bytes"], [b""])

    # text(bytes32 node, string key) = 0x59d1d43c
    elif selector == "59d1d43c":
        node = call_data[4:36]
        # Decode the string key from ABI-encoded calldata
        try:
            key_data = call_data[4:]
            _, key = decode(["bytes32", "string"], key_data)
        except Exception:
            key = ""

        subdomain = _node_to_subdomain(node)
        text_value = _resolve_text(subdomain, key)
        result = encode(["string"], [text_value or ""])

    else:
        return jsonify({"error": f"unsupported selector: {selector}"}), 400

    # Sign the response
    expiry = int(time.time()) + TTL
    extra = call_data

    if not GATEWAY_KEY:
        return jsonify({"error": "CCIP signing key not configured"}), 500
    msg_hash = keccak(result + expiry.to_bytes(8, "big") + extra)
    sig = Account.sign_message(encode_defunct(msg_hash), private_key=GATEWAY_KEY)
    signature = sig.signature

    response = encode(["bytes", "uint64", "bytes"], [result, expiry, signature])
    return jsonify({"data": "0x" + response.hex()})


def _resolve_text(subdomain: str | None, key: str) -> str | None:
    """Resolve off-chain text records for agents."""
    if not subdomain:
        return None

    # Standard text records
    if key == "description":
        return "BountyNet agent"
    if key == "url":
        return "https://bountynet.stare.network"
    if key == "avatar":
        return "https://bountynet.stare.network/logo.jpg"

    if key in ("network.primary", "network.bountynet.primary"):
        addr = resolve(subdomain, PRIMARY_COIN_TYPE)
        return addr or ""
    if key in ("network.auxiliary", "network.bountynet.aux"):
        addr = resolve(subdomain, AUX_COIN_TYPE)
        return addr or ""

    # Oracle identity
    if key == "oracle.source_hash":
        try:
            import requests
            r = requests.get("https://gateway.stare.network/oracle/health", timeout=5)
            return r.json().get("tee", {}).get("source_hash", "")
        except Exception:
            return ""
    if key == "oracle.image_digest":
        try:
            import requests
            r = requests.get("https://gateway.stare.network/oracle/health", timeout=5)
            return r.json().get("tee", {}).get("image_digest", "")
        except Exception:
            return ""

    return None


def _node_to_subdomain(node: bytes) -> str | None:
    """
    Map a namehash back to a subdomain.
    Since we can't reverse namehash, we check known agents + static names.
    """
    # Check static names
    for name in list(STATIC_NAMES.keys()) + list(AUX_CHAIN_STATIC.keys()):
        if _namehash(f"{name}.{PARENT}") == node:
            return name

    # Check agent-N for reasonable range
    try:
        next_id = get_next_agent_id()
    except Exception:
        next_id = 100

    for i in range(1, min(next_id + 1, 1000)):
        if _namehash(f"agent-{i}.{PARENT}") == node:
            return f"agent-{i}"

    return None


def _namehash(name: str) -> bytes:
    """Compute ENS namehash."""
    node = b"\x00" * 32
    if name:
        labels = name.split(".")
        for label in reversed(labels):
            node = keccak(node + keccak(label.encode()))
    return node


# ── Debug endpoints ────────────────────────────────────────────

@ens_bp.route("/ens/lookup/<subdomain>")
def lookup(subdomain: str):
    """Direct lookup — addresses on primary and auxiliary coin types."""
    primary_addr = resolve(subdomain, PRIMARY_COIN_TYPE)
    aux_addr = resolve(subdomain, AUX_COIN_TYPE)

    if not primary_addr and not aux_addr:
        return jsonify({"error": "not found"}), 404

    return jsonify({
        "name": f"{subdomain}.{PARENT}",
        "addresses": {
            "primary": primary_addr,
            "auxiliary": aux_addr,
            "default": primary_addr,
        },
        "coin_types": {
            str(PRIMARY_COIN_TYPE): primary_addr,
            str(AUX_COIN_TYPE): aux_addr,
        },
    })
