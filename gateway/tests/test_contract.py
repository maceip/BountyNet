"""
Contract tests for the single gateway surface: `gateway.factory.create_asgi_app` / `combined_app`.

Flask-only `app.test_client()` is intentionally not the conformance target — the ASGI stack must
include `/mcp` and pass wiring checks.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from starlette.testclient import TestClient
from jsonschema import validate

import gateway.chain as chain


@pytest.fixture
def asgi_app():
    from gateway.factory import create_asgi_app

    return create_asgi_app()


def load_schema(name: str) -> dict:
    root = Path(__file__).resolve().parents[2]
    return json.loads((root / "schemas" / name).read_text())


def test_wiring_rejects_missing_mcp_tools(monkeypatch):
    from gateway import factory
    from gateway import mcp_server

    monkeypatch.setattr(mcp_server.bountynet_mcp._tool_manager, "list_tools", lambda: [])
    with pytest.raises(RuntimeError, match="bountynet_show_feed"):
        factory.create_asgi_app()


def test_health_on_asgi_stack(asgi_app, monkeypatch):
    monkeypatch.setattr(chain, "current_block", lambda: (1, "test"))
    monkeypatch.setattr(chain, "get_next_agent_id", lambda: 1)
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


def test_bounties_feed_uses_canonical_funding_fields(asgi_app, monkeypatch):
    import gateway.routes.bounties as bounties

    monkeypatch.setattr(
        bounties.store,
        "apikey_bounties_all",
        lambda: {
            "0xtest": {
                "repo": "maceip/BountyNet",
                "commit": "abc12345",
                "check_name": "lint",
                "budget_tokens": 125000,
                "solver_agent_id": 0,
                "resolved": False,
                "owner": "maceip",
            }
        },
    )
    monkeypatch.setattr(bounties, "ESCROW", None)

    with TestClient(asgi_app) as client:
        r = client.get("/bounties")
    assert r.status_code == 200
    payload = r.json()
    [item] = payload["bounties"]
    validate(item, load_schema("bounty-feed-item.schema.json"))
    assert item["funding_kind"] == "inference_budget"
    assert item["funding_label"] == "125,000 tokens"
    assert item["budget_tokens"] == 125000


def test_bounty_detail_uses_canonical_funding_fields(asgi_app, monkeypatch):
    import gateway.routes.bounties as bounties

    monkeypatch.setattr(
        bounties.store,
        "apikey_bounty_get",
        lambda context_hash: {
            "repo": "maceip/BountyNet",
            "commit": "abc12345",
            "check_name": "lint",
            "budget_tokens": 50000,
            "solver_agent_id": 0,
            "resolved": False,
        },
    )

    with TestClient(asgi_app) as client:
        r = client.get("/bounties/0xtest")
    assert r.status_code == 200
    item = r.json()
    validate(item, load_schema("bounty-feed-item.schema.json"))
    assert item["funding_kind"] == "inference_budget"
    assert item["funding_label"] == "50,000 tokens"
    assert item["budget_tokens"] == 50000


def test_bounty_create_response_uses_canonical_funding_fields(asgi_app, monkeypatch):
    import gateway.routes.bounties as bounties

    recorded = {}

    monkeypatch.setattr(bounties.store, "staker_budget_put", lambda *args, **kwargs: None)
    monkeypatch.setattr(bounties.store, "apikey_bounty_upsert", lambda context_hash, payload: recorded.setdefault(context_hash, payload))
    monkeypatch.setattr(bounties, "emit", lambda *args, **kwargs: None)

    with TestClient(asgi_app) as client:
        r = client.post(
            "/bounties/create",
            json={
                "repo": "maceip/BountyNet",
                "commit": "abc12345",
                "check_name": "lint",
                "funding_kind": "inference_budget",
                "budget_tokens": 77777,
            },
        )

    assert r.status_code == 201, r.text
    body = r.json()
    validate(body, load_schema("bounty-create-response.schema.json"))
    assert body["funding_kind"] == "inference_budget"
    assert body["funding_label"] == "77,777 tokens"
    assert body["budget_tokens"] == 77777


def test_resource_claim_list_matches_schema(asgi_app, monkeypatch):
    import gateway.routes.resources as resources

    monkeypatch.setattr(resources, "RESOURCE_CLAIM", "0x1234")

    def fake_call(contract: str, data: str) -> bytes:
        if data.startswith("0x" + resources.sig("resource_count()").hex()):
            return (1).to_bytes(32, "big")
        if data.startswith("0x" + resources.sig("get_resource(uint256)").hex()):
            return resources.encode(
                ["address", "uint8", "string", "string", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256", "bool"],
                [
                    "0x1111111111111111111111111111111111111111",
                    1,
                    "aws",
                    "c6i.8xlarge",
                    32,
                    64,
                    500000,
                    100000,
                    0,
                    0,
                    True,
                ],
            )
        if data.startswith("0x" + resources.sig("remaining(uint256)").hex()):
            return (400000).to_bytes(32, "big")
        raise AssertionError(f"unexpected call data: {data}")

    monkeypatch.setattr(resources, "call", fake_call)

    with TestClient(asgi_app) as client:
        r = client.get("/resources/claims")
    assert r.status_code == 200, r.text
    body = r.json()
    [item] = body["resources"]
    validate(item, load_schema("resource-claim-item.schema.json"))
    assert item["resource_type"] == "xl_instance"
    assert item["tokens_remaining"] == 400000


def test_resource_claim_list_alias_removed(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.get("/resources")
    assert r.status_code == 404


def test_resource_claim_create_matches_schema(asgi_app, monkeypatch):
    import gateway.routes.resources as resources

    monkeypatch.setattr(resources, "RESOURCE_CLAIM", "0x1234")
    monkeypatch.setattr(resources, "send_tx", lambda *args, **kwargs: {"tx_hash": "0xabc"})
    monkeypatch.setattr(resources, "emit", lambda *args, **kwargs: None)

    with TestClient(asgi_app) as client:
        r = client.post(
            "/resources/claims",
            json={
                "resource_type": 1,
                "provider": "aws",
                "spec": "c6i.8xlarge",
                "cores": 32,
                "memory_gb": 64,
                "token_budget": 500000,
                "duration_hours": 24,
            },
        )
    assert r.status_code == 201, r.text
    body = r.json()
    validate(body, load_schema("resource-claim-create-response.schema.json"))
    assert body["resource_claim_status"] == "claimed"
    assert body["token_budget"] == 500000


def test_resource_claim_create_alias_removed(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.post("/resources/stake", json={})
    assert r.status_code == 404


def test_resource_claim_detail_alias_removed(asgi_app):
    with TestClient(asgi_app) as client:
        r = client.get("/resources/1")
    assert r.status_code == 404


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


def test_log_ingest_disabled_without_token(asgi_app, monkeypatch):
    monkeypatch.delenv("BOUNTYNET_CLIENT_LOG_TOKEN", raising=False)
    with TestClient(asgi_app) as client:
        r = client.post("/logs/android", json={"entries": []})
    assert r.status_code == 503


def test_log_ingest_accepts_batch(asgi_app, monkeypatch):
    monkeypatch.setenv("BOUNTYNET_CLIENT_LOG_TOKEN", "test-secret")
    body = {
        "ts": 0,
        "deviceModel": "test",
        "androidSdk": 34,
        "appId": "net.bountynet.app",
        "appVersion": "1.0",
        "source": "android",
        "entries": [{"ts": 1, "level": "INFO", "tag": "T", "message": "hello"}],
    }
    with TestClient(asgi_app) as client:
        r = client.post(
            "/logs/android",
            json=body,
            headers={"Authorization": "Bearer test-secret"},
        )
    assert r.status_code == 200
    assert r.json().get("received") == 1


def test_cli_auth_session_lifecycle(asgi_app, monkeypatch):
    import gateway.auth as auth

    monkeypatch.setattr(auth, "verify_dynamic_jwt", lambda token: {"sub": "test-user"})

    with TestClient(asgi_app) as client:
        create = client.post(
            "/identity/cli/sessions",
            json={"app_url": "https://bountynet.stare.network"},
        )
        assert create.status_code == 201, create.text
        created = create.json()
        validate(created, load_schema("identity-cli-session.schema.json"))
        session_id = created["session_id"]
        assert created["status"] == "pending"
        assert f"/auth/cli?session_id={session_id}" in created["auth_url"]

        complete = client.post(
            f"/identity/cli/sessions/{session_id}/complete",
            headers={"Authorization": "Bearer dyn_test"},
            json={
                "agent_id": 7,
                "wallet": "0xabc",
                "ens": "agent-7.bountynet.eth",
                "identity_anchor": "dynamic:test-user",
            },
        )
        assert complete.status_code == 200, complete.text

        poll = client.get(f"/identity/cli/sessions/{session_id}")
        assert poll.status_code == 200, poll.text
        body = poll.json()
        validate(body, load_schema("identity-cli-session.schema.json"))
        assert body["status"] == "complete"
        assert body["agent_id"] == 7
        assert body["wallet"] == "0xabc"
        assert body["ens"] == "agent-7.bountynet.eth"
        assert body["token"] == "dyn_test"

        consumed = client.get(f"/identity/cli/sessions/{session_id}")
        assert consumed.status_code == 404


def test_identity_onboard_response_matches_schema(asgi_app, monkeypatch):
    import gateway.auth as auth
    import gateway.routes.identity as identity

    monkeypatch.setattr(auth, "verify_dynamic_jwt", lambda token: {"sub": "dynamic:test-user"})
    monkeypatch.setattr(identity, "call_dynamic", lambda cmd, arg: {
        "get-user": {"userId": "dyn-user-1", "wallets": [{"address": "0x1111111111111111111111111111111111111111", "chain": "EVM"}]},
        "create-user": {"userId": "dyn-user-1", "wallets": []},
        "create-wallet": {"wallet": {"address": "0x1111111111111111111111111111111111111111", "chain": "EVM"}},
    }[cmd])
    monkeypatch.setattr(identity, "find_agent_id_by_wallet", lambda wallet: 9)
    monkeypatch.setattr(identity, "agent_fqdn", lambda agent_id: f"agent-{agent_id}.bountynet.eth")
    monkeypatch.setattr(identity, "emit", lambda *args, **kwargs: None)
    monkeypatch.setattr(identity, "IDENTITY", "0x1234")

    with TestClient(asgi_app) as client:
        r = client.post(
            "/identity/onboard",
            headers={"Authorization": "Bearer dyn_test"},
            json={},
        )

    assert r.status_code == 200, r.text
    body = r.json()
    validate(body, load_schema("identity-onboard-response.schema.json"))
    assert body["agent_id"] == 9
    assert body["identity_anchor"] == "dynamic:test-user"
    assert body["registered_on_chain"] is True
