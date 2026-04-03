"""
Bounty feed — active bounties for solvers to discover.

GET /bounties         — list active bounties (reads recent BountyCreated events)
GET /bounties/<hash>  — single bounty status
"""
from flask import Blueprint, jsonify
from gateway.chain import w3, ESCROW, get_bounty, sig, eurc_balance
from eth_abi import encode

bounties_bp = Blueprint("bounties", __name__)


@bounties_bp.route("/bounties")
def list_bounties():
    """List recent bounties from BountyCreated events."""
    if not ESCROW:
        return jsonify({"bounties": [], "error": "escrow not configured"})

    try:
        # Get BountyCreated events from recent blocks
        current = w3.eth.block_number
        lookback = min(current, 10000)  # last ~10k blocks

        event_sig = "0x" + bytes.hex(
            bytes.fromhex("a2e7a402") # BountyCreated topic — we'll compute properly
        )

        # Use eth_getLogs with the BountyCreated event topic
        from eth_utils import keccak as keccak_hash
        topic = "0x" + keccak_hash(b"BountyCreated(bytes32,address,uint256,uint256,string)").hex()

        logs = w3.eth.get_logs({
            "fromBlock": current - lookback,
            "toBlock": "latest",
            "address": w3.to_checksum_address(ESCROW),
            "topics": [topic],
        })

        bounties = []
        for log in logs[-20:]:  # last 20
            ctx_hash = log["topics"][1] if len(log["topics"]) > 1 else log["data"][:32]
            bounty = get_bounty(ctx_hash)
            if bounty and not bounty["resolved"] and not bounty["cancelled"]:
                bounties.append({
                    "context_hash": "0x" + ctx_hash.hex() if isinstance(ctx_hash, bytes) else ctx_hash,
                    **bounty,
                    "amount_eurc": f"{bounty['amount'] / 1e6:.2f}",
                    "claimable": bounty["solver_agent_id"] == 0,
                })

        return jsonify({"bounties": bounties, "count": len(bounties)})

    except Exception as e:
        return jsonify({"bounties": [], "error": str(e)})


@bounties_bp.route("/bounties/<context_hash>")
def bounty_detail(context_hash: str):
    ctx = bytes.fromhex(context_hash[2:] if context_hash.startswith("0x") else context_hash)
    bounty = get_bounty(ctx)
    if not bounty:
        return jsonify({"error": "not found"}), 404
    bounty["amount_eurc"] = f"{bounty['amount'] / 1e6:.2f}"
    bounty["context_hash"] = context_hash
    return jsonify(bounty)
