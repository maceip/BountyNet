"""
Resource Claims + Compute Credits — staked infra marketplace.

POST /resources/stake     — mint Resource Claim NFT (XL instance or API key)
GET  /resources           — list all staked resources
GET  /resources/{id}      — single resource status
GET  /credits/rates       — inference pricing table (tokens → EURC)
"""
import os
from flask import Blueprint, request, jsonify
from eth_utils import keccak
from eth_abi import encode, decode
from gateway.chain import w3, send_tx, sig, call
from gateway.events import emit

resources_bp = Blueprint("resources", __name__)

RESOURCE_CLAIM = os.environ.get("RESOURCE_CLAIM", "0x3E1cd5Cc87783fBAD7b1f0094ae107506de315e4")

# ── Credit rates (tokens → USD → EURC) ────────────────────────

RATES = {
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00, "unit": "per 1M tokens"},
    "claude-opus-4-20250514": {"input": 15.00, "output": 75.00, "unit": "per 1M tokens"},
    "claude-haiku-4-20250514": {"input": 0.80, "output": 4.00, "unit": "per 1M tokens"},
    "gpt-4o": {"input": 2.50, "output": 10.00, "unit": "per 1M tokens"},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60, "unit": "per 1M tokens"},
}

# Instance pricing ($/hour)
INSTANCE_RATES = {
    "c6i.8xlarge": {"cores": 32, "memory_gb": 64, "usd_hour": 1.36, "provider": "aws"},
    "c6i.16xlarge": {"cores": 64, "memory_gb": 128, "usd_hour": 2.72, "provider": "aws"},
    "r6i.8xlarge": {"cores": 32, "memory_gb": 256, "usd_hour": 2.016, "provider": "aws"},
    "r6i.16xlarge": {"cores": 64, "memory_gb": 512, "usd_hour": 4.032, "provider": "aws"},
    "c7g.8xlarge": {"cores": 32, "memory_gb": 64, "usd_hour": 1.16, "provider": "aws"},
    "Standard_D32s_v5": {"cores": 32, "memory_gb": 128, "usd_hour": 1.536, "provider": "azure"},
    "n2-highcpu-32": {"cores": 32, "memory_gb": 32, "usd_hour": 1.13, "provider": "gcp"},
}

USD_TO_EURC = 0.92  # approximate


def tokens_to_eurc(tokens: int, model: str = "claude-sonnet-4-20250514") -> float:
    rate = RATES.get(model, RATES["claude-sonnet-4-20250514"])
    avg_rate = (rate["input"] + rate["output"]) / 2
    usd = (tokens / 1_000_000) * avg_rate
    return round(usd * USD_TO_EURC, 4)


# ── Endpoints ──────────────────────────────────────────────────

@resources_bp.route("/resources/stake", methods=["POST"])
def stake():
    """
    Mint a Resource Claim NFT.
    Body: {
        "resource_type": 1,          // 0=api_key, 1=xl_instance, 2=gpu
        "provider": "aws",
        "spec": "c6i.8xlarge",
        "cores": 32,
        "memory_gb": 64,
        "token_budget": 500000,
        "duration_hours": 24
    }
    """
    body = request.json or {}
    resource_type = body.get("resource_type", 0)
    provider = body.get("provider", "anthropic")
    spec = body.get("spec", "api_key")
    cores = body.get("cores", 0)
    memory_gb = body.get("memory_gb", 0)
    token_budget = body.get("token_budget", 100000)
    duration_hours = body.get("duration_hours", 24)

    if not RESOURCE_CLAIM:
        return jsonify({"error": "resource claim contract not configured"}), 500

    data = "0x" + (
        sig("stake(uint8,string,string,uint256,uint256,uint256,uint256)")
        + encode(
            ["uint8", "string", "string", "uint256", "uint256", "uint256", "uint256"],
            [resource_type, provider, spec, cores, memory_gb, token_budget, duration_hours],
        )
    ).hex()

    try:
        result = send_tx(RESOURCE_CLAIM, data)
        eurc_value = tokens_to_eurc(token_budget)

        emit("bounty", f"Resource staked: {spec} ({cores} cores, {memory_gb}GB) — {token_budget:,} tokens (~{eurc_value} EURC)",
             data={"spec": spec, "provider": provider, "cores": cores, "budget": token_budget})

        return jsonify({
            "status": "staked",
            "resource_type": resource_type,
            "provider": provider,
            "spec": spec,
            "cores": cores,
            "memory_gb": memory_gb,
            "token_budget": token_budget,
            "eurc_equivalent": eurc_value,
            **result,
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@resources_bp.route("/resources")
def list_resources():
    """List all staked resources."""
    if not RESOURCE_CLAIM:
        return jsonify({"resources": []})

    try:
        count_data = call(RESOURCE_CLAIM, "0x" + sig("resource_count()").hex())
        count = int.from_bytes(count_data, "big")

        resources = []
        for i in range(1, min(count + 1, 50)):
            try:
                result = call(RESOURCE_CLAIM, "0x" + (
                    sig("get_resource(uint256)") + encode(["uint256"], [i])
                ).hex())

                # Decode the tuple
                decoded = decode(
                    ["address", "uint8", "string", "string", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "bool"],
                    result,
                )
                staker, rtype, provider, spec, cores, mem, budget, used, created, expires, active = decoded

                remaining_data = call(RESOURCE_CLAIM, "0x" + (
                    sig("remaining(uint256)") + encode(["uint256"], [i])
                ).hex())
                remaining = int.from_bytes(remaining_data, "big")

                resources.append({
                    "token_id": i,
                    "staker": staker,
                    "resource_type": ["api_key", "xl_instance", "gpu"][rtype] if rtype <= 2 else "unknown",
                    "provider": provider,
                    "spec": spec,
                    "cores": cores,
                    "memory_gb": mem,
                    "token_budget": budget,
                    "tokens_used": used,
                    "tokens_remaining": remaining,
                    "eurc_value": tokens_to_eurc(budget),
                    "eurc_remaining": tokens_to_eurc(remaining),
                    "active": active,
                    "usage_pct": round((used / budget * 100) if budget > 0 else 0, 1),
                })
            except Exception:
                pass

        return jsonify({"resources": resources, "count": len(resources)})
    except Exception as e:
        return jsonify({"resources": [], "error": str(e)})


@resources_bp.route("/resources/<int:token_id>")
def resource_detail(token_id: int):
    """Single resource status."""
    if not RESOURCE_CLAIM:
        return jsonify({"error": "not configured"}), 500

    try:
        result = call(RESOURCE_CLAIM, "0x" + (
            sig("get_resource(uint256)") + encode(["uint256"], [token_id])
        ).hex())

        decoded = decode(
            ["address", "uint8", "string", "string", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "bool"],
            result,
        )
        staker, rtype, provider, spec, cores, mem, budget, used, created, expires, active = decoded

        if staker == "0x" + "0" * 40:
            return jsonify({"error": "not found"}), 404

        remaining_data = call(RESOURCE_CLAIM, "0x" + (
            sig("remaining(uint256)") + encode(["uint256"], [token_id])
        ).hex())
        remaining = int.from_bytes(remaining_data, "big")

        return jsonify({
            "token_id": token_id,
            "staker": staker,
            "resource_type": ["api_key", "xl_instance", "gpu"][rtype] if rtype <= 2 else "unknown",
            "provider": provider,
            "spec": spec,
            "cores": cores,
            "memory_gb": mem,
            "token_budget": budget,
            "tokens_used": used,
            "tokens_remaining": remaining,
            "eurc_value": tokens_to_eurc(budget),
            "eurc_remaining": tokens_to_eurc(remaining),
            "usage_pct": round((used / budget * 100) if budget > 0 else 0, 1),
            "active": active,
            "instance_rate": INSTANCE_RATES.get(spec),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@resources_bp.route("/credits/rates")
def credit_rates():
    """Inference pricing table."""
    return jsonify({
        "models": RATES,
        "instances": INSTANCE_RATES,
        "usd_to_eurc": USD_TO_EURC,
        "examples": {
            "100k_tokens_sonnet": f"{tokens_to_eurc(100000)} EURC",
            "500k_tokens_sonnet": f"{tokens_to_eurc(500000)} EURC",
            "1M_tokens_sonnet": f"{tokens_to_eurc(1000000)} EURC",
            "c6i.8xlarge_24h": f"{round(INSTANCE_RATES['c6i.8xlarge']['usd_hour'] * 24 * USD_TO_EURC, 2)} EURC",
        },
    })
