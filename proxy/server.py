"""
BountyNet Inference Proxy — OpenRouter-compatible LLM gateway.

Drop-in replacement for Anthropic/OpenAI APIs. Accepts standard chat completion
requests but gates access on Proof of Intent (agent is working on a bounty).

Auth: Bearer bnet_<agent_id>:<bounty_context_hash>
  → proxy verifies agent is registered + bounty exists + not resolved
  → forwards to upstream LLM provider (Anthropic, OpenAI, etc.)
  → counts tokens, deducts from staker's escrowed credits
  → returns response

Compatible with:
  - Anthropic Messages API (/v1/messages)
  - OpenAI Chat Completions API (/v1/chat/completions)
  - OpenRouter format (/api/v1/chat/completions)

Usage:
  ANTHROPIC_BASE_URL=https://proxy.stare.network claude
  OPENAI_BASE_URL=https://proxy.stare.network cursor
"""
import os
import json
import time
import hashlib
from flask import Flask, request, jsonify, Response
import requests as http_requests
from web3 import Web3
from eth_utils import keccak
from eth_abi import encode

app = Flask(__name__)

# ── Config ──────────────────────────────────────────────────────

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
ARC_RPC = os.environ.get("QUICKNODE_ARC_HTTP", "https://rpc.testnet.arc.network")
ESCROW = os.environ.get("BOUNTY_ESCROW", "")
IDENTITY = os.environ.get("IDENTITY_REGISTRY", "")

# Token pricing (per 1M tokens, in EURC micros — 6 decimals)
PRICING = {
    "claude-sonnet-4-20250514": {"input": 3_000_000, "output": 15_000_000},
    "claude-haiku-3-5-20241022": {"input": 800_000, "output": 4_000_000},
    "gpt-4o": {"input": 2_500_000, "output": 10_000_000},
    "gpt-4o-mini": {"input": 150_000, "output": 600_000},
    "default": {"input": 3_000_000, "output": 15_000_000},
}

w3 = Web3(Web3.HTTPProvider(ARC_RPC))

# In-memory credit ledger (production: on-chain or redis)
# agent_id → { credits_remaining_micros, bounty_hashes }
credit_ledger: dict = {}

# ── Auth ────────────────────────────────────────────────────────

def parse_bnet_token(auth_header: str) -> tuple[int, str] | None:
    """
    Parse: Bearer bnet_<agent_id>:<context_hash>
    Returns (agent_id, context_hash) or None
    """
    if not auth_header.startswith("Bearer bnet_"):
        return None
    try:
        token = auth_header[len("Bearer bnet_"):]
        agent_str, ctx_hash = token.split(":", 1)
        return int(agent_str), ctx_hash
    except (ValueError, IndexError):
        return None


def verify_bounty_access(agent_id: int, context_hash: str) -> dict | None:
    """
    Verify on-chain:
    1. Agent is registered in IdentityRegistry
    2. Bounty exists and is claimed by this agent
    Returns bounty info or None
    """
    if not ESCROW or not IDENTITY:
        # Dev mode — skip verification
        return {"amount": 100_000_000, "agent_id": agent_id, "verified": False}

    try:
        # Check bounty
        sig = keccak(b"get_bounty(bytes32)")[:4]
        ctx_bytes = bytes.fromhex(context_hash[2:] if context_hash.startswith("0x") else context_hash)
        result = w3.eth.call({
            "to": w3.to_checksum_address(ESCROW),
            "data": "0x" + (sig + encode(["bytes32"], [ctx_bytes])).hex()
        })
        # Decode: (creator, amount, deadline, solver_agent_id, resolved, cancelled)
        # amount is at offset 32-64
        amount = int.from_bytes(result[32:64], 'big')
        solver_agent = int.from_bytes(result[96:128], 'big')
        resolved = int.from_bytes(result[128:160], 'big') != 0
        cancelled = int.from_bytes(result[160:192], 'big') != 0

        if amount == 0 or resolved or cancelled:
            return None
        if solver_agent != agent_id:
            return None

        return {"amount": amount, "agent_id": agent_id, "verified": True}
    except Exception as e:
        print(f"[proxy] verify error: {e}")
        return None


def get_or_init_credits(agent_id: int, bounty_amount: int) -> int:
    """Get remaining credits for agent, initializing from bounty amount if new."""
    if agent_id not in credit_ledger:
        # 70% of bounty goes to solver — that's their credit pool for inference
        credit_ledger[agent_id] = {
            "credits": bounty_amount * 70 // 100,
            "used": 0,
        }
    return credit_ledger[agent_id]["credits"] - credit_ledger[agent_id]["used"]


def deduct_credits(agent_id: int, cost_micros: int):
    """Deduct token cost from agent's credit pool."""
    if agent_id in credit_ledger:
        credit_ledger[agent_id]["used"] += cost_micros


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> int:
    """Estimate cost in EURC micros (6 decimals)."""
    p = PRICING.get(model, PRICING["default"])
    return (input_tokens * p["input"] + output_tokens * p["output"]) // 1_000_000

# ── Anthropic-compatible endpoint ───────────────────────────────

@app.route("/v1/messages", methods=["POST"])
def anthropic_messages():
    auth = request.headers.get("Authorization", "")
    api_key = request.headers.get("x-api-key", "")

    # Check for BountyNet token
    bnet = parse_bnet_token(auth) or parse_bnet_token(f"Bearer {api_key}")

    if bnet:
        agent_id, ctx_hash = bnet
        bounty = verify_bounty_access(agent_id, ctx_hash)
        if not bounty:
            return jsonify({"error": "invalid bounty or agent", "type": "authentication_error"}), 401

        remaining = get_or_init_credits(agent_id, bounty["amount"])
        if remaining <= 0:
            return jsonify({"error": "credits exhausted", "type": "rate_limit_error"}), 429
    else:
        # Passthrough mode — use as regular proxy with own API key
        pass

    # Forward to Anthropic
    body = request.json
    model = body.get("model", "claude-sonnet-4-20250514")

    headers = {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": request.headers.get("anthropic-version", "2023-06-01"),
        "content-type": "application/json",
    }

    resp = http_requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=body,
        stream=body.get("stream", False),
    )

    if resp.status_code == 200 and bnet:
        # Count tokens and deduct
        resp_json = resp.json()
        usage = resp_json.get("usage", {})
        input_t = usage.get("input_tokens", 0)
        output_t = usage.get("output_tokens", 0)
        cost = estimate_cost(model, input_t, output_t)
        deduct_credits(bnet[0], cost)

        # Inject credit info into response
        resp_json["_bountynet"] = {
            "credits_used": cost,
            "credits_remaining": get_or_init_credits(bnet[0], 0),
            "agent_id": bnet[0],
        }
        return jsonify(resp_json), resp.status_code

    return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))

# ── OpenAI-compatible endpoint ──────────────────────────────────

@app.route("/v1/chat/completions", methods=["POST"])
@app.route("/api/v1/chat/completions", methods=["POST"])
def openai_completions():
    auth = request.headers.get("Authorization", "")
    bnet = parse_bnet_token(auth)

    if bnet:
        agent_id, ctx_hash = bnet
        bounty = verify_bounty_access(agent_id, ctx_hash)
        if not bounty:
            return jsonify({"error": {"message": "invalid bounty or agent"}}), 401

        remaining = get_or_init_credits(agent_id, bounty["amount"])
        if remaining <= 0:
            return jsonify({"error": {"message": "credits exhausted"}}), 429

    body = request.json
    model = body.get("model", "gpt-4o")

    # Determine upstream
    if "claude" in model:
        # Route Claude models to Anthropic (convert format)
        return _route_to_anthropic(body, model, bnet)
    else:
        # Route to OpenAI
        headers = {
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        }
        resp = http_requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=body,
        )

        if resp.status_code == 200 and bnet:
            resp_json = resp.json()
            usage = resp_json.get("usage", {})
            cost = estimate_cost(model, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))
            deduct_credits(bnet[0], cost)
            resp_json["_bountynet"] = {
                "credits_used": cost,
                "credits_remaining": get_or_init_credits(bnet[0], 0),
            }
            return jsonify(resp_json)

        return Response(resp.content, status=resp.status_code, content_type=resp.headers.get("content-type"))


def _route_to_anthropic(body, model, bnet):
    """Convert OpenAI format → Anthropic format, forward, convert back."""
    messages = body.get("messages", [])
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_messages = [m for m in messages if m["role"] != "system"]

    anthropic_body = {
        "model": model,
        "max_tokens": body.get("max_tokens", 4096),
        "messages": user_messages,
    }
    if system:
        anthropic_body["system"] = system

    headers = {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    resp = http_requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=anthropic_body)

    if resp.status_code == 200:
        data = resp.json()
        usage = data.get("usage", {})

        if bnet:
            cost = estimate_cost(model, usage.get("input_tokens", 0), usage.get("output_tokens", 0))
            deduct_credits(bnet[0], cost)

        # Convert to OpenAI format
        return jsonify({
            "id": data.get("id"),
            "object": "chat.completion",
            "model": model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": data["content"][0]["text"]},
                "finish_reason": data.get("stop_reason", "stop"),
            }],
            "usage": {
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
            },
            "_bountynet": {
                "credits_used": cost if bnet else 0,
                "credits_remaining": get_or_init_credits(bnet[0], 0) if bnet else 0,
            } if bnet else {},
        })

    return Response(resp.content, status=resp.status_code)

# ── Status endpoints ────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "agents_active": len(credit_ledger),
        "models": list(PRICING.keys()),
    })


@app.route("/credits/<int:agent_id>", methods=["GET"])
def credits(agent_id: int):
    if agent_id not in credit_ledger:
        return jsonify({"error": "agent not found"}), 404
    ledger = credit_ledger[agent_id]
    return jsonify({
        "agent_id": agent_id,
        "credits_total": ledger["credits"],
        "credits_used": ledger["used"],
        "credits_remaining": ledger["credits"] - ledger["used"],
    })


if __name__ == "__main__":
    port = int(os.environ.get("PROXY_PORT", "8093"))
    print(f"BountyNet Inference Proxy on :{port}")
    print(f"  Anthropic: /v1/messages")
    print(f"  OpenAI:    /v1/chat/completions")
    print(f"  Credits:   /credits/<agent_id>")
    app.run(host="0.0.0.0", port=port)
