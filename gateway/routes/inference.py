"""
Inference proxy — OpenRouter-compatible LLM gateway with credit billing.

POST /v1/messages           — Anthropic Messages API
POST /v1/chat/completions   — OpenAI Chat Completions API

Auth: Bearer bnet_<agent_id>:<context_hash>
"""
import os
from flask import Blueprint, request, jsonify, Response
import requests as http
from gateway.chain import get_bounty

inference_bp = Blueprint("inference", __name__)

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")

PRICING = {
    "claude-sonnet-4-20250514": {"input": 3_000_000, "output": 15_000_000},
    "gpt-4o": {"input": 2_500_000, "output": 10_000_000},
    "default": {"input": 3_000_000, "output": 15_000_000},
}

# In-memory credit ledger
credits: dict = {}


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


def check_credits(agent_id, ctx_hash):
    if agent_id not in credits:
        ctx = bytes.fromhex(ctx_hash[2:] if ctx_hash.startswith("0x") else ctx_hash)
        bounty = get_bounty(ctx)
        if not bounty:
            return 0
        credits[agent_id] = {"total": bounty["amount"] * 70 // 100, "used": 0}
    return credits[agent_id]["total"] - credits[agent_id]["used"]


def deduct(agent_id, model, input_t, output_t):
    p = PRICING.get(model, PRICING["default"])
    cost = (input_t * p["input"] + output_t * p["output"]) // 1_000_000
    if agent_id in credits:
        credits[agent_id]["used"] += cost
    return cost


@inference_bp.route("/v1/messages", methods=["POST"])
def anthropic():
    auth = request.headers.get("Authorization", "") or request.headers.get("x-api-key", "")
    bnet = parse_token(auth)

    if bnet and check_credits(*bnet) <= 0:
        return jsonify({"error": "credits exhausted", "type": "rate_limit_error"}), 429

    body = request.json
    resp = http.post("https://api.anthropic.com/v1/messages", headers={
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": request.headers.get("anthropic-version", "2023-06-01"),
        "content-type": "application/json",
    }, json=body)

    if resp.status_code == 200 and bnet:
        data = resp.json()
        u = data.get("usage", {})
        cost = deduct(bnet[0], body.get("model", ""), u.get("input_tokens", 0), u.get("output_tokens", 0))
        data["_bountynet"] = {"cost": cost, "remaining": check_credits(*bnet)}
        return jsonify(data)

    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))


@inference_bp.route("/v1/chat/completions", methods=["POST"])
def openai():
    auth = request.headers.get("Authorization", "")
    bnet = parse_token(auth)

    if bnet and check_credits(*bnet) <= 0:
        return jsonify({"error": {"message": "credits exhausted"}}), 429

    body = request.json
    resp = http.post("https://api.openai.com/v1/chat/completions", headers={
        "Authorization": f"Bearer {OPENAI_KEY}",
        "Content-Type": "application/json",
    }, json=body)

    if resp.status_code == 200 and bnet:
        data = resp.json()
        u = data.get("usage", {})
        cost = deduct(bnet[0], body.get("model", ""), u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
        data["_bountynet"] = {"cost": cost, "remaining": check_credits(*bnet)}
        return jsonify(data)

    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))
