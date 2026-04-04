"""
Bounty routes — feed, detail, create, claim.

GET  /bounties              — list active bounties
GET  /bounties/<hash>       — single bounty
POST /bounties/create       — create a bounty (manual or from webhook)
POST /bounties/<hash>/claim — solver claims a bounty
"""
from flask import Blueprint, request, jsonify
from eth_utils import keccak
from eth_abi import encode
from gateway.chain import w3, ESCROW, get_bounty, sig, send_tx

bounties_bp = Blueprint("bounties", __name__)

# In-memory bounty store for API-key-mode bounties (not on-chain)
# context_hash_hex → { repo, commit, check_name, budget_tokens, budget_used, claimable, solver_agent_id, created_at }
apikey_bounties: dict = {}


def bounty_feed_snapshot() -> dict:
    """
    Active bounty feed as plain dict — shared by GET /bounties and MCP tools.
    Avoids HTTP self-calls from the MCP handler (would deadlock single-worker Flask).
    """
    if not ESCROW:
        return {"bounties": [], "error": "escrow not configured"}

    try:
        current = w3.eth.block_number
        lookback = min(current, 10000)

        topic = "0x" + keccak(b"BountyCreated(bytes32,address,uint256,uint256,string)").hex()

        logs = w3.eth.get_logs({
            "fromBlock": current - lookback,
            "toBlock": "latest",
            "address": w3.to_checksum_address(ESCROW),
            "topics": [topic],
        })

        bounties = []
        for log in logs[-20:]:
            ctx_hash = log["topics"][1] if len(log["topics"]) > 1 else log["data"][:32]
            bounty = get_bounty(ctx_hash)
            if bounty and not bounty["resolved"] and not bounty["cancelled"]:
                bounties.append({
                    "context_hash": "0x" + ctx_hash.hex() if isinstance(ctx_hash, bytes) else ctx_hash,
                    **bounty,
                    "amount_eurc": f"{bounty['amount'] / 1e6:.2f}",
                    "claimable": bounty["solver_agent_id"] == 0,
                })

        # Merge in API-key-mode bounties (not on-chain)
        for ctx_hex, ab in apikey_bounties.items():
            if not ab.get("resolved"):
                bounties.append({
                    "context_hash": ctx_hex,
                    "creator": ab.get("owner", ""),
                    "amount": ab.get("budget_tokens", 0),
                    "amount_eurc": f"{ab.get('budget_tokens', 0) / 1000:.1f}k tokens",
                    "repo": ab.get("repo", ""),
                    "check_name": ab.get("check_name", ""),
                    "commit": ab.get("commit", ""),
                    "solver_agent_id": ab.get("solver_agent_id", 0),
                    "claimable": ab.get("solver_agent_id", 0) == 0,
                    "resolved": False,
                    "cancelled": False,
                    "budget_mode": "api_key",
                })

        return {"bounties": bounties, "count": len(bounties)}

    except Exception as e:
        return {"bounties": [], "error": str(e)}


@bounties_bp.route("/bounties")
def list_bounties():
    """List recent bounties from BountyCreated events."""
    return jsonify(bounty_feed_snapshot())


@bounties_bp.route("/bounties/<context_hash>")
def bounty_detail(context_hash: str):
    ctx = bytes.fromhex(context_hash[2:] if context_hash.startswith("0x") else context_hash)
    bounty = get_bounty(ctx)
    if not bounty:
        return jsonify({"error": "not found"}), 404
    bounty["amount_eurc"] = f"{bounty['amount'] / 1e6:.2f}"
    bounty["context_hash"] = context_hash
    return jsonify(bounty)


@bounties_bp.route("/bounties/create", methods=["POST"])
def create_bounty():
    """
    Create a bounty. Two modes:
      api_key mode: stores key in budget pool, optional on-chain
      eurc mode: creates on-chain escrow

    Body: {
        "repo": "joe/app",
        "commit": "abc12345",
        "check_name": "Lint & Format",
        "budget_mode": "api_key" | "eurc",
        "anthropic_key": "sk-ant-...",     (api_key mode)
        "budget_tokens": 100000,           (api_key mode)
        "amount_eurc": 5000000             (eurc mode, in micro-EURC)
    }
    """
    body = request.json or {}
    repo = body.get("repo", "")
    commit = body.get("commit", "")
    check_name = body.get("check_name", "build")

    if not repo or not commit:
        return jsonify({"error": "repo and commit required"}), 400

    context_hash = keccak(f"{repo}:{commit[:8]}:{check_name}:failure".encode())
    context_hash_hex = "0x" + context_hash.hex()
    budget_mode = body.get("budget_mode", "api_key")

    if budget_mode == "api_key":
        # Store API key in inference budget pool
        from gateway.routes.inference import staker_budgets
        api_key = body.get("anthropic_key", "") or body.get("openai_key", "")
        budget_tokens = body.get("budget_tokens", 100_000)

        staker_budgets[context_hash_hex] = {
            "anthropic_key": body.get("anthropic_key", ""),
            "openai_key": body.get("openai_key", ""),
            "budget_tokens": budget_tokens,
            "used_tokens": 0,
        }

        # Store in bounty feed so solvers can see it
        import time
        apikey_bounties[context_hash_hex] = {
            "repo": repo,
            "commit": commit[:8],
            "check_name": check_name,
            "budget_tokens": budget_tokens,
            "budget_used": 0,
            "solver_agent_id": 0,
            "resolved": False,
            "owner": body.get("owner", ""),
            "created_at": int(time.time()),
        }

        return jsonify({
            "context_hash": context_hash_hex,
            "status": "created",
            "budget_mode": "api_key",
            "budget_tokens": budget_tokens,
        }), 201

    elif budget_mode == "eurc":
        if not ESCROW:
            return jsonify({"error": "escrow not configured"}), 500

        amount = body.get("amount_eurc", 5_000_000)
        deadline = w3.eth.block_number + 1000
        uri = f"github:{repo}:{commit[:8]}:{check_name}"

        data = "0x" + (
            sig("create_bounty(bytes32,uint256,uint256,string)")
            + encode(
                ["bytes32", "uint256", "uint256", "string"],
                [context_hash, amount, deadline, uri],
            )
        ).hex()

        try:
            result = send_tx(ESCROW, data)
            return jsonify({
                "context_hash": context_hash_hex,
                "status": "created",
                "budget_mode": "eurc",
                "amount_eurc": amount,
                "deadline_block": deadline,
                **result,
            }), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "budget_mode must be api_key or eurc"}), 400


@bounties_bp.route("/bounties/<context_hash>/claim", methods=["POST"])
def claim_bounty(context_hash: str):
    """
    Solver claims a bounty.
    Body: { "agent_id": 1 }
    Returns a bnet_token for inference proxy auth.
    """
    body = request.json or {}
    agent_id = body.get("agent_id")
    if not agent_id:
        return jsonify({"error": "agent_id required"}), 400

    # Check API-key-mode bounties first
    ab = apikey_bounties.get(context_hash)
    if ab:
        if ab.get("solver_agent_id", 0) != 0:
            return jsonify({"error": "already claimed"}), 409
        if ab.get("resolved"):
            return jsonify({"error": "bounty is closed"}), 410

        ab["solver_agent_id"] = int(agent_id)
        bnet_token = f"bnet_{agent_id}:{context_hash}"

        from gateway.routes.inference import credits
        budget = ab.get("budget_tokens", 100_000)
        credit_amount = int(budget * 0.7)
        credits[int(agent_id)] = credits.get(int(agent_id), {"total": 0, "used": 0})
        credits[int(agent_id)]["total"] += credit_amount

        return jsonify({
            "status": "claimed",
            "context_hash": context_hash,
            "agent_id": agent_id,
            "bnet_token": bnet_token,
            "inference_endpoint": "https://gateway.stare.network/v1/messages",
            "budget_remaining": budget,
            "budget_mode": "api_key",
        })

    # On-chain EURC bounty
    if not ESCROW:
        return jsonify({"error": "bounty not found"}), 404

    ctx = bytes.fromhex(context_hash[2:] if context_hash.startswith("0x") else context_hash)

    bounty = get_bounty(ctx)
    if not bounty:
        return jsonify({"error": "bounty not found"}), 404
    if bounty["solver_agent_id"] != 0:
        return jsonify({"error": "already claimed"}), 409
    if bounty["resolved"] or bounty["cancelled"]:
        return jsonify({"error": "bounty is closed"}), 410

    data = "0x" + (
        sig("claim_intent(bytes32,uint256)")
        + encode(["bytes32", "uint256"], [ctx, int(agent_id)])
    ).hex()

    try:
        result = send_tx(ESCROW, data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    bnet_token = f"bnet_{agent_id}:{context_hash}"

    from gateway.routes.inference import credits
    credit_amount = int(bounty["amount"] * 0.7)
    credits[int(agent_id)] = credits.get(int(agent_id), {"total": 0, "used": 0})
    credits[int(agent_id)]["total"] += credit_amount

    return jsonify({
        "status": "claimed",
        "context_hash": context_hash,
        "agent_id": agent_id,
        "bnet_token": bnet_token,
        "inference_endpoint": "https://gateway.stare.network/v1/messages",
        "budget_remaining": bounty["amount"],
        "budget_mode": "eurc",
        **result,
    })
