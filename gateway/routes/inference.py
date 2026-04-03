"""
Inference proxy — routes solver LLM calls through staker's API key.

Two modes:
  1. API key budget: Joe deposits his Anthropic/OpenAI key + token budget.
     Vishy's solver calls go through Joe's key. Joe never sees Vishy's prompts.
  2. EURC escrow: staker locked EURC on-chain. Proxy uses platform key.

Auth: Bearer bnet_<agent_id>:<context_hash>

Endpoints:
  POST /v1/messages          — Anthropic
  POST /v1/chat/completions  — OpenAI
  POST /budget/deposit       — Joe deposits API key + budget
  GET  /budget/<context_hash> — check remaining budget
  GET  /credits/<agent_id>   — solver's earned credits
"""
import os
from flask import Blueprint, request, jsonify, Response
import requests as http
from gateway.chain import get_bounty

inference_bp = Blueprint("inference", __name__)

# Platform fallback keys (used when staker pays EURC, not API key)
PLATFORM_ANTHROPIC = os.environ.get("ANTHROPIC_API_KEY", "")
PLATFORM_OPENAI = os.environ.get("OPENAI_API_KEY", "")

PRICING = {
    "claude-sonnet-4-20250514": {"input": 3_000_000, "output": 15_000_000},
    "claude-haiku-3-5-20241022": {"input": 800_000, "output": 4_000_000},
    "gpt-4o": {"input": 2_500_000, "output": 10_000_000},
    "gpt-4o-mini": {"input": 150_000, "output": 600_000},
    "default": {"input": 3_000_000, "output": 15_000_000},
}

# ── Budget store ────────────────────────────────────────────────
# context_hash → { anthropic_key, openai_key, budget_tokens, used_tokens, staker }
budgets: dict = {}

# agent_id → { total, used } (for EURC escrow mode)
credits: dict = {}


# ── Budget management (Joe's path) ─────────────────────────────

@inference_bp.route("/budget/deposit", methods=["POST"])
def deposit_budget():
    """
    Joe deposits his API key and sets a token budget for a bounty.
    Body: {
        "context_hash": "0x...",
        "anthropic_key": "sk-ant-...",  (optional)
        "openai_key": "sk-...",         (optional)
        "budget_tokens": 100000,
        "staker": "github:joe"
    }
    """
    body = request.json or {}
    ctx = body.get("context_hash")
    if not ctx:
        return jsonify({"error": "context_hash required"}), 400
    if not body.get("anthropic_key") and not body.get("openai_key"):
        return jsonify({"error": "at least one API key required"}), 400

    budgets[ctx] = {
        "anthropic_key": body.get("anthropic_key", ""),
        "openai_key": body.get("openai_key", ""),
        "budget_tokens": body.get("budget_tokens", 100_000),
        "used_tokens": 0,
        "staker": body.get("staker", ""),
    }

    return jsonify({"status": "deposited", "context_hash": ctx, "budget": budgets[ctx]["budget_tokens"]})


@inference_bp.route("/budget/<context_hash>")
def check_budget(context_hash):
    b = budgets.get(context_hash)
    if not b:
        return jsonify({"error": "no budget"}), 404
    return jsonify({
        "context_hash": context_hash,
        "budget_tokens": b["budget_tokens"],
        "used_tokens": b["used_tokens"],
        "remaining": b["budget_tokens"] - b["used_tokens"],
    })


@inference_bp.route("/credits/<int:agent_id>")
def agent_credits(agent_id):
    c = credits.get(agent_id)
    if not c:
        return jsonify({"agent_id": agent_id, "total": 0, "used": 0, "remaining": 0})
    return jsonify({"agent_id": agent_id, **c, "remaining": c["total"] - c["used"]})


# ── Key resolution ──────────────────────────────────────────────

def resolve_keys(ctx_hash: str) -> tuple[str, str, dict | None]:
    """
    Resolve which API keys to use for this bounty.
    Returns (anthropic_key, openai_key, budget_or_none)
    """
    budget = budgets.get(ctx_hash)
    if budget:
        return budget["anthropic_key"] or PLATFORM_ANTHROPIC, budget["openai_key"] or PLATFORM_OPENAI, budget
    return PLATFORM_ANTHROPIC, PLATFORM_OPENAI, None


def check_and_deduct(budget: dict | None, agent_id: int, model: str, input_t: int, output_t: int) -> int:
    """Deduct tokens from budget (API key mode) or credits (EURC mode)."""
    total = input_t + output_t

    if budget:
        budget["used_tokens"] += total
        return total

    # EURC mode
    p = PRICING.get(model, PRICING["default"])
    cost = (input_t * p["input"] + output_t * p["output"]) // 1_000_000
    if agent_id in credits:
        credits[agent_id]["used"] += cost
    return cost


# ── Auth ────────────────────────────────────────────────────────

def parse_token(auth: str):
    for prefix in ["Bearer bnet_", "bnet_"]:
        if auth.startswith(prefix):
            try:
                t = auth[len(prefix):]
                a, c = t.split(":", 1)
                return int(a), c
            except (ValueError, IndexError):
                pass
    return None


def init_credits(agent_id, ctx_hash):
    if agent_id not in credits:
        ctx = bytes.fromhex(ctx_hash[2:] if ctx_hash.startswith("0x") else ctx_hash)
        bounty = get_bounty(ctx)
        if bounty:
            credits[agent_id] = {"total": bounty["amount"] * 70 // 100, "used": 0}


def remaining(agent_id, ctx_hash, budget):
    if budget:
        return budget["budget_tokens"] - budget["used_tokens"]
    if agent_id in credits:
        return credits[agent_id]["total"] - credits[agent_id]["used"]
    return 0


# ── Anthropic endpoint ──────────────────────────────────────────

@inference_bp.route("/v1/messages", methods=["POST"])
def anthropic():
    auth = request.headers.get("Authorization", "") or request.headers.get("x-api-key", "")
    bnet = parse_token(auth)

    if not bnet:
        return jsonify({"error": "auth required: Bearer bnet_<agent>:<context>"}), 401

    agent_id, ctx_hash = bnet
    anthropic_key, _, budget = resolve_keys(ctx_hash)

    if not budget:
        init_credits(agent_id, ctx_hash)

    if remaining(agent_id, ctx_hash, budget) <= 0:
        return jsonify({"error": "budget exhausted", "type": "rate_limit_error"}), 429

    if not anthropic_key:
        return jsonify({"error": "no anthropic key configured for this bounty"}), 500

    body = request.json
    resp = http.post("https://api.anthropic.com/v1/messages", headers={
        "x-api-key": anthropic_key,
        "anthropic-version": request.headers.get("anthropic-version", "2023-06-01"),
        "content-type": "application/json",
    }, json=body)

    if resp.status_code == 200:
        data = resp.json()
        u = data.get("usage", {})
        cost = check_and_deduct(budget, agent_id, body.get("model", ""), u.get("input_tokens", 0), u.get("output_tokens", 0))
        data["_bountynet"] = {"cost": cost, "remaining": remaining(agent_id, ctx_hash, budget), "mode": "api_key" if budget else "eurc"}
        return jsonify(data)

    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))


# ── OpenAI endpoint ─────────────────────────────────────────────

@inference_bp.route("/v1/chat/completions", methods=["POST"])
def openai():
    auth = request.headers.get("Authorization", "")
    bnet = parse_token(auth)

    if not bnet:
        return jsonify({"error": {"message": "auth required"}}), 401

    agent_id, ctx_hash = bnet
    _, openai_key, budget = resolve_keys(ctx_hash)

    if not budget:
        init_credits(agent_id, ctx_hash)

    if remaining(agent_id, ctx_hash, budget) <= 0:
        return jsonify({"error": {"message": "budget exhausted"}}), 429

    if not openai_key:
        return jsonify({"error": {"message": "no openai key for this bounty"}}), 500

    body = request.json
    resp = http.post("https://api.openai.com/v1/chat/completions", headers={
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json",
    }, json=body)

    if resp.status_code == 200:
        data = resp.json()
        u = data.get("usage", {})
        cost = check_and_deduct(budget, agent_id, body.get("model", ""), u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
        data["_bountynet"] = {"cost": cost, "remaining": remaining(agent_id, ctx_hash, budget), "mode": "api_key" if budget else "eurc"}
        return jsonify(data)

    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))
