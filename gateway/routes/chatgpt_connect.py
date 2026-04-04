"""
ChatGPT Apps / MCP connector — discovery + post-connect onboarding.

Parallels gateway/routes/github.py:
  - GitHub: installation webhook → /setup?installation_id=… → POST /github/setup
  - ChatGPT: connector OAuth (hosted IdP) → optional /chatgpt-setup?link=… → POST /chatgpt/setup

MCP Streamable HTTP lives at POST|GET|DELETE /mcp on the same gateway process/origin as these
Flask routes so ChatGPT/Cursor can load /.well-known/oauth-protected-resource and call /mcp.
This module covers BountyNet-specific *gateway* wiring: OAuth metadata + staker config store.

Environment (see also OpenAI Apps SDK auth docs):
  MCP_RESOURCE_URL              Canonical HTTPS origin for this MCP resource (no trailing slash)
  CHATGPT_OAUTH_ISSUERS         Comma-separated issuer base URLs (e.g. https://your-tenant.auth0.com/)
  CHATGPT_OAUTH_SCOPES          Optional comma-separated scopes for metadata (e.g. bountynet.read)
  CHATGPT_RESOURCE_DOCS_URL    Optional URL shown in protected-resource metadata

When CHATGPT_OAUTH_ISSUERS is empty, /.well-known/oauth-protected-resource returns 404 so the
connector wizard does not advertise OAuth until you configure an IdP (Auth0, Stytch, etc.).
"""
from __future__ import annotations

import os
import secrets
import time
from flask import Blueprint, request, jsonify, Response

from gateway.routes.inference import staker_budgets

chatgpt_bp = Blueprint("chatgpt", __name__)

# link_id → { api_key, budget_tokens, budget_used, created_at, label, openai_sub }
chatgpt_links: dict[str, dict] = {}

DEFAULT_SCOPES = [s.strip() for s in os.environ.get("CHATGPT_OAUTH_SCOPES", "bountynet.read,bountynet.write").split(",") if s.strip()]
RESOURCE_DOCS = os.environ.get("CHATGPT_RESOURCE_DOCS_URL", "").strip()


def _resource_base() -> str:
    return os.environ.get("MCP_RESOURCE_URL", "").rstrip("/")


def _issuers() -> list[str]:
    raw = os.environ.get("CHATGPT_OAUTH_ISSUERS", "")
    return [i.strip().rstrip("/") for i in raw.split(",") if i.strip()]


@chatgpt_bp.route("/.well-known/oauth-protected-resource", methods=["GET"])
def oauth_protected_resource():
    """
    MCP authorization: protected resource metadata (RFC-style document).
    ChatGPT fetches this to learn authorization_servers and scopes.
    """
    resource = _resource_base()
    issuers = _issuers()
    if not resource or not issuers:
        return jsonify({"error": "OAuth metadata not configured (set MCP_RESOURCE_URL and CHATGPT_OAUTH_ISSUERS)"}), 404

    doc: dict = {
        "resource": resource,
        "authorization_servers": issuers,
        "scopes_supported": DEFAULT_SCOPES,
    }
    if RESOURCE_DOCS:
        doc["resource_documentation"] = RESOURCE_DOCS
    return jsonify(doc)


@chatgpt_bp.route("/chatgpt/health", methods=["GET"])
def chatgpt_health():
    """Sanity check for connector base URL (avoids 502 in ChatGPT wizard during bring-up)."""
    return jsonify({
        "service": "bountynet-chatgpt-gateway",
        "mcp_resource_configured": bool(_resource_base()),
        "oauth_issuers_configured": bool(_issuers()),
        "active_links": len(chatgpt_links),
    })


@chatgpt_bp.route("/chatgpt/link", methods=["POST"])
def create_onboarding_link():
    """
    Create an opaque onboarding token (like GitHub's installation_id in the setup URL).

    Body (optional): { "label": "acme-corp" }
    Returns: { link_id, setup_path, setup_url_hint }
    The web app should expose /chatgpt-setup?link=<link_id> (see ChatGPTSetup.tsx).
    """
    body = request.json or {}
    label = (body.get("label") or "").strip() or "chatgpt-connector"
    link_id = secrets.token_urlsafe(24)
    chatgpt_links[link_id] = {
        "label": label,
        "api_key": "",
        "budget_tokens": 100_000,
        "budget_used": 0,
        "created_at": int(time.time()),
        "openai_sub": "",
    }
    return jsonify({
        "link_id": link_id,
        "setup_path": f"/chatgpt-setup?link={link_id}",
        "note": "Open this path on the BountyNet web app after users add the ChatGPT connector.",
    })


@chatgpt_bp.route("/chatgpt/link/<link_id>", methods=["GET"])
def get_link(link_id: str):
    """Read link status for the setup page (no secrets)."""
    row = chatgpt_links.get(link_id)
    if not row:
        return jsonify({"error": "unknown link"}), 404
    return jsonify({
        "link_id": link_id,
        "label": row.get("label"),
        "created_at": row.get("created_at"),
        "has_api_key": bool(row.get("api_key")),
        "budget_tokens": row.get("budget_tokens"),
        "openai_sub": row.get("openai_sub") or "",
    })


@chatgpt_bp.route("/chatgpt/setup", methods=["POST"])
def setup():
    """
    Staker configures inference budget after connector install (mirrors POST /github/setup).

    Body: {
        "link_id": "<from /chatgpt/link>",
        "api_key": "sk-… or sk-ant-…",
        "budget_tokens": 100000,
        "openai_sub": "optional subject from access token 'sub' after OAuth"
    }
    """
    body = request.json or {}
    link_id = body.get("link_id")
    if not link_id or link_id not in chatgpt_links:
        return jsonify({"error": "valid link_id required; POST /chatgpt/link first"}), 400

    api_key = body.get("api_key", "")
    budget_tokens = int(body.get("budget_tokens", 100_000))
    openai_sub = (body.get("openai_sub") or "").strip()

    row = chatgpt_links[link_id]
    row["api_key"] = api_key
    row["budget_tokens"] = budget_tokens
    if openai_sub:
        row["openai_sub"] = openai_sub

    # Register a synthetic context budget pool key for ChatGPT-origin bounties (optional integration)
    if api_key:
        ctx_hex = f"0xchatgpt_{link_id[:16]}"
        staker_budgets[ctx_hex] = {
            "anthropic_key": api_key if api_key.startswith("sk-ant") else "",
            "openai_key": api_key if api_key.startswith("sk-") and not api_key.startswith("sk-ant") else "",
            "budget_tokens": budget_tokens,
            "used_tokens": 0,
        }

    return jsonify({
        "status": "configured",
        "link_id": link_id,
        "budget_tokens": budget_tokens,
        "has_api_key": bool(api_key),
    })


def www_authenticate_challenge(scope: str = "bountynet.read") -> Response:
    """
    Helper for future MCP tool handlers: return 401 with resource metadata pointer.
    See OpenAI Apps SDK auth: WWW-Authenticate with resource_metadata=…
    """
    resource = _resource_base()
    if not resource:
        return Response(
            "OAuth not configured",
            status=401,
            mimetype="text/plain",
        )
    meta_url = f"{resource}/.well-known/oauth-protected-resource"
    val = f'Bearer resource_metadata="{meta_url}", scope="{scope}"'
    return Response(
        "Authentication required",
        status=401,
        headers={"WWW-Authenticate": val},
        mimetype="text/plain",
    )
