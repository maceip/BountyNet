"""
BountyNet MCP server (FastMCP) — Streamable HTTP + optional ChatGPT / MCP Apps widget.

- Tools and resources are registered on the shared low-level Server (`_mcp_server`).
- `StreamableHTTPSessionManager` + `StreamableHTTPASGIApp` expose POST/GET/DELETE at `/mcp`
  Pair with `create_mcp_http_stack()` from this module (used by `gateway.factory`).
- Widget HTML is served as MCP resource `ui://widget/bountynet.html` and linked from tools via `_meta`.

ChatGPT: add connector URL `https://<host>/mcp` (same origin as `.well-known/oauth-protected-resource`).
Cursor: Background Agents and IDE MCP can use the same URL; OAuth follows MCP resource metadata when enabled.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from mcp.server.fastmcp.server import FastMCP, StreamableHTTPASGIApp
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings

from gateway.routes.bounties import bounty_feed_snapshot


def _mcp_transport_security() -> TransportSecuritySettings | None:
    """
    DNS rebinding protection defaults to off for public gateway hosts (ChatGPT, Cursor hit real Host headers).

    Enable explicitly:
      MCP_DNS_REBINDING_PROTECTION=1
      MCP_ALLOWED_HOSTS=gateway.example.com:443,gateway.example.com
      MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://cursor.com
    """
    if os.environ.get("MCP_DNS_REBINDING_PROTECTION", "").lower() not in ("1", "true", "yes"):
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    hosts = [h.strip() for h in os.environ.get("MCP_ALLOWED_HOSTS", "").split(",") if h.strip()]
    origins = [o.strip() for o in os.environ.get("MCP_ALLOWED_ORIGINS", "").split(",") if o.strip()]
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=origins,
    )

_WIDGET_URI = "ui://widget/bountynet.html"
_WIDGET_PATH = Path(__file__).resolve().parent / "mcp_widget.html"
_WIDGET_HTML = _WIDGET_PATH.read_text(encoding="utf-8")

# App metadata (Apps SDK / host surfaces this to the model)
_INSTRUCTIONS = (
    "BountyNet prover network for CI failures and on-chain bounties. "
    "Use bountynet_show_feed for the live dashboard widget + structured bounty list. "
    "Use bountynet_about for a short product summary without opening the widget."
)

# Tool _meta: MCP Apps standard + OpenAI Apps output template
_FEED_TOOL_META: dict[str, Any] = {
    "ui": {"resourceUri": _WIDGET_URI},
    "openai/outputTemplate": _WIDGET_URI,
}


class BountyFeedResult(BaseModel):
    """Structured tool output consumed by the iframe widget (`structuredContent`)."""

    bounties: list[Any] = Field(default_factory=list)
    count: int = 0
    error: str | None = None


bountynet_mcp = FastMCP(
    name="BountyNet",
    instructions=_INSTRUCTIONS,
    website_url=os.environ.get("BOUNTYNET_WEBSITE_URL", "https://bountynet.stare.network"),
    json_response=True,
    stateless_http=True,
    streamable_http_path="/mcp",
    host="0.0.0.0",
    transport_security=_mcp_transport_security(),
)


@bountynet_mcp.resource(_WIDGET_URI, mime_type="text/html; charset=utf-8")
def bountynet_widget_html() -> str:
    return _WIDGET_HTML


@bountynet_mcp.tool(
    name="bountynet_show_feed",
    title="Show BountyNet feed",
    description=(
        "Return active on-chain bounties (open claims) and open the BountyNet dashboard widget "
        "in hosts that support MCP Apps (ChatGPT, etc.)."
    ),
    meta=_FEED_TOOL_META,
    structured_output=True,
)
def bountynet_show_feed() -> BountyFeedResult:
    snap = bounty_feed_snapshot()
    return BountyFeedResult(
        bounties=snap.get("bounties") or [],
        count=int(snap.get("count") or 0),
        error=snap.get("error"),
    )


@bountynet_mcp.tool(
    name="bountynet_about",
    title="About BountyNet",
    description="Brief description of BountyNet for the model (no embedded UI).",
)
def bountynet_about() -> str:
    return (
        "BountyNet turns failing CI into funded repair jobs: repos install the GitHub App or connect "
        "via ChatGPT; when checks fail, a bounty context is created and solver agents can claim work, "
        "run inference through the gateway, and submit fixes. Payouts and validation tie to on-chain "
        "escrow when configured."
    )


def create_mcp_http_stack() -> tuple[StreamableHTTPASGIApp, StreamableHTTPSessionManager]:
    """
    New Streamable HTTP ASGI handler + session manager for one Starlette lifespan.

    Call once per ASGI app instance (see `gateway.factory.create_asgi_app`).
    """
    session_manager = StreamableHTTPSessionManager(
        app=bountynet_mcp._mcp_server,
        event_store=bountynet_mcp._event_store,
        retry_interval=bountynet_mcp._retry_interval,
        json_response=bountynet_mcp.settings.json_response,
        stateless=bountynet_mcp.settings.stateless_http,
        security_settings=bountynet_mcp.settings.transport_security,
    )
    return StreamableHTTPASGIApp(session_manager), session_manager
