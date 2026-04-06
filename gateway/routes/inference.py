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
import time as time_module
from flask import Blueprint, request, jsonify
import litellm
from gateway import store

inference_bp = Blueprint("inference", __name__)

PLATFORM_KEYS = {
    "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
    "openai": os.environ.get("OPENAI_API_KEY", ""),
}

_INFERENCE_LOG_CAP = 2000


@inference_bp.route("/budget/deposit", methods=["POST"])
def deposit():
    body = request.json or {}
    ctx = body.get("context_hash")
    if ctx:
        store.staker_budget_put(
            ctx,
            body.get("anthropic_key", ""),
            body.get("openai_key", ""),
            body.get("budget_tokens", 100_000),
            0,
        )
        return jsonify({"status": "deposited", "type": "staker", "context_hash": ctx})

    agent_id = body.get("agent_id")
    if agent_id:
        store.solver_keys_put(
            int(agent_id),
            body.get("anthropic_key", ""),
            body.get("openai_key", ""),
        )
        return jsonify({"status": "deposited", "type": "solver", "agent_id": agent_id})

    return jsonify({"error": "context_hash or agent_id required"}), 400


@inference_bp.route("/budget/<context_hash>")
def check_budget(context_hash):
    b = store.staker_budget_get(context_hash)
    if not b:
        return jsonify({"error": "no budget"}), 404
    return jsonify({
        "budget": b["budget_tokens"],
        "used": b["used_tokens"],
        "remaining": b["budget_tokens"] - b["used_tokens"],
    })


@inference_bp.route("/credits/<int:agent_id>")
def agent_credits(agent_id):
    c = store.credits_get(agent_id)
    return jsonify({"agent_id": agent_id, **c, "remaining": c["total"] - c["used"]})


def resolve_api_key(agent_id: int, ctx_hash: str, provider: str) -> tuple[str, str]:
    budget = store.staker_budget_get(ctx_hash)
    if budget and budget.get(f"{provider}_key"):
        return budget[f"{provider}_key"], "staker"

    sk = store.solver_keys_get(agent_id)
    if sk and sk.get(f"{provider}_key"):
        return sk[f"{provider}_key"], "solver"

    return PLATFORM_KEYS.get(provider, ""), "platform"


def detect_provider(model: str) -> str:
    if "claude" in model.lower() or "anthropic" in model.lower():
        return "anthropic"
    return "openai"


def meter(agent_id, ctx_hash, input_t, output_t, model="", key_source=""):
    from gateway.events import emit

    total = input_t + output_t
    if store.staker_budget_get(ctx_hash):
        store.staker_budget_add_used(ctx_hash, total)
    cr = store.credits_get(agent_id)
    if cr["total"] > 0 or cr["used"] > 0:
        store.credits_add_used(agent_id, total)

    if total > 0:
        budget = store.staker_budget_get(ctx_hash)
        remaining = (
            budget["budget_tokens"] - budget["used_tokens"] if budget else 0
        )
        store.inference_append({
            "agent_id": agent_id,
            "context_hash": ctx_hash,
            "model": model,
            "tokens_in": input_t,
            "tokens_out": output_t,
            "tokens_total": total,
            "key_source": key_source,
            "timestamp": time_module.time(),
        })
        store.inference_prune(_INFERENCE_LOG_CAP)
        emit(
            "inference",
            f"Agent #{agent_id}: {total:,} tokens used ({remaining:,} remaining)",
            context_hash=ctx_hash,
            agent_id=agent_id,
            data={"tokens": total, "remaining": remaining},
        )
    return total


def parse_token(auth):
    for pfx in ["Bearer bnet_", "bnet_"]:
        if auth.startswith(pfx):
            try:
                a, c = auth[len(pfx):].split(":", 1)
                return int(a), c
            except (ValueError, IndexError):
                pass
    return None


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
        cost = meter(
            agent_id,
            ctx_hash,
            usage.prompt_tokens or 0,
            usage.completion_tokens or 0,
            model=model,
            key_source=source,
        )

        result = response.model_dump()
        result["_bountynet"] = {
            "cost_tokens": cost,
            "key_source": source,
            "agent_id": agent_id,
        }
        return result, 200

    except Exception as e:
        return {"error": str(e)}, 502


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


@inference_bp.route("/v1/messages", methods=["POST"])
def anthropic_messages():
    auth = request.headers.get("Authorization", "") or request.headers.get("x-api-key", "")
    bnet = parse_token(auth)
    if not bnet:
        return jsonify({"error": "auth required", "type": "authentication_error"}), 401

    agent_id, ctx_hash = bnet
    body = request.json

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


@inference_bp.route("/sessions")
def sessions():
    """
    Group inference calls into sessions by context_hash.
    Each session = one bounty claim = one coding thread.
    Stripe-style: newest first, expandable rows.
    """
    from gateway.routes.resources import tokens_to_eurc

    agent_filter = request.args.get("agent_id")
    limit = int(request.args.get("limit", 20))

    inference_log = store.inference_recent(800)

    grouped: dict = {}
    for call in inference_log:
        ctx = call.get("context_hash", "none")
        if agent_filter and str(call.get("agent_id")) != agent_filter:
            continue
        if ctx not in grouped:
            grouped[ctx] = {
                "context_hash": ctx,
                "agent_id": call.get("agent_id"),
                "model": call.get("model", ""),
                "key_source": call.get("key_source", ""),
                "calls": 0,
                "tokens_total": 0,
                "tokens_in": 0,
                "tokens_out": 0,
                "first_call": call.get("timestamp", 0),
                "last_call": call.get("timestamp", 0),
                "status": "active",
            }
        s = grouped[ctx]
        s["calls"] += 1
        s["tokens_total"] += call.get("tokens_total", 0)
        s["tokens_in"] += call.get("tokens_in", 0)
        s["tokens_out"] += call.get("tokens_out", 0)
        s["last_call"] = max(s["last_call"], call.get("timestamp", 0))
        s["model"] = call.get("model", s["model"])
        s["key_source"] = call.get("key_source", s["key_source"])

    for ctx, s in grouped.items():
        bounty = store.apikey_bounty_get(ctx) or {}
        s["repo"] = bounty.get("repo", "")
        s["check_name"] = bounty.get("check_name", "")
        s["budget_tokens"] = bounty.get("budget_tokens", 0)
        s["budget_used"] = s["tokens_total"]
        s["budget_remaining"] = max(0, s["budget_tokens"] - s["tokens_total"])
        if bounty.get("resolved"):
            s["status"] = "resolved"
        elif s["budget_remaining"] <= 0 and s["budget_tokens"] > 0:
            s["status"] = "exhausted"
        s["cost_eurc"] = tokens_to_eurc(s["tokens_total"], s["model"])
        s["duration_s"] = round(s["last_call"] - s["first_call"])

    sessions_list = sorted(grouped.values(), key=lambda s: s["last_call"], reverse=True)[:limit]

    return jsonify({
        "sessions": sessions_list,
        "count": len(sessions_list),
        "total_calls": len(inference_log),
    })
