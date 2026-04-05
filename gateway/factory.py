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

import asyncio

from gateway.app import app as flask_app
from gateway.mcp_server import MCP_SUBSCRIBE_ENABLED, bountynet_mcp, create_mcp_http_stack


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


def create_asgi_app():
    """
    Build the ASGI application: CORS + `/mcp` (MCP Streamable HTTP) + Flask mounted at `/`.

    Raises RuntimeError if static wiring checks fail.
    """
    _verify_gateway_wiring()

    mcp_http_asgi, session_manager = create_mcp_http_stack()

    class _McpAsgi:
        """Starlette ``Route`` treats bare functions as ``Request`` handlers; MCP needs raw ASGI."""

        __slots__ = ("_app",)

        def __init__(self, app):
            self._app = app

        async def __call__(self, scope, receive, send):
            if scope["type"] == "http" and scope.get("method") == "OPTIONS":
                await Response(status_code=204)(scope, receive, send)
                return
            await self._app(scope, receive, send)

    @asynccontextmanager
    async def lifespan(_starlette_app: Starlette):
        if MCP_SUBSCRIBE_ENABLED:
            from gateway import mcp_watch

            mcp_watch.start(asyncio.get_running_loop())
        async with session_manager.run():
            try:
                yield
            finally:
                if MCP_SUBSCRIBE_ENABLED:
                    from gateway import mcp_watch

                    mcp_watch.stop()

    starlette_app = Starlette(
        routes=[
            Route(
                "/mcp",
                endpoint=_McpAsgi(mcp_http_asgi),
                methods=["GET", "POST", "DELETE", "OPTIONS"],
            ),
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
