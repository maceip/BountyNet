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


def test_market_repository_setup_and_list(asgi_app):
    with TestClient(asgi_app) as client:
        created = client.post(
            "/market/repositories/setup",
            json={
                "installation_id": 101,
                "repos": ["acme/api"],
                "owner": "acme",
                "enabled_job_classes": ["ci_repair", "dependency_update"],
                "required_checks": ["CI", "Tests"],
                "budget_priority": ["api_key_pool", "platform_credits"],
                "monthly_spend_cap": 25000,
                "per_job_spend_cap": 1500,
                "has_api_key_pool": True,
                "api_key_provider": "openai",
            },
        )
        assert created.status_code == 200, created.text
        body = created.json()
        [repo] = body["repositories"]
        assert repo["repo_full_name"] == "acme/api"
        assert repo["enabled_job_classes"] == ["ci_repair", "dependency_update"]
        assert repo["budget_priority"] == ["api_key_pool", "platform_credits"]
        assert repo["has_api_key_pool"] is True

        listed = client.get("/market/repositories?installation_id=101")
        assert listed.status_code == 200, listed.text
        repos = listed.json()["repositories"]
        assert any(r["repo_full_name"] == "acme/api" for r in repos)


def test_market_agents_jobs_and_submissions(asgi_app):
    with TestClient(asgi_app) as client:
        repo_setup = client.post(
            "/market/repositories/setup",
            json={"installation_id": 102, "repos": ["acme/web"]},
        )
        assert repo_setup.status_code == 200, repo_setup.text

        agent = client.post(
            "/market/agents",
            json={
                "slug": "oxide-maintainer",
                "display_name": "Oxide Maintainer",
                "operator_id": "op_1",
                "supported_job_classes": ["dependency_update", "ci_repair"],
                "supported_ecosystems": ["rust"],
                "badges": ["rust"],
            },
        )
        assert agent.status_code == 200, agent.text
        agent_body = agent.json()["agent"]
        assert agent_body["slug"] == "oxide-maintainer"

        job = client.post(
            "/market/jobs",
            json={
                "repo_full_name": "acme/web",
                "job_class": "dependency_update",
                "title": "Upgrade serde",
                "summary": "Apply a safe patch update.",
                "budget_ceiling": 2200,
                "candidate_agents": [agent_body["id"]],
            },
        )
        assert job.status_code == 201, job.text
        job_body = job.json()["job"]
        assert job_body["repo_full_name"] == "acme/web"
        assert job_body["job_class"] == "dependency_update"

        plan = client.post(
            f"/market/jobs/{job_body['id']}/plans",
            json={
                "agent_id": agent_body["id"],
                "operator_id": "op_1",
                "summary": "Patch serde safely, run tests, and open a narrow PR.",
                "steps": ["upgrade dependency", "run tests", "prepare PR"],
                "estimated_cost": 300,
                "estimated_seconds": 1200,
            },
        )
        assert plan.status_code == 201, plan.text
        plan_body = plan.json()["plan"]
        assert plan_body["agent_id"] == agent_body["id"]
        assert plan_body["status"] == "proposed"

        assignment = client.post(
            f"/market/jobs/{job_body['id']}/assignments",
            json={
                "agent_id": agent_body["id"],
                "plan_id": plan_body["id"],
                "assigned_by": "platform-router",
                "mode": "exclusive",
                "lease_seconds": 1800,
            },
        )
        assert assignment.status_code == 201, assignment.text
        assignment_body = assignment.json()["assignment"]
        assert assignment_body["agent_id"] == agent_body["id"]
        assert assignment_body["plan_id"] == plan_body["id"]
        assert assignment_body["status"] == "active"

        submission = client.post(
            "/market/submissions",
            json={
                "job_id": job_body["id"],
                "agent_id": agent_body["id"],
                "branch_name": "agent/oxide-maintainer/job-1",
                "diff_summary": "Bumps serde and lockfile.",
                "status": "submitted",
            },
        )
        assert submission.status_code == 201, submission.text

        fetched = client.get(f"/market/jobs/{job_body['id']}")
        assert fetched.status_code == 200, fetched.text
        payload = fetched.json()
        assert payload["job"]["id"] == job_body["id"]
        assert payload["job"]["status"] == "assigned"
        assert len(payload["plans"]) == 1
        assert len(payload["assignments"]) == 1
        assert len(payload["submissions"]) == 1
        assert payload["payouts"] == []


def test_market_submission_acceptance_and_payout(asgi_app):
    with TestClient(asgi_app) as client:
        repo_setup = client.post(
            "/market/repositories/setup",
            json={
                "installation_id": 104,
                "repos": ["acme/trusted-patch"],
                "owner": "acme",
                "budget_priority": ["api_key_pool", "platform_credits"],
                "api_key_provider": "openai",
                "has_api_key_pool": True,
            },
        )
        assert repo_setup.status_code == 200, repo_setup.text

        agent = client.post(
            "/market/agents",
            json={
                "slug": "trusted-patcher",
                "display_name": "Trusted Patcher",
                "operator_id": "operator_7",
                "supported_job_classes": ["security_update", "dependency_update"],
                "supported_ecosystems": ["typescript"],
                "pricing_profile": "per_accepted_change",
            },
        )
        assert agent.status_code == 200, agent.text
        agent_body = agent.json()["agent"]

        job = client.post(
            "/market/jobs",
            json={
                "repo_full_name": "acme/trusted-patch",
                "job_class": "security_update",
                "title": "Patch vulnerable dependency",
                "summary": "Upgrade the vulnerable package and keep CI green.",
                "budget_ceiling": 5000,
                "acceptance_policy": "maintainer_accept_or_merge",
            },
        )
        assert job.status_code == 201, job.text
        job_body = job.json()["job"]

        plan = client.post(
            f"/market/jobs/{job_body['id']}/plans",
            json={
                "agent_id": agent_body["id"],
                "summary": "Upgrade dependency, run tests, and open a scoped PR.",
                "steps": ["upgrade", "validate", "submit"],
            },
        )
        assert plan.status_code == 201, plan.text
        plan_body = plan.json()["plan"]

        assignment = client.post(
            f"/market/jobs/{job_body['id']}/assignments",
            json={
                "agent_id": agent_body["id"],
                "plan_id": plan_body["id"],
                "assigned_by": "platform-router",
            },
        )
        assert assignment.status_code == 201, assignment.text

        submission = client.post(
            "/market/submissions",
            json={
                "job_id": job_body["id"],
                "agent_id": agent_body["id"],
                "branch_name": "agent/trusted-patcher/security-1",
                "pr_number": 42,
                "pr_url": "https://github.com/acme/trusted-patch/pull/42",
                "diff_summary": "Upgrades package and refreshes lockfile.",
            },
        )
        assert submission.status_code == 201, submission.text
        submission_body = submission.json()["submission"]

        decision = client.post(
            f"/market/submissions/{submission_body['id']}/decision",
            json={
                "decision": "accepted",
                "acceptance_attribution": "merged",
                "merged_by": "octocat",
                "operator_id": "operator_7",
                "funding_source": "api_key_pool",
                "currency": "credits",
                "payout_amount": 1800,
                "notes": "Merged after maintainer review.",
            },
        )
        assert decision.status_code == 200, decision.text
        decision_body = decision.json()
        assert decision_body["job"]["status"] == "completed"
        assert decision_body["submission"]["status"] == "accepted"
        assert decision_body["submission"]["acceptance_attribution"] == "merged"
        assert len(decision_body["payouts"]) == 1
        payout = decision_body["payouts"][0]
        assert payout["submission_id"] == submission_body["id"]
        assert payout["agent_id"] == agent_body["id"]
        assert payout["funding_source"] == "api_key_pool"
        assert payout["amount"] == 1800

        fetched = client.get(f"/market/jobs/{job_body['id']}")
        assert fetched.status_code == 200, fetched.text
        payload = fetched.json()
        assert payload["job"]["status"] == "completed"
        assert payload["submissions"][0]["status"] == "accepted"
        assert payload["assignments"][0]["status"] == "completed"
        assert len(payload["payouts"]) == 1


def test_market_agents_and_recommendations(asgi_app):
    with TestClient(asgi_app) as client:
        repo_setup = client.post(
            "/market/repositories/setup",
            json={
                "installation_id": 103,
                "repos": ["acme/rustlib"],
                "owner": "acme",
                "budget_priority": ["api_key_pool", "platform_credits"],
                "review_policy": "maintainer_review",
            },
        )
        assert repo_setup.status_code == 200, repo_setup.text

        seeded = client.post("/market/agents/seed")
        assert seeded.status_code == 200, seeded.text

        job = client.post(
            "/market/jobs",
            json={
                "repo_full_name": "acme/rustlib",
                "job_class": "dependency_update",
                "title": "Patch outdated crates",
                "metadata": {
                    "pod": "rust",
                    "lane": "security_patch",
                    "required_trust_tier": "critical",
                },
            },
        )
        assert job.status_code == 201, job.text
        job_body = job.json()["job"]

        recs = client.post(f"/market/jobs/{job_body['id']}/recommendations")
        assert recs.status_code == 200, recs.text
        payload = recs.json()
        recommendations = payload["recommendations"]
        assert len(recommendations) >= 3
        top = recommendations[0]
        assert top["slug"] == "rust-sentinel"
        assert top["recommended"] is True
        assert top["recommendation_id"].startswith("rec_")
        assert top["requires_plan"] is True
        assert "job class match" in top["reasons"]
        assert "ecosystem match" in top["reasons"]
        assert "budget compatible" in top["reasons"]
        blocked = [r for r in recommendations if r["slug"] == "generic-rust-maintainer"][0]
        assert blocked["policy_pass"] is False
        assert "trust tier too low" in blocked["policy_warnings"]

        recs_get = client.get(f"/market/jobs/{job_body['id']}/recommendations")
        assert recs_get.status_code == 200, recs_get.text
        assert len(recs_get.json()["recommendations"]) >= 3

        no_plan_assignment = client.post(
            f"/market/jobs/{job_body['id']}/assignments",
            json={
                "recommendation_id": top["recommendation_id"],
                "assigned_by": "platform-router",
                "mode": "exclusive",
                "lease_seconds": 1200,
            },
        )
        assert no_plan_assignment.status_code == 400, no_plan_assignment.text
        assert "plan_id required" in no_plan_assignment.json()["error"]

        plan = client.post(
            f"/market/jobs/{job_body['id']}/plans",
            json={
                "agent_id": top["agent_id"],
                "operator_id": "op_rust",
                "summary": "Patch Cargo dependencies, run tests, and open a narrow PR.",
                "steps": ["update Cargo.toml", "update Cargo.lock", "run tests"],
            },
        )
        assert plan.status_code == 201, plan.text
        plan_body = plan.json()["plan"]

        assignment = client.post(
            f"/market/jobs/{job_body['id']}/assignments",
            json={
                "recommendation_id": top["recommendation_id"],
                "plan_id": plan_body["id"],
                "assigned_by": "platform-router",
                "mode": "exclusive",
                "lease_seconds": 1200,
            },
        )
        assert assignment.status_code == 201, assignment.text
        assignment_body = assignment.json()["assignment"]
        assert assignment_body["agent_id"] == top["agent_id"]
        assert assignment_body["specialist_id"] == top["specialist_id"]
        assert assignment_body["recommendation_id"] == top["recommendation_id"]

        detail = client.get(f"/market/jobs/{job_body['id']}")
        assert detail.status_code == 200, detail.text
        detail_body = detail.json()
        assert len(detail_body["recommendations"]) >= 3


def test_market_seeded_specialists_and_presets(asgi_app):
    with TestClient(asgi_app) as client:
        seeded = client.post("/market/agents/seed")
        assert seeded.status_code == 200, seeded.text
        specialists = seeded.json()["specialists"]
        agents = seeded.json()["agents"]
        assert len(specialists) == 6
        assert len(agents) == 9
        slugs = {item["slug"] for item in specialists}
        assert slugs == {
            "ts-migrator",
            "ts-auditor",
            "ts-architect",
            "rust-porter",
            "rust-sentinel",
            "rust-optimizer",
        }

        presets = client.get("/market/presets/lanes")
        assert presets.status_code == 200, presets.text
        preset_names = set(presets.json()["presets"].keys())
        assert preset_names == {
            "typescript_ci_repair",
            "typescript_security_audit",
            "rust_security_patch",
            "rust_porting",
        }

        repo_setup = client.post(
            "/market/repositories/setup",
            json={"installation_id": 105, "repos": ["acme/ts-web"]},
        )
        assert repo_setup.status_code == 200, repo_setup.text

        applied = client.post(
            "/market/repositories/acme/ts-web/apply-preset",
            json={"preset": "typescript_ci_repair"},
        )
        assert applied.status_code == 200, applied.text
        body = applied.json()
        assert body["repository"]["allowed_agent_pools"] == ["managed-typescript", "managed-generic"]
        assert body["job_metadata_template"]["pod"] == "typescript"
        assert body["job_metadata_template"]["lane"] == "migration"
        assert body["job_metadata_template"]["required_trust_tier"] == "trusted"


def test_market_runtime_status_exposes_agent_runtime_contract(asgi_app, monkeypatch):
    monkeypatch.setenv("AGENT_RUNTIME_PROVIDER", "litellm")
    monkeypatch.setenv("AGENT_RUNTIME_API_BASE", "http://litellm.internal:4000")
    monkeypatch.setenv("AGENT_RUNTIME_API_KEY", "sk-test")
    monkeypatch.setenv("AGENT_RUNTIME_FALLBACK_MODEL", "openrouter/anthropic/claude-sonnet-4.5")

    with TestClient(asgi_app) as client:
        runtime = client.get("/market/runtime")
        assert runtime.status_code == 200, runtime.text
        payload = runtime.json()
        assert payload["runtime"]["provider"] == "litellm"
        assert payload["runtime"]["configured"] is True
        assert len(payload["agents"]) == 6
        assert any(item["agent_slug"] == "ts-migrator" for item in payload["agents"])

        ts_runtime = client.get("/market/runtime?agent_slug=ts-migrator")
        assert ts_runtime.status_code == 200, ts_runtime.text
        ts_payload = ts_runtime.json()["runtime"]
        assert ts_payload["agent_slug"] == "ts-migrator"
        assert ts_payload["model"] == "agents/ts-migrator"
        assert ts_payload["fallback_model"] == "openrouter/anthropic/claude-sonnet-4.5"
        assert ts_payload["adapter"] == "ts-migrator"
        assert ts_payload["has_api_key"] is True


def test_market_runtime_status_supports_hosted_only_agent_resolution(asgi_app, monkeypatch):
    monkeypatch.delenv("AGENT_RUNTIME_API_BASE", raising=False)
    monkeypatch.delenv("AGENT_RUNTIME_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-test")
    monkeypatch.setenv(
        "AGENT_RUNTIME_MODEL_MAP_JSON",
        json.dumps(
            {
                "agents/default": "anthropic/claude-sonnet-4-5",
                "agents/ts-migrator": "anthropic/claude-sonnet-4-5",
            }
        ),
    )

    with TestClient(asgi_app) as client:
        ts_runtime = client.get("/market/runtime?agent_slug=ts-migrator")
        assert ts_runtime.status_code == 200, ts_runtime.text
        payload = ts_runtime.json()["runtime"]
        assert payload["model"] == "agents/ts-migrator"
        assert payload["resolved_model"] == "anthropic/claude-sonnet-4-5"
        assert payload["configured"] is True
        assert payload["has_api_key"] is True


def test_market_autopilot_executes_local_fix(asgi_app, tmp_path):
    repo_path = tmp_path / "demo-ts-repo"
    repo_path.mkdir()
    (repo_path / ".github").mkdir()
    (repo_path / ".github" / "workflows").mkdir()
    (repo_path / ".github" / "workflows" / "ci.yml").write_text(
        "name: CI\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v3\n      - uses: actions/setup-node@v3\n",
        encoding="utf-8",
    )
    (repo_path / "tsconfig.json").write_text('{"compilerOptions":{"strict":true}}\n', encoding="utf-8")

    with TestClient(asgi_app) as client:
        repo_setup = client.post(
            "/market/repositories/setup",
            json={
                "installation_id": 106,
                "repos": ["local/demo-ts-repo"],
                "local_path": str(repo_path),
                "budget_priority": ["platform_credits", "api_key_pool"],
            },
        )
        assert repo_setup.status_code == 200, repo_setup.text

        seeded = client.post("/market/agents/seed")
        assert seeded.status_code == 200, seeded.text

        job = client.post(
            "/market/jobs",
            json={
                "repo_full_name": "local/demo-ts-repo",
                "job_class": "ci_repair",
                "title": "Repair workflow drift",
                "metadata": {"pod": "typescript", "lane": "migration", "required_trust_tier": "trusted"},
            },
        )
        assert job.status_code == 201, job.text
        job_id = job.json()["job"]["id"]

        autopilot = client.post(f"/market/jobs/{job_id}/autopilot", json={})
        assert autopilot.status_code == 200, autopilot.text
        body = autopilot.json()
        assert body["recommendation"]["slug"] == "ts-migrator"
        assert body["assignment"]["agent_id"] == body["recommendation"]["agent_id"]
        assert body["run"]["status"] == "completed"
        assert body["submission"]["status"] == "submitted"
        assert ".github/workflows/ci.yml" in body["run"]["changed_files"]
        assert body["run"]["evidence"]["changes_applied"] is True

        workflow = (repo_path / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        assert "actions/checkout@v4" in workflow
        assert "actions/setup-node@v4" in workflow
        tsconfig = (repo_path / "tsconfig.json").read_text(encoding="utf-8")
        assert '"skipLibCheck": true' in tsconfig
        assert '"noEmit": true' in tsconfig

        invocations = client.get(f"/market/jobs/{job_id}/invocations")
        assert invocations.status_code == 200, invocations.text
        invocation_rows = invocations.json()["invocations"]
        assert len(invocation_rows) == 1
        assert invocation_rows[0]["agent_id"] == body["assignment"]["agent_id"]
        assert invocation_rows[0]["status"] in {"completed", "fallback"}

        detail = client.get(f"/market/jobs/{job_id}")
        assert detail.status_code == 200, detail.text
        detail_body = detail.json()
        assert len(detail_body["runs"]) == 1
        assert len(detail_body["submissions"]) == 1
        assert len(detail_body["invocations"]) == 1


def test_market_scan_and_promote_opportunity(asgi_app, tmp_path):
    repo_path = tmp_path / "demo-upgrade-repo"
    (repo_path / ".github" / "workflows").mkdir(parents=True)
    (repo_path / ".github" / "workflows" / "ci.yml").write_text(
        "name: CI\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v3\n",
        encoding="utf-8",
    )
    (repo_path / "package.json").write_text(
        json.dumps(
            {
                "name": "demo",
                "dependencies": {"typescript": "^4.9.5"},
            }
        ) + "\n",
        encoding="utf-8",
    )
    (repo_path / "tsconfig.json").write_text('{"compilerOptions":{"strict":true}}\n', encoding="utf-8")

    with TestClient(asgi_app) as client:
        repo_setup = client.post(
            "/market/repositories/setup",
            json={
                "installation_id": 107,
                "repos": ["local/upgrade-demo"],
                "local_path": str(repo_path),
            },
        )
        assert repo_setup.status_code == 200, repo_setup.text

        scan = client.post("/market/repositories/local/upgrade-demo/scan", json={})
        assert scan.status_code == 200, scan.text
        scan_body = scan.json()
        assert len(scan_body["opportunities"]) >= 2

        listed = client.get("/market/opportunities?repo=local/upgrade-demo")
        assert listed.status_code == 200, listed.text
        opportunities = listed.json()["opportunities"]
        assert len(opportunities) >= 2

        promoted = client.post(f"/market/opportunities/{opportunities[0]['id']}/promote", json={})
        assert promoted.status_code == 200, promoted.text
        promoted_body = promoted.json()
        assert promoted_body["job"]["repo_full_name"] == "local/upgrade-demo"
        assert promoted_body["job"]["source_event_key"].startswith("opp:")


def test_github_install_setup_and_scan_populates_market_jobs(asgi_app, monkeypatch):
    import gateway.routes.github as github

    monkeypatch.setattr(github, "get_installation_token", lambda installation_id: "ghs_test")
    monkeypatch.setattr(github, "gh_ensure_bountynet_yml", lambda token, repo: {"created": False})
    monkeypatch.setattr(github, "emit", lambda *args, **kwargs: None)

    class _Resp:
        def __init__(self, status_code, payload=None, text=""):
            self.status_code = status_code
            self._payload = payload or {}
            self.text = text

        def json(self):
            return self._payload

    def fake_get(url, headers=None, params=None, timeout=10):
        if url.endswith("/actions/runs") and params and params.get("status") == "failure":
            return _Resp(
                200,
                {
                    "workflow_runs": [
                        {
                            "id": 77,
                            "name": "CI",
                            "head_sha": "abcdef1234567890",
                            "head_branch": "main",
                            "created_at": "2026-04-10T00:00:00Z",
                            "html_url": "https://github.com/acme/api/actions/runs/77",
                        }
                    ]
                },
            )
        if url.endswith("/actions/runs") and params and params.get("status") == "success":
            return _Resp(200, {"workflow_runs": []})
        if url.endswith("/contents/.github/workflows"):
            return _Resp(200, [{"name": "ci.yml", "download_url": "https://download.test/ci.yml"}])
        if url == "https://download.test/ci.yml":
            return _Resp(200, text="name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n")
        raise AssertionError(f"unexpected GET {url} params={params}")

    monkeypatch.setattr(github.requests, "get", fake_get)

    install_payload = {
        "action": "created",
        "installation": {"id": 303, "account": {"login": "acme", "id": 999}},
        "repositories": [{"full_name": "acme/api"}],
    }

    with TestClient(asgi_app) as client:
        installed = client.post(
            "/github/webhook",
            json=install_payload,
            headers={"X-GitHub-Event": "installation", "X-Hub-Signature-256": "sha256=test"},
        )
        assert installed.status_code == 200, installed.text

        configured = client.post(
            "/github/setup",
            json={
                "installation_id": 303,
                "repos": ["acme/api"],
                "owner": "acme",
                "api_key": "sk-test",
                "budget_tokens": 5000,
                "enabled_job_classes": ["ci_repair", "dependency_update"],
                "required_checks": ["CI"],
                "per_job_spend_cap": 750,
            },
        )
        assert configured.status_code == 200, configured.text

        scanned = client.post("/github/scan/303", json={"repos": ["acme/api"]})
        assert scanned.status_code == 200, scanned.text
        body = scanned.json()
        assert body["total_jobs_created"] == 1

        repo_accounts = client.get("/market/repositories?installation_id=303")
        assert repo_accounts.status_code == 200, repo_accounts.text
        [repo] = repo_accounts.json()["repositories"]
        assert repo["repo_full_name"] == "acme/api"
        assert repo["required_checks"] == ["CI"]
        assert repo["has_api_key_pool"] is True

        jobs = client.get("/market/jobs?repo=acme/api")
        assert jobs.status_code == 200, jobs.text
        [job] = jobs.json()["jobs"]
        assert job["job_class"] == "ci_repair"
        assert job["trigger_source"] == "github_actions_failure"
        assert job["budget_ceiling"] == 750


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
