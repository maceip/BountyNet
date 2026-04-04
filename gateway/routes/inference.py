"""
Inference proxy — uses LiteLLM for multi-provider routing + key pooling.

LiteLLM handles: provider detection, format conversion, error handling, retries.
We handle: auth, bounty metering, key resolution.

Key pool:
  - Staker keys (deposited per bounty via /budget/deposit)
  - Solver keys (deposited on join)
  - Platform keys (fallback)

When bounty is active → staker's key. Otherwise → solver's key or platform key.

Endpoints:
  POST /v1/messages          — Anthropic format
  POST /v1/chat/completions  — OpenAI format
  POST /budget/deposit       — deposit API key + budget
  GET  /budget/<context_hash>
  GET  /credits/<agent_id>
"""
import os
import json
from flask import Blueprint, request, jsonify
import litellm
from gateway.chain import get_bounty

inference_bp = Blueprint("inference", __name__)

# Platform fallback keys
PLATFORM_KEYS = {
    "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
    "openai": os.environ.get("OPENAI_API_KEY", ""),
}

# Key pools
# context_hash → { anthropic_key, openai_key, budget_tokens, used_tokens }
staker_budgets: dict = {}
# agent_id → { anthropic_key, openai_key }
solver_keys: dict = {}
# agent_id → { total, used }
credits: dict = {}


# ── Key deposit ─────────────────────────────────────────────────

@inference_bp.route("/budget/deposit", methods=["POST"])
def deposit():
    body = request.json or {}
    ctx = body.get("context_hash")
    if ctx:
        staker_budgets[ctx] = {
            "anthropic_key": body.get("anthropic_key", ""),
            "openai_key": body.get("openai_key", ""),
            "budget_tokens": body.get("budget_tokens", 100_000),
            "used_tokens": 0,
        }
        return jsonify({"status": "deposited", "type": "staker", "context_hash": ctx})

    agent_id = body.get("agent_id")
    if agent_id:
        solver_keys[int(agent_id)] = {
            "anthropic_key": body.get("anthropic_key", ""),
            "openai_key": body.get("openai_key", ""),
        }
        return jsonify({"status": "deposited", "type": "solver", "agent_id": agent_id})

    return jsonify({"error": "context_hash or agent_id required"}), 400


@inference_bp.route("/budget/<context_hash>")
def check_budget(context_hash):
    b = staker_budgets.get(context_hash)
    if not b:
        return jsonify({"error": "no budget"}), 404
    return jsonify({"budget": b["budget_tokens"], "used": b["used_tokens"], "remaining": b["budget_tokens"] - b["used_tokens"]})


@inference_bp.route("/credits/<int:agent_id>")
def agent_credits(agent_id):
    c = credits.get(agent_id, {"total": 0, "used": 0})
    return jsonify({"agent_id": agent_id, **c, "remaining": c["total"] - c["used"]})


# ── Key resolution ──────────────────────────────────────────────

def resolve_api_key(agent_id: int, ctx_hash: str, provider: str) -> tuple[str, str]:
    """
    Returns (api_key, source).
    Priority: staker's key > solver's key > platform key.
    """
    # Staker's key for this bounty
    budget = staker_budgets.get(ctx_hash)
    if budget and budget.get(f"{provider}_key"):
        return budget[f"{provider}_key"], "staker"

    # Solver's deposited key
    sk = solver_keys.get(agent_id)
    if sk and sk.get(f"{provider}_key"):
        return sk[f"{provider}_key"], "solver"

    # Platform fallback
    return PLATFORM_KEYS.get(provider, ""), "platform"


def detect_provider(model: str) -> str:
    if "claude" in model.lower() or "anthropic" in model.lower():
        return "anthropic"
    return "openai"


def meter(agent_id, ctx_hash, input_t, output_t):
    from gateway.events import emit
    total = input_t + output_t
    budget = staker_budgets.get(ctx_hash)
    if budget:
        budget["used_tokens"] += total
    if agent_id in credits:
        credits[agent_id]["used"] += total
    if total > 0:
        remaining = budget["budget_tokens"] - budget["used_tokens"] if budget else 0
        emit("inference", f"Agent #{agent_id}: {total:,} tokens used ({remaining:,} remaining)",
             context_hash=ctx_hash, agent_id=agent_id, data={"tokens": total, "remaining": remaining})
    return total


# ── Auth ────────────────────────────────────────────────────────

def parse_token(auth):
    for pfx in ["Bearer bnet_", "bnet_"]:
        if auth.startswith(pfx):
            try:
                a, c = auth[len(pfx):].split(":", 1)
                return int(a), c
            except (ValueError, IndexError):
                pass
    return None


# ── Unified completion endpoint ─────────────────────────────────

def do_completion(messages, model, agent_id, ctx_hash):
    provider = detect_provider(model)
    api_key, source = resolve_api_key(agent_id, ctx_hash, provider)

    if not api_key:
        return {"error": f"no {provider} key available"}, 500

    try:
        response = litellm.completion(
            model=model,
            messages=messages,
            api_key=api_key,
        )

        usage = response.usage
        cost = meter(agent_id, ctx_hash, usage.prompt_tokens or 0, usage.completion_tokens or 0)

        result = response.model_dump()
        result["_bountynet"] = {
            "cost_tokens": cost,
            "key_source": source,
            "agent_id": agent_id,
        }
        return result, 200

    except Exception as e:
        return {"error": str(e)}, 502


# ── OpenAI-compatible ───────────────────────────────────────────

@inference_bp.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    auth = request.headers.get("Authorization", "")
    bnet = parse_token(auth)
    if not bnet:
        return jsonify({"error": {"message": "Bearer bnet_<agent>:<context> required"}}), 401

    agent_id, ctx_hash = bnet
    body = request.json
    result, status = do_completion(
        messages=body.get("messages", []),
        model=body.get("model", "gpt-4o"),
        agent_id=agent_id,
        ctx_hash=ctx_hash,
    )
    return jsonify(result), status


# ── Anthropic-compatible ────────────────────────────────────────

@inference_bp.route("/v1/messages", methods=["POST"])
def anthropic_messages():
    auth = request.headers.get("Authorization", "") or request.headers.get("x-api-key", "")
    bnet = parse_token(auth)
    if not bnet:
        return jsonify({"error": "auth required", "type": "authentication_error"}), 401

    agent_id, ctx_hash = bnet
    body = request.json

    # Convert Anthropic format to messages
    messages = body.get("messages", [])
    system = body.get("system", "")
    if system:
        messages = [{"role": "system", "content": system}] + messages

    result, status = do_completion(
        messages=messages,
        model=body.get("model", "claude-sonnet-4-20250514"),
        agent_id=agent_id,
        ctx_hash=ctx_hash,
    )

    if status == 200:
        # Convert back to Anthropic format
        choice = result.get("choices", [{}])[0]
        return jsonify({
            "id": result.get("id"),
            "type": "message",
            "role": "assistant",
            "model": body.get("model"),
            "content": [{"type": "text", "text": choice.get("message", {}).get("content", "")}],
            "stop_reason": choice.get("finish_reason", "end_turn"),
            "usage": {
                "input_tokens": result.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": result.get("usage", {}).get("completion_tokens", 0),
            },
            "_bountynet": result.get("_bountynet"),
        })

    return jsonify(result), status
