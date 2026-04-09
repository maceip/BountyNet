"""
Full-stack soak: Anvil + contract deploy + fake GitHub + Flask gateway.

Requires `anvil` (Foundry) on PATH and `moccasin` for compiling Vyper artifacts.

Run locally: pytest tests/soak -v -m soak
 CI: see .github/workflows/nightly-soak.yml
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest
from eth_utils import keccak

pytestmark = pytest.mark.soak

REPO_ROOT = Path(__file__).resolve().parents[2]

# Anvil dev keys (account 0 / 1)
ANVIL_DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ANVIL_SOLVER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
ANVIL_SOLVER_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

INSTALLATION_ID = 424242
REPO_FULL = "soak-owner/soak-repo"
CHECK_NAME = "soak-ci-fail"
HEAD_SHA = "abc1234567890abcdef1234567890abcdef12345678"


def _have_anvil() -> bool:
    return shutil.which("anvil") is not None


skip_without_anvil = pytest.mark.skipif(
    not _have_anvil(),
    reason="Foundry `anvil` not on PATH (install: https://getfoundry.sh)",
)


@skip_without_anvil
def test_nightly_soak_github_install_ci_failure_onboard_claim():
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    from tests.soak.anvil import AnvilProcess, pick_free_port
    from tests.soak.deploy_local import deploy_soak_stack
    from tests.soak.fake_github import FakeGitHubServer
    from tests.soak.fake_oracle_tee import FakeOracleTeeServer

    rpc_port = pick_free_port()
    anvil = AnvilProcess(rpc_port)
    anvil.start()
    gh = FakeGitHubServer(default_repo_full=REPO_FULL)
    gh_base = gh.start()

    fd, db_path = tempfile.mkstemp(suffix="-soak-gateway.db")
    os.close(fd)

    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    addrs = deploy_soak_stack(REPO_ROOT, anvil.rpc_url, ANVIL_DEPLOYER_PK)

    tee = FakeOracleTeeServer(ANVIL_DEPLOYER_PK)
    tee_base = tee.start()

    os.environ.update(
        {
            "BOUNTYNET_EVM_RPC": anvil.rpc_url,
            "BOUNTYNET_CHAIN_ID": addrs["chain_id"],
            "IDENTITY_REGISTRY": addrs["identity_registry"],
            "VALIDATION_REGISTRY": addrs["validation_registry"],
            "BOUNTY_ESCROW": addrs["bounty_escrow"],
            "EURC_ADDRESS": addrs["eurc"],
            "DEPLOYER_PRIVATE_KEY": ANVIL_DEPLOYER_PK,
            "BOUNTYNET_SOLVER_PRIVATE_KEY": ANVIL_SOLVER_PK,
            "BOUNTYNET_DB_PATH": db_path,
            "BOUNTYNET_DEV_SKIP_JWT_VERIFICATION": "1",
            "BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY": "1",
            "BOUNTYNET_SOAK_MODE": "1",
            "BOUNTYNET_SOAK_WALLET": ANVIL_SOLVER_ADDR,
            "BOUNTYNET_SOAK_FAKE_INFERENCE": "1",
            "GITHUB_API_URL": gh_base,
            "GITHUB_APP_ID": "9876543",
            "GITHUB_APP_PRIVATE_KEY": pem,
            "ORACLE_TEE_URL": tee_base,
            "GATEWAY_PUBLIC_URL": "http://testserver",
            "DEPLOYER_ADDRESS": addrs["deployer"],
        }
    )

    assert addrs["chain_id"] == "31337"

    # Parent shells often set Dynamic JWKS — that forces real JWT verification and breaks soak.
    os.environ.pop("DYNAMIC_JWKS_ENDPOINT", None)

    # Import gateway only after env + contracts exist (chain.py reads env at import).
    from gateway.factory import create_asgi_app
    from gateway.routes import identity as identity_mod
    from starlette.testclient import TestClient

    identity_mod.reset_soak_dynamic_state()

    with TestClient(create_asgi_app()) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

        inst = {
            "action": "created",
            "installation": {
                "id": INSTALLATION_ID,
                "account": {"login": "soak-owner", "id": 900001},
            },
            "repositories": [{"full_name": REPO_FULL, "name": REPO_FULL.split("/")[-1]}],
        }
        w = client.post(
            "/github/webhook",
            json=inst,
            headers={
                "X-GitHub-Event": "installation",
                "X-Hub-Signature-256": "sha256=deadbeef",
            },
        )
        assert w.status_code == 200, w.text

        cfg = client.post(
            "/github/setup",
            json={
                "installation_id": INSTALLATION_ID,
                "repos": [REPO_FULL],
                "api_key": "",
                "budget_tokens": 100_000,
                "owner": "soak-owner",
            },
        )
        assert cfg.status_code == 200, cfg.text

        ctx_raw = keccak(
            f"{REPO_FULL}:{HEAD_SHA[:8]}:{CHECK_NAME}:failure".encode()
        )
        ctx_hex = "0x" + ctx_raw.hex()

        cr = {
            "action": "completed",
            "installation": {"id": INSTALLATION_ID},
            "repository": {"full_name": REPO_FULL},
            "check_run": {
                "head_sha": HEAD_SHA,
                "name": CHECK_NAME,
                "conclusion": "failure",
            },
        }
        w2 = client.post(
            "/github/webhook",
            json=cr,
            headers={
                "X-GitHub-Event": "check_run",
                "X-Hub-Signature-256": "sha256=cafe",
            },
        )
        assert w2.status_code == 200, w2.text
        assert w2.json().get("status") == "bounty_created"

        feed = client.get("/bounties")
        assert feed.status_code == 200
        hashes = {b["context_hash"] for b in feed.json().get("bounties", [])}
        assert ctx_hex in hashes

        cli_create = client.post(
            "/identity/cli/sessions",
            json={"app_url": "https://bountynet.stare.network"},
        )
        assert cli_create.status_code == 201, cli_create.text
        session_id = cli_create.json()["session_id"]

        ob = client.post(
            "/identity/onboard",
            json={
                "external_id": "soak:solver-e2e",
                "agent_uri": "ipfs://soak-solver-agent.json",
            },
            headers={"Authorization": "Bearer soak-test-jwt"},
        )
        assert ob.status_code == 200, ob.text
        agent_id = ob.json().get("agent_id")
        assert agent_id

        who = client.get(f"/identity/{agent_id}")
        assert who.status_code == 200
        assert who.json().get("wallet", "").lower() == ANVIL_SOLVER_ADDR.lower()

        cl = client.post(
            f"/bounties/{ctx_hex}/claim",
            json={"agent_id": agent_id},
        )
        assert cl.status_code == 200, cl.text
        assert cl.json().get("status") == "claimed"

        det = client.get(f"/bounties/{ctx_hex}")
        assert det.status_code == 200
        assert det.json().get("solver_agent_id") == agent_id

        done = client.post(
            f"/identity/cli/sessions/{session_id}/complete",
            headers={"Authorization": "Bearer soak-test-jwt"},
            json={
                "agent_id": agent_id,
                "wallet": ANVIL_SOLVER_ADDR,
                "ens": f"agent-{agent_id}.bountynet.eth",
                "identity_anchor": "soak:solver-e2e",
            },
        )
        assert done.status_code == 200, done.text

        inf = client.post(
            "/v1/chat/completions",
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "ping"}]},
            headers={"Authorization": f"Bearer bnet_{agent_id}:{ctx_hex}"},
        )
        assert inf.status_code == 200, inf.text
        assert inf.json().get("choices")

        sess = client.get("/sessions", params={"agent_id": agent_id})
        assert sess.status_code == 200
        assert sess.json().get("count", 0) >= 1

        pr = client.post(
            "/github/submit-pr",
            json={
                "repo": REPO_FULL,
                "context_hash": ctx_hex,
                "agent_id": agent_id,
                "base": "main",
                "title": "fix: soak patch",
                "files": [{"path": "fix.txt", "content": "soak fix"}],
            },
        )
        assert pr.status_code == 200, pr.text
        pr_head = pr.json().get("head_sha") or ""
        assert len(pr_head) == 40

        green = {
            "action": "completed",
            "installation": {"id": INSTALLATION_ID},
            "repository": {"full_name": REPO_FULL},
            "check_run": {
                "head_sha": pr_head,
                "name": CHECK_NAME,
                "conclusion": "success",
            },
        }
        w_green = client.post(
            "/github/webhook",
            json=green,
            headers={
                "X-GitHub-Event": "check_run",
                "X-Hub-Signature-256": "sha256=green",
            },
        )
        assert w_green.status_code == 200, w_green.text
        assert w_green.json().get("status") == "resolved"

        closed = client.get(f"/bounties/{ctx_hex}")
        assert closed.status_code == 200
        assert closed.json().get("resolved") is True

        rates = client.get("/credits/rates")
        assert rates.status_code == 200
        assert rates.json().get("models")

        ens = client.get(f"/ens/lookup/agent-{agent_id}")
        assert ens.status_code == 200
        assert ens.json()["addresses"]["default"].lower() == ANVIL_SOLVER_ADDR.lower()

        mcp = client.post(
            "/mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "soak", "version": "0"},
                },
            },
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        assert mcp.status_code == 200, mcp.text

    gh.shutdown()
    tee.shutdown()
    anvil.stop()
