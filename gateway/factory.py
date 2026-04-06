"""
Single public construction surface for the live gateway (Flask + MCP).

All serving and contract tests should go through `create_asgi_app()` (or the module-level
`combined_app`, which is one eager call for WSGI/asgi loaders).

Verification runs on every `create_asgi_app()` so broken Flask wiring, missing MCP tools, or
a missing widget asset fails immediately with an explicit error instead of failing only on
first client request.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.wsgi import WSGIMiddleware
from starlette.responses import Response
from starlette.routing import Mount, Route

from gateway.app import app as flask_app
from gateway.mcp_server import bountynet_mcp, create_mcp_http_stack


def _require(condition: bool, msg: str) -> None:
    if not condition:
        raise RuntimeError(f"gateway.factory: {msg}")


def _verify_gateway_wiring() -> None:
    """Fail fast before any client connects."""
    rules = {r.rule for r in flask_app.url_map.iter_rules()}
    _require("/health" in rules, "Flask url map has no /health — route registration failed")

    tools = {t.name for t in bountynet_mcp._tool_manager.list_tools()}
    _require("bountynet_show_feed" in tools, "MCP tool bountynet_show_feed not registered")
    _require("bountynet_about" in tools, "MCP tool bountynet_about not registered")

    widget = Path(__file__).resolve().parent / "mcp_widget.html"
    _require(widget.is_file(), f"MCP widget asset missing: {widget}")
    _require(widget.stat().st_size >= 64, f"MCP widget asset empty or corrupt: {widget}")


class _McpHttpAsgi:
    """OPTIONS for probes / non-CORS clients; Streamable HTTP only handles GET/POST/DELETE."""

    __slots__ = ("_inner",)

    def __init__(self, inner):
        self._inner = inner

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http" and scope["method"] == "OPTIONS":
            await Response(status_code=204)(scope, receive, send)
            return
        await self._inner(scope, receive, send)


def create_asgi_app():
    """
    Build the ASGI application: CORS + `/mcp` (MCP Streamable HTTP) + Flask mounted at `/`.

    Raises RuntimeError if static wiring checks fail.
    """
    _verify_gateway_wiring()

    mcp_http_asgi, session_manager = create_mcp_http_stack()

    @asynccontextmanager
    async def lifespan(_starlette_app: Starlette):
        async with session_manager.run():
            yield

    # Route (not Mount): Starlette Mount("/mcp") matches only `/mcp/...`, not `/mcp`. Endpoint must be an ASGI object, not an `async def` (that becomes a Request handler).
    mcp_route_app = _McpHttpAsgi(mcp_http_asgi)
    starlette_app = Starlette(
        routes=[
            Route("/mcp", endpoint=mcp_route_app, methods=["GET", "POST", "DELETE", "OPTIONS"]),
            Mount("/", WSGIMiddleware(flask_app)),
        ],
        lifespan=lifespan,
    )

    return CORSMiddleware(
        starlette_app,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id", "mcp-session-id"],
    )


combined_app = create_asgi_app()
