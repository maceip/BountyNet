"""
Contract tests for the single gateway surface: `gateway.factory.create_asgi_app` / `combined_app`.

Flask-only `app.test_client()` is intentionally not the conformance target — the ASGI stack must
include `/mcp` and pass wiring checks.
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient


@pytest.fixture
def asgi_app():
    from gateway.factory import create_asgi_app

    return create_asgi_app()


def test_wiring_rejects_missing_mcp_tools(monkeypatch):
    from gateway import factory
    from gateway import mcp_server

    monkeypatch.setattr(mcp_server.bountynet_mcp._tool_manager, "list_tools", lambda: [])
    with pytest.raises(RuntimeError, match="bountynet_show_feed"):
        factory.create_asgi_app()


def test_health_on_asgi_stack(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)


def test_bounties_route_on_asgi_stack(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.get("/bounties")
    assert r.status_code == 200
    data = r.json()
    assert "bounties" in data


def test_mcp_options(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.options("/mcp")
    assert r.status_code in (200, 204)


def test_mcp_initialize_jsonrpc(asgi_app):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "contract-test", "version": "0"},
        },
    }
    with TestClient(asgi_app) as client:
        r = client.post(
            "/mcp",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "jsonrpc" in body
    assert body.get("id") == 1
    assert "result" in body or "error" in body
    if "error" in body:
        pytest.fail(f"MCP initialize error: {body['error']}")
