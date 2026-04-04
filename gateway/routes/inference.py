"""
Inference proxy — meters solver LLM calls against staker's deposited API key.

No external dependency. No middleman. Direct to provider.

Key resolution:
  1. Staker deposited their Anthropic/OpenAI key → route direct to that provider
  2. Platform key → BountyNet's own key, metered against EURC escrow

The proxy:
  - Accepts OpenAI-compatible and Anthropic-compatible requests
  - Detects provider from model name (claude* → Anthropic, gpt* → OpenAI)
  - Uses the staker's key for that provider
  - Meters tokens, deducts from budget
  - Returns response with _bountynet metadata

Endpoints:
  POST /v1/messages          — Anthropic format
  POST /v1/chat/completions  — OpenAI format
  POST /budget/deposit       — staker deposits key + budget
  GET  /budget/<context_hash>
  GET  /credits/<agent_id>
"""
import os
from flask import Blueprint, request, jsonify, Response
import requests as http
from gateway.chain import get_bounty

inference_bp = Blueprint("inference", __name__)

PLATFORM_ANTHROPIC = os.environ.get("ANTHROPIC_API_KEY", "")
PLATFORM_OPENAI = os.environ.get("OPENAI_API_KEY", "")

PROVIDERS = {
    "anthropic": "https://api.anthropic.com/v1/messages",
    "openai": "https://api.openai.com/v1/chat/completions",
}

budgets: dict = {}
credits: dict = {}


# ── Budget ──────────────────────────────────────────────────────

@inference_bp.route("/budget/deposit", methods=["POST"])
def deposit():
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
    }
    return jsonify({"status": "deposited", "context_hash": ctx, "budget": budgets[ctx]["budget_tokens"]})


@inference_bp.route("/budget/<context_hash>")
def check_budget(context_hash):
    b = budgets.get(context_hash)
    if not b:
        return jsonify({"error": "no budget"}), 404
    return jsonify({"budget": b["budget_tokens"], "used": b["used_tokens"], "remaining": b["budget_tokens"] - b["used_tokens"]})


@inference_bp.route("/credits/<int:agent_id>")
def agent_credits(agent_id):
    c = credits.get(agent_id, {"total": 0, "used": 0})
    return jsonify({"agent_id": agent_id, **c, "remaining": c["total"] - c["used"]})


# ── Internals ───────────────────────────────────────────────────

def parse_token(auth):
    for pfx in ["Bearer bnet_", "bnet_"]:
        if auth.startswith(pfx):
            try:
                a, c = auth[len(pfx):].split(":", 1)
                return int(a), c
            except (ValueError, IndexError):
                pass
    return None


def detect_provider(model: str) -> str:
    if "claude" in model.lower():
        return "anthropic"
    return "openai"


def get_key(ctx_hash: str, provider: str) -> tuple[str, dict | None]:
    budget = budgets.get(ctx_hash)
    if budget:
        key = budget.get(f"{provider}_key", "")
        if key:
            return key, budget
    # Fallback to platform key
    if provider == "anthropic":
        return PLATFORM_ANTHROPIC, budget
    return PLATFORM_OPENAI, budget


def meter(budget, agent_id, input_t, output_t):
    total = input_t + output_t
    if budget:
        budget["used_tokens"] += total
    if agent_id in credits:
        credits[agent_id]["used"] += total
    return total


def budget_remaining(agent_id, ctx_hash, budget):
    if budget:
        return budget["budget_tokens"] - budget["used_tokens"]
    c = credits.get(agent_id)
    return (c["total"] - c["used"]) if c else 0


def init_credits(agent_id, ctx_hash):
    if agent_id not in credits:
        ctx = bytes.fromhex(ctx_hash[2:] if ctx_hash.startswith("0x") else ctx_hash)
        bounty = get_bounty(ctx)
        if bounty:
            credits[agent_id] = {"total": bounty["amount"] * 70 // 100, "used": 0}


def check_auth():
    auth = request.headers.get("Authorization", "") or request.headers.get("x-api-key", "")
    bnet = parse_token(auth)
    if not bnet:
        return None, None, None, None
    agent_id, ctx_hash = bnet
    budget = budgets.get(ctx_hash)
    if not budget:
        init_credits(agent_id, ctx_hash)
    return agent_id, ctx_hash, budget, budget_remaining(agent_id, ctx_hash, budget)


# ── OpenAI-compatible ───────────────────────────────────────────

@inference_bp.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    agent_id, ctx_hash, budget, rem = check_auth()
    if agent_id is None:
        return jsonify({"error": {"message": "Bearer bnet_<agent>:<context> required"}}), 401
    if rem <= 0:
        return jsonify({"error": {"message": "budget exhausted"}}), 429

    body = request.json
    model = body.get("model", "gpt-4o")
    provider = detect_provider(model)
    key, budget = get_key(ctx_hash, provider)

    if not key:
        return jsonify({"error": {"message": f"no {provider} key for this bounty"}}), 500

    if provider == "anthropic":
        # Convert OpenAI format → Anthropic, call direct, convert back
        messages = body.get("messages", [])
        system = next((m["content"] for m in messages if m["role"] == "system"), None)
        user_msgs = [m for m in messages if m["role"] != "system"]
        a_body = {"model": model, "max_tokens": body.get("max_tokens", 4096), "messages": user_msgs}
        if system:
            a_body["system"] = system

        resp = http.post(PROVIDERS["anthropic"], headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
        }, json=a_body)

        if resp.status_code == 200:
            data = resp.json()
            u = data.get("usage", {})
            cost = meter(budget, agent_id, u.get("input_tokens", 0), u.get("output_tokens", 0))
            return jsonify({
                "id": data.get("id"), "object": "chat.completion", "model": model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": data["content"][0]["text"]}, "finish_reason": data.get("stop_reason", "stop")}],
                "usage": {"prompt_tokens": u.get("input_tokens", 0), "completion_tokens": u.get("output_tokens", 0)},
                "_bountynet": {"cost": cost, "remaining": budget_remaining(agent_id, ctx_hash, budget)},
            })
        return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))

    # OpenAI direct
    resp = http.post(PROVIDERS["openai"], headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
    }, json=body)

    if resp.status_code == 200:
        data = resp.json()
        u = data.get("usage", {})
        cost = meter(budget, agent_id, u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
        data["_bountynet"] = {"cost": cost, "remaining": budget_remaining(agent_id, ctx_hash, budget)}
        return jsonify(data)
    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))


# ── Anthropic-compatible ────────────────────────────────────────

@inference_bp.route("/v1/messages", methods=["POST"])
def anthropic_messages():
    agent_id, ctx_hash, budget, rem = check_auth()
    if agent_id is None:
        return jsonify({"error": "auth required", "type": "authentication_error"}), 401
    if rem <= 0:
        return jsonify({"error": "budget exhausted", "type": "rate_limit_error"}), 429

    body = request.json
    model = body.get("model", "")
    key, budget = get_key(ctx_hash, "anthropic")

    if not key:
        return jsonify({"error": "no anthropic key", "type": "authentication_error"}), 500

    resp = http.post(PROVIDERS["anthropic"], headers={
        "x-api-key": key,
        "anthropic-version": request.headers.get("anthropic-version", "2023-06-01"),
        "content-type": "application/json",
    }, json=body)

    if resp.status_code == 200:
        data = resp.json()
        u = data.get("usage", {})
        cost = meter(budget, agent_id, u.get("input_tokens", 0), u.get("output_tokens", 0))
        data["_bountynet"] = {"cost": cost, "remaining": budget_remaining(agent_id, ctx_hash, budget)}
        return jsonify(data)
    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))
