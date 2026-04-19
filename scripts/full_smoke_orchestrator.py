#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


BASE_URL = os.getenv("GATEWAY_BASE_URL", "http://127.0.0.1:8090").rstrip("/")
CHAOS_ENABLED = os.getenv("FULL_SMOKE_CHAOS", "1").lower() not in {"0", "false", "no"}
CHAOS_AGENT_COUNT = int(os.getenv("FULL_SMOKE_CHAOS_AGENT_COUNT", "2000"))
CHAOS_REPO_COUNT = int(os.getenv("FULL_SMOKE_CHAOS_REPO_COUNT", "1111"))
CHAOS_REPO_BATCH = max(1, int(os.getenv("FULL_SMOKE_CHAOS_REPO_BATCH", "200")))


def _request(method: str, path: str, payload: dict | None = None, allow: set[int] | None = None) -> tuple[int, dict]:
    allow = allow or {200}
    url = f"{BASE_URL}{path}"
    body = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8") or "{}"
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8") or "{}"
    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"_raw": raw}
    else:
        data = {}
    if status not in allow:
        raise RuntimeError(f"{method} {path} failed ({status}): {raw}")
    return status, data


def _write_repo_fixture(repo_dir: Path) -> None:
    (repo_dir / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
    (repo_dir / ".github" / "workflows" / "ci.yml").write_text(
        "name: CI\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v3\n      - uses: actions/setup-node@v3\n",
        encoding="utf-8",
    )
    (repo_dir / "tsconfig.json").write_text('{"compilerOptions":{"strict":true}}\n', encoding="utf-8")
    (repo_dir / "package.json").write_text(
        json.dumps({"name": "persona-demo", "dependencies": {"typescript": "^4.9.5"}}) + "\n",
        encoding="utf-8",
    )


def _seed_repo_in_gateway_container(run_id: str) -> str:
    compose_cmd = [
        "docker",
        "compose",
        "-p",
        "bountynet-laptop",
        "-f",
        "docker/laptop/docker-compose.yml",
        "--profile",
        "full",
        "ps",
        "-q",
        "gateway",
    ]
    container_id = subprocess.check_output(compose_cmd, text=True).strip()
    if not container_id:
        raise RuntimeError("Unable to resolve running gateway container id for smoke orchestrator")

    with tempfile.TemporaryDirectory(prefix=f"bn-smoke-repo-src-{run_id}-") as td:
        local_dir = Path(td)
        _write_repo_fixture(local_dir)
        target = f"/tmp/bn-smoke-repo-{run_id}"
        subprocess.check_call(["docker", "exec", container_id, "rm", "-rf", target])
        subprocess.check_call(["docker", "cp", f"{local_dir}/.", f"{container_id}:{target}"])
    return f"/tmp/bn-smoke-repo-{run_id}"


def _chunks(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> int:
    run_id = str(int(time.time()))
    operator_slug = f"local-operator-{run_id}"
    repo_full_name = f"local/persona-demo-{run_id}"
    milestones: list[dict] = []

    # 1) Core health
    _request("GET", "/health")
    milestones.append({"name": "gateway_health", "ok": True})

    # 2) Agent-operator persona onboarding + 6 agents
    _, op = _request(
        "POST",
        "/market/operators",
        {
            "slug": operator_slug,
            "display_name": f"Local Operator {run_id}",
            "summary": "Smoke orchestrator operator",
            "contact_email": f"ops+{run_id}@local.test",
        },
        allow={200},
    )
    operator_id = op["operator"]["id"]
    _request(
        "POST",
        f"/market/operators/{operator_id}/onboard",
        {
            "identity_anchor": f"dynamic:{operator_slug}",
            "wallet": "0x1111111111111111111111111111111111111111",
            "verification_status": "verified",
        },
        allow={200},
    )

    agent_specs = [
        ("ts-migrator", "typescript", "migration", ["ci_repair", "dependency_update"], ["typescript", "github_actions"]),
        ("ts-auditor", "typescript", "security_audit", ["security_update", "ci_repair"], ["typescript", "github_actions"]),
        ("ts-architect", "typescript", "planning", ["ci_repair", "dependency_update"], ["typescript"]),
        ("rust-porter", "rust", "porting", ["dependency_update", "ci_repair"], ["rust"]),
        ("rust-sentinel", "rust", "security_patch", ["security_update", "ci_repair"], ["rust"]),
        ("rust-optimizer", "rust", "optimization", ["ci_repair", "dependency_update"], ["rust"]),
    ]

    created_agent_ids: list[str] = []
    for slug, pod, lane, classes, ecosystems in agent_specs:
        _, agent = _request(
            "POST",
            "/market/agents",
            {
                "slug": f"{operator_slug}-{slug}",
                "display_name": f"{operator_slug}-{slug}",
                "operator_id": operator_id,
                "agent_kind": "specialist",
                "pod": pod,
                "lane": lane,
                "supported_job_classes": classes,
                "supported_ecosystems": ecosystems,
                "supported_budget_types": ["platform_credits"],
                "status": "active",
            },
            allow={200},
        )
        created_agent_ids.append(agent["agent"]["id"])

    _, agents_list = _request("GET", "/market/agents")
    visible = {a["id"] for a in agents_list["agents"]}
    if not all(aid in visible for aid in created_agent_ids):
        raise RuntimeError("Not all created agents are visible in /market/agents")
    _, operators_list = _request("GET", "/market/operators")
    if not any(op_item.get("id") == operator_id for op_item in operators_list.get("operators", [])):
        raise RuntimeError("Created operator is not visible in /market/operators")
    milestones.append({"name": "operator_onboarded_with_6_agents", "ok": True, "operator_id": operator_id, "agent_count": 6})

    # Manifests are what downstream matching/execution consume; roundtrip once.
    seed_agent_id = created_agent_ids[0]
    _request(
        "POST",
        f"/market/agents/{seed_agent_id}/manifest",
        {"checks": ["lint", "test"], "sandbox": "docker", "supports_apply": False},
        allow={200},
    )
    _, manifest = _request("GET", f"/market/agents/{seed_agent_id}/manifest", allow={200})
    if not manifest.get("manifest"):
        raise RuntimeError("Agent manifest roundtrip did not persist")
    milestones.append({"name": "agent_manifest_roundtrip", "ok": True, "agent_id": seed_agent_id})

    # 3) Repo-owner persona onboarding
    repo_path_in_gateway = _seed_repo_in_gateway_container(run_id)
    _request(
        "POST",
        "/market/repositories/setup",
        {
            "installation_id": int(run_id),
            "repos": [repo_full_name],
            "owner": "local",
            "local_path": repo_path_in_gateway,
            "enabled_job_classes": ["ci_repair", "dependency_update"],
            "required_checks": ["CI"],
            "budget_priority": ["platform_credits", "api_key_pool"],
            "monthly_spend_cap": 10000,
            "per_job_spend_cap": 1000,
        },
        allow={200},
    )
    _, repos = _request("GET", "/market/repositories", allow={200})
    if not any(repo.get("repo_full_name") == repo_full_name for repo in repos.get("repositories", [])):
        raise RuntimeError("Repository setup not visible in /market/repositories")
    milestones.append({"name": "repo_owner_onboarded", "ok": True, "repo": repo_full_name})

    # 4) Repo has opportunities (proxy for bounties backlog)
    encoded_repo = urllib.parse.quote(repo_full_name, safe="/")
    _, scan = _request("POST", f"/market/repositories/{encoded_repo}/scan", {}, allow={200})
    if not scan.get("opportunities"):
        raise RuntimeError("Repository scan returned no opportunities")
    _, opps = _request("GET", f"/market/opportunities?repo={urllib.parse.quote(repo_full_name, safe='')}", allow={200})
    if not opps.get("opportunities"):
        raise RuntimeError("Opportunities are not visible in /market/opportunities")
    opportunity_id = scan["opportunities"][0]["id"]

    _, promoted = _request("POST", f"/market/opportunities/{opportunity_id}/promote", {}, allow={200})
    job_id = promoted["job"]["id"]
    _, jobs = _request("GET", f"/market/jobs?repo={urllib.parse.quote(repo_full_name, safe='')}", allow={200})
    if not jobs.get("jobs"):
        raise RuntimeError("Promoted job not visible in /market/jobs")
    milestones.append({"name": "opportunity_promoted_to_job", "ok": True, "job_id": job_id})

    # 5) Matching/recommendation
    _, recs = _request("POST", f"/market/jobs/{job_id}/recommendations", {}, allow={200})
    if not recs.get("recommendations"):
        raise RuntimeError("No recommendations produced for promoted job")
    top = next((item for item in recs["recommendations"] if item.get("policy_pass")), None)
    if not top:
        raise RuntimeError("No policy-eligible recommendation produced for promoted job")
    agent_id = top["agent_id"]
    milestones.append({"name": "agent_matching_available", "ok": True, "recommended_agent_id": agent_id})

    # 6) Plan + assignment
    _, plan = _request(
        "POST",
        f"/market/jobs/{job_id}/plans",
        {
            "agent_id": agent_id,
            "operator_id": operator_id,
            "summary": "Analyze CI issue, prepare minimal patch, run checks",
            "steps": ["analyze", "patch", "validate"],
        },
        allow={201},
    )
    plan_id = plan["plan"]["id"]
    _, assignment = _request(
        "POST",
        f"/market/jobs/{job_id}/assignments",
        {
            "recommendation_id": top["recommendation_id"],
            "agent_id": agent_id,
            "plan_id": plan_id,
            "assigned_by": "smoke-orchestrator",
            "mode": "exclusive",
            "lease_seconds": 900,
        },
        allow={201},
    )
    assignment_id = assignment["assignment"]["id"]
    milestones.append({"name": "agent_assigned_to_job", "ok": True, "assignment_id": assignment_id})

    # 7) Fulfillment attempt (can fail on tiny model quality; attempt is the milestone)
    status, execute = _request(
        "POST",
        f"/market/jobs/{job_id}/execute",
        {
            "assignment_id": assignment_id,
            "mode": "dry_run",
            "force": True,
            "idempotency_key": f"orchestrator-{run_id}",
        },
        allow={200, 400},
    )
    attempted = status in {200, 400}
    _, runs = _request("GET", f"/market/jobs/{job_id}/runs", allow={200})
    _, invocations = _request("GET", f"/market/jobs/{job_id}/invocations", allow={200})
    _, detail = _request("GET", f"/market/jobs/{job_id}", allow={200})
    milestones.append(
        {
            "name": "agent_fulfillment_attempted",
            "ok": attempted,
            "execute_status": status,
            "execute_payload": execute,
            "run_count": len(runs.get("runs", [])),
            "invocation_count": len(invocations.get("invocations", [])),
            "job_status": detail.get("job", {}).get("status"),
        }
    )

    # 8) Autopilot on a second job to exercise router-owned flow.
    _, direct_job = _request(
        "POST",
        "/market/jobs",
        {
            "repo_full_name": repo_full_name,
            "job_class": "ci_repair",
            "title": "Autopilot smoke job",
            "summary": "Drive router recommendation + execution in one endpoint",
            "budget_ceiling": 900,
        },
        allow={201},
    )
    auto_job_id = direct_job["job"]["id"]
    auto_status, auto_payload = _request(
        "POST",
        f"/market/jobs/{auto_job_id}/autopilot",
        {"mode": "dry_run"},
        allow={200, 400},
    )
    milestones.append(
        {
            "name": "autopilot_flow_attempted",
            "ok": auto_status in {200, 400},
            "job_id": auto_job_id,
            "autopilot_status": auto_status,
            "autopilot_payload": auto_payload,
        }
    )

    # 9) Fill low-coverage market surfaces.
    _, operator_detail = _request("GET", f"/market/operators/{operator_id}", allow={200})
    _, runtime = _request("GET", "/market/runtime", allow={200})
    _, lane_presets = _request("GET", "/market/presets/lanes", allow={200})
    _request("POST", "/market/specialists/seed", {}, allow={200})
    specialist_slug = f"smoke-specialist-{run_id}"
    _request(
        "POST",
        "/market/specialists",
        {
            "slug": specialist_slug,
            "display_name": f"Smoke Specialist {run_id}",
            "pod": "typescript",
            "lane": "planning",
            "summary": "Coverage probe specialist",
            "supported_job_classes": ["ci_repair"],
            "supported_ecosystems": ["typescript"],
            "supported_budget_types": ["platform_credits"],
            "status": "active",
        },
        allow={200},
    )
    _, specialists = _request("GET", "/market/specialists", allow={200})
    _, recs_listed = _request("GET", f"/market/jobs/{job_id}/recommendations", allow={200})
    _, plans_listed = _request("GET", f"/market/jobs/{job_id}/plans", allow={200})
    _, assignments_listed = _request("GET", f"/market/jobs/{job_id}/assignments", allow={200})

    _, extra_submission = _request(
        "POST",
        "/market/submissions",
        {
            "job_id": job_id,
            "agent_id": agent_id,
            "branch_name": f"agent/{operator_slug}/coverage-{run_id}",
            "diff_summary": "Coverage-only submission to exercise review + decision surfaces",
            "evidence": {"source": "full_smoke_orchestrator", "coverage_run_id": run_id},
            "status": "submitted",
        },
        allow={201},
    )
    extra_submission_id = extra_submission["submission"]["id"]
    _request(
        "POST",
        f"/market/submissions/{extra_submission_id}/reviews",
        {
            "action": "start_review",
            "reviewer_id": "smoke-maintainer",
            "reviewer_role": "maintainer",
            "summary": "Coverage review started",
        },
        allow={201},
    )
    _request(
        "POST",
        f"/market/submissions/{extra_submission_id}/reviews",
        {
            "action": "approve",
            "reviewer_id": "smoke-maintainer",
            "reviewer_role": "maintainer",
            "summary": "Coverage review approved",
        },
        allow={201},
    )
    _, review_list = _request("GET", f"/market/submissions/{extra_submission_id}/reviews", allow={200})
    _, decision = _request(
        "POST",
        f"/market/submissions/{extra_submission_id}/decision",
        {
            "decision": "accepted",
            "acceptance_attribution": "smoke_coverage",
            "merged_by": "smoke-maintainer",
            "notes": "Coverage path acceptance",
            "payout_amount": 1,
            "currency": "credits",
            "funding_source": "platform_credits",
            "operator_id": operator_id,
        },
        allow={200},
    )
    milestones.append(
        {
            "name": "low_coverage_market_surfaces_exercised",
            "ok": True,
            "operator_detail_loaded": bool(operator_detail.get("operator")),
            "runtime_loaded": bool(runtime),
            "lane_presets_count": len(lane_presets.get("presets", {})),
            "specialists_count": len(specialists.get("specialists", [])),
            "recommendations_listed": len(recs_listed.get("recommendations", [])),
            "plans_listed": len(plans_listed.get("plans", [])),
            "assignments_listed": len(assignments_listed.get("assignments", [])),
            "submission_id": extra_submission_id,
            "review_count": len(review_list.get("reviews", [])),
            "decision_status": decision.get("status"),
            "payout_count": len(decision.get("payouts", [])),
        }
    )

    # 10) Chaos pass: load market surfaces with many agents/repos.
    if CHAOS_ENABLED and (CHAOS_AGENT_COUNT > 0 or CHAOS_REPO_COUNT > 0):
        chaos_operator_slug = f"chaos-operator-{run_id}"
        _, chaos_operator = _request(
            "POST",
            "/market/operators",
            {
                "slug": chaos_operator_slug,
                "display_name": f"Chaos Operator {run_id}",
                "summary": "High-volume smoke stress operator",
                "contact_email": f"chaos+{run_id}@local.test",
                "status": "active",
            },
            allow={200},
        )
        chaos_operator_id = chaos_operator["operator"]["id"]
        _request(
            "POST",
            f"/market/operators/{chaos_operator_id}/onboard",
            {
                "identity_anchor": f"dynamic:{chaos_operator_slug}",
                "wallet": "0x2222222222222222222222222222222222222222",
                "verification_status": "verified",
            },
            allow={200},
        )

        pods = ["typescript", "rust", "github_actions"]
        lanes = ["migration", "security_audit", "planning", "workflow_repair", "optimization"]
        job_classes = ["ci_repair", "dependency_update", "security_update"]

        for i in range(CHAOS_AGENT_COUNT):
            pod = pods[i % len(pods)]
            lane = lanes[i % len(lanes)]
            slug = f"chaos-{run_id}-agent-{i:04d}"
            _request(
                "POST",
                "/market/agents",
                {
                    "slug": slug,
                    "display_name": slug,
                    "operator_id": chaos_operator_id,
                    "agent_kind": "specialist",
                    "pod": pod,
                    "lane": lane,
                    "supported_job_classes": [job_classes[i % len(job_classes)], "ci_repair"],
                    "supported_ecosystems": [pod],
                    "supported_budget_types": ["platform_credits"],
                    "status": "active",
                },
                allow={200},
            )
            if (i + 1) % 250 == 0:
                print(f"chaos: created {i + 1}/{CHAOS_AGENT_COUNT} agents", flush=True)

        chaos_repo_names = [f"local/chaos-{run_id}-repo-{i:04d}" for i in range(CHAOS_REPO_COUNT)]
        repo_batches = _chunks(chaos_repo_names, CHAOS_REPO_BATCH)
        for batch_idx, batch in enumerate(repo_batches, start=1):
            _request(
                "POST",
                "/market/repositories/setup",
                {
                    "installation_id": int(run_id) + batch_idx,
                    "repos": batch,
                    "owner": "local",
                    "local_path": repo_path_in_gateway,
                    "enabled_job_classes": ["ci_repair", "dependency_update"],
                    "required_checks": ["CI"],
                    "budget_priority": ["platform_credits"],
                    "monthly_spend_cap": 1000,
                    "per_job_spend_cap": 100,
                },
                allow={200},
            )
            print(
                f"chaos: configured repos batch {batch_idx}/{len(repo_batches)}",
                flush=True,
            )

        _, all_agents = _request("GET", "/market/agents", allow={200})
        _, all_repos = _request("GET", "/market/repositories", allow={200})
        chaos_agents_seen = [
            a
            for a in all_agents.get("agents", [])
            if (a.get("slug") or "").startswith(f"chaos-{run_id}-agent-")
        ]
        chaos_repos_seen = [
            r
            for r in all_repos.get("repositories", [])
            if (r.get("repo_full_name") or "").startswith(f"local/chaos-{run_id}-repo-")
        ]
        if len(chaos_agents_seen) < CHAOS_AGENT_COUNT:
            raise RuntimeError(
                f"Chaos agent creation shortfall: expected {CHAOS_AGENT_COUNT}, got {len(chaos_agents_seen)}"
            )
        if len(chaos_repos_seen) < CHAOS_REPO_COUNT:
            raise RuntimeError(
                f"Chaos repo setup shortfall: expected {CHAOS_REPO_COUNT}, got {len(chaos_repos_seen)}"
            )
        milestones.append(
            {
                "name": "chaos_bulk_market_population",
                "ok": True,
                "chaos_operator_id": chaos_operator_id,
                "agents_created": len(chaos_agents_seen),
                "repos_configured": len(chaos_repos_seen),
            }
        )

    out = {
        "status": "ok",
        "run_id": run_id,
        "base_url": BASE_URL,
        "milestones": milestones,
    }
    out_path = Path(f"/tmp/bn-full-orchestrator-{run_id}.json")
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
