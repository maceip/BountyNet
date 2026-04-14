from __future__ import annotations

import time
import uuid
from pathlib import Path

from flask import Blueprint, Response, jsonify, request

from gateway import store
from gateway.agent_fleet import AGENT_SERVING_PROFILES
from gateway.agent_service import execute_agent_assignment, runtime_status_for_agent
from gateway.events import emit
from gateway.langfuse_market import contract_trace, score_contract_acceptance, update_contract_trace
from gateway.market_exec import discover_repo_opportunities, execute_managed_job
from gateway.model_runtime import runtime_summary

market_bp = Blueprint("market", __name__)


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


_TRUST_ORDER = {"standard": 1, "trusted": 2, "critical": 3}

_MANAGED_SPECIALISTS = [
    {"slug": "ts-migrator", "display_name": "TypeScript Migrator", "pod": "typescript", "lane": "migration", "summary": "Handles framework, dependency, and config migrations in TypeScript repositories.", "supported_job_classes": ["ci_repair", "dependency_update", "config_remediation", "codemod"], "supported_ecosystems": ["typescript", "node", "react", "nextjs"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "trusted", "review_requirement": "maintainer_review"},
    {"slug": "ts-auditor", "display_name": "TypeScript Auditor", "pod": "typescript", "lane": "security_audit", "summary": "Finds and patches TypeScript dependency, policy, and app security issues.", "supported_job_classes": ["security_update", "dependency_update", "ci_repair"], "supported_ecosystems": ["typescript", "node", "react", "nextjs"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "critical", "review_requirement": "maintainer_review"},
    {"slug": "ts-architect", "display_name": "TypeScript Architect", "pod": "typescript", "lane": "architecture_refactor", "summary": "Reshapes TypeScript codebases toward cleaner module boundaries and safer abstractions.", "supported_job_classes": ["codemod", "config_remediation", "lint_cleanup", "type_repair"], "supported_ecosystems": ["typescript", "node", "react", "nextjs"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "trusted", "review_requirement": "maintainer_review"},
    {"slug": "rust-porter", "display_name": "Rust Porter", "pod": "rust", "lane": "porting", "summary": "Ports logic into idiomatic Rust and cleans up build and integration edges.", "supported_job_classes": ["codemod", "dependency_update", "config_remediation"], "supported_ecosystems": ["rust", "cargo", "ffi"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "trusted", "review_requirement": "maintainer_review"},
    {"slug": "rust-sentinel", "display_name": "Rust Sentinel", "pod": "rust", "lane": "security_patch", "summary": "Applies scoped Cargo and code-level security patches with higher trust requirements.", "supported_job_classes": ["security_update", "dependency_update"], "supported_ecosystems": ["rust", "cargo"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "critical", "review_requirement": "maintainer_review"},
    {"slug": "rust-optimizer", "display_name": "Rust Optimizer", "pod": "rust", "lane": "performance_optimization", "summary": "Improves Rust performance and reliability without widening the change surface.", "supported_job_classes": ["test_repair", "config_remediation", "codemod"], "supported_ecosystems": ["rust", "cargo", "tokio"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "trusted", "review_requirement": "maintainer_review"},
]

_MANAGED_AGENTS = [
    {"slug": "generic-ts-maintainer", "display_name": "Generic TS Maintainer", "agent_kind": "generic", "pod": "typescript", "lane": "maintenance", "summary": "Broad low-cost TypeScript maintenance coverage for CI, config, and dependency jobs.", "supported_job_classes": ["ci_repair", "dependency_update", "test_repair", "config_remediation"], "supported_ecosystems": ["typescript", "node", "react", "nextjs"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "standard", "pricing_profile": "per_accepted_change", "acceptance_rate_30d": 0.51, "median_time_to_pr_seconds": 900, "revert_rate_90d": 0.08, "badges": ["managed", "generic", "typescript"], "execution_backend": "shared_model_runtime", "model": "agents/default"},
    {"slug": "generic-rust-maintainer", "display_name": "Generic Rust Maintainer", "agent_kind": "generic", "pod": "rust", "lane": "maintenance", "summary": "Broad low-cost Rust maintenance coverage for dependency, CI, and config jobs.", "supported_job_classes": ["ci_repair", "dependency_update", "config_remediation", "test_repair"], "supported_ecosystems": ["rust", "cargo"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "standard", "pricing_profile": "per_accepted_change", "acceptance_rate_30d": 0.48, "median_time_to_pr_seconds": 960, "revert_rate_90d": 0.07, "badges": ["managed", "generic", "rust"], "execution_backend": "shared_model_runtime", "model": "agents/default"},
    {"slug": "generic-ci-maintainer", "display_name": "Generic CI Maintainer", "agent_kind": "generic", "pod": "github_actions", "lane": "workflow_repair", "summary": "Repairs broad GitHub Actions and workflow drift issues at low cost.", "supported_job_classes": ["ci_repair", "config_remediation"], "supported_ecosystems": ["github_actions", "typescript", "rust"], "supported_budget_types": ["platform_credits", "api_key_pool"], "trust_tier": "standard", "pricing_profile": "per_accepted_change", "acceptance_rate_30d": 0.54, "median_time_to_pr_seconds": 720, "revert_rate_90d": 0.04, "badges": ["managed", "generic", "ci"], "execution_backend": "shared_model_runtime", "model": "agents/default"},
]

_LANE_PRESETS = {
    "typescript_ci_repair": {"enabled_job_classes": ["ci_repair", "type_repair", "config_remediation"], "review_policy": "maintainer_review", "merge_policy": "manual_merge", "budget_priority": ["api_key_pool", "platform_credits"], "required_checks": ["CI", "Typecheck"], "blocked_paths": [], "allowed_agent_pools": ["managed-typescript", "managed-generic"], "job_metadata": {"pod": "typescript", "lane": "migration", "required_trust_tier": "trusted"}},
    "typescript_security_audit": {"enabled_job_classes": ["security_update", "dependency_update", "ci_repair"], "review_policy": "maintainer_review", "merge_policy": "manual_merge", "budget_priority": ["platform_credits", "api_key_pool"], "required_checks": ["CI", "Audit"], "blocked_paths": [], "allowed_agent_pools": ["managed-typescript", "managed-generic"], "job_metadata": {"pod": "typescript", "lane": "security_audit", "required_trust_tier": "critical"}},
    "rust_security_patch": {"enabled_job_classes": ["security_update", "dependency_update"], "review_policy": "maintainer_review", "merge_policy": "manual_merge", "budget_priority": ["api_key_pool", "platform_credits"], "required_checks": ["CI", "Tests", "Audit"], "blocked_paths": [".github/workflows/**"], "allowed_agent_pools": ["managed-rust", "managed-generic"], "job_metadata": {"pod": "rust", "lane": "security_patch", "required_trust_tier": "critical"}},
    "rust_porting": {"enabled_job_classes": ["codemod", "config_remediation", "dependency_update"], "review_policy": "maintainer_review", "merge_policy": "manual_merge", "budget_priority": ["platform_credits", "api_key_pool"], "required_checks": ["CI", "Tests"], "blocked_paths": [], "allowed_agent_pools": ["managed-rust", "managed-generic"], "job_metadata": {"pod": "rust", "lane": "porting", "required_trust_tier": "trusted"}},
}


def _trust_value(label: str) -> int:
    return _TRUST_ORDER.get((label or "").strip(), 0)


def _plan_required(job: dict, lane: str = "") -> bool:
    return job.get("risk_level") in {"medium", "high"} or lane in {"migration", "security_audit", "security_patch", "porting", "architecture_refactor", "performance_optimization"}


def _seed_managed_specialists() -> list[dict]:
    existing = {s["slug"]: s for s in store.market_specialists_list()}
    for spec in _MANAGED_SPECIALISTS:
        store.market_specialist_upsert(
            specialist_id=existing.get(spec["slug"], {}).get("id") or _make_id("spec"),
            slug=spec["slug"],
            display_name=spec["display_name"],
            pod=spec["pod"],
            lane=spec["lane"],
            summary=spec["summary"],
            supported_job_classes=spec["supported_job_classes"],
            supported_ecosystems=spec["supported_ecosystems"],
            supported_budget_types=spec["supported_budget_types"],
            trust_tier=spec["trust_tier"],
            review_requirement=spec["review_requirement"],
            status="active",
        )
    by_slug = {s["slug"]: s for s in store.market_specialists_list(status="active")}
    return [by_slug[s["slug"]] for s in _MANAGED_SPECIALISTS if s["slug"] in by_slug]


def _seed_managed_agents() -> list[dict]:
    specialists = _seed_managed_specialists()
    specialist_map = {s["slug"]: s for s in specialists}
    desired = list(_MANAGED_AGENTS)
    for spec in _MANAGED_SPECIALISTS:
        desired.append(
            {
                "slug": spec["slug"],
                "display_name": spec["display_name"],
                "agent_kind": "specialist",
                "pod": spec["pod"],
                "lane": spec["lane"],
                "summary": spec["summary"],
                "supported_job_classes": spec["supported_job_classes"],
                "supported_ecosystems": spec["supported_ecosystems"],
                "supported_budget_types": spec["supported_budget_types"],
                "trust_tier": spec["trust_tier"],
                "pricing_profile": "per_accepted_change",
                "acceptance_rate_30d": 0.71 if spec["trust_tier"] == "critical" else 0.64,
                "median_time_to_pr_seconds": 1200,
                "revert_rate_90d": 0.03 if spec["trust_tier"] == "critical" else 0.05,
                "badges": ["managed", "specialist", spec["pod"]],
                "execution_backend": "shared_model_runtime",
                "model": f"agents/{spec['slug']}",
                "specialist_id": specialist_map[spec["slug"]]["id"],
            }
        )
    existing = {a["slug"]: a for a in store.market_agent_profiles_list()}
    for agent in desired:
        store.market_agent_profile_upsert(
            agent_id=existing.get(agent["slug"], {}).get("id") or _make_id("agent"),
            slug=agent["slug"],
            display_name=agent["display_name"],
            operator_id="platform-managed",
            summary=agent["summary"],
            agent_kind=agent["agent_kind"],
            pod=agent["pod"],
            lane=agent["lane"],
            supported_job_classes=agent["supported_job_classes"],
            supported_ecosystems=agent["supported_ecosystems"],
            supported_budget_types=agent["supported_budget_types"],
            model=agent["model"],
            execution_backend=agent["execution_backend"],
            specialist_id=agent.get("specialist_id", ""),
            trust_tier=agent["trust_tier"],
            pricing_profile=agent["pricing_profile"],
            acceptance_rate_30d=agent["acceptance_rate_30d"],
            median_time_to_pr_seconds=agent["median_time_to_pr_seconds"],
            revert_rate_90d=agent["revert_rate_90d"],
            badges=agent["badges"],
            status="active",
        )
    slugs = {agent["slug"] for agent in desired}
    return [a for a in store.market_agent_profiles_list(status="active") if a["slug"] in slugs]


def _set_job_status(job: dict, status: str) -> None:
    store.market_job_upsert(
        job_id=job["id"],
        repository_account_id=job["repository_account_id"],
        repo_full_name=job["repo_full_name"],
        job_class=job["job_class"],
        trigger_source=job["trigger_source"],
        title=job["title"],
        summary=job["summary"],
        risk_level=job["risk_level"],
        acceptance_policy=job["acceptance_policy"],
        budget_ceiling=job["budget_ceiling"],
        status=status,
        candidate_agents=job["candidate_agents"],
        source_event_key=job["source_event_key"],
        metadata=job["metadata"],
        expires_at=job["expires_at"],
    )


def _recommend_agents(job: dict, account: dict, agents: list[dict]) -> list[dict]:
    metadata = job.get("metadata") or {}
    desired_pod = (metadata.get("pod") or metadata.get("language") or "").strip()
    desired_lane = (metadata.get("lane") or "").strip()
    required_trust = (metadata.get("required_trust_tier") or "standard").strip()
    budget_priority = account.get("budget_priority") or []
    allow_generic_fallback = bool(metadata.get("allow_generic_fallback", True))
    recommendations: list[dict] = []
    for agent in agents:
        score = 0
        reasons: list[str] = []
        warnings: list[str] = []
        policy_pass = True
        if job["job_class"] in (agent.get("supported_job_classes") or []):
            score += 40
            reasons.append("job class match")
        else:
            policy_pass = False
            warnings.append("job class unsupported")
        pod_match = desired_pod and (agent.get("pod") == desired_pod or desired_pod in (agent.get("supported_ecosystems") or []))
        if pod_match:
            score += 20
            reasons.append("ecosystem match")
        elif desired_pod:
            warnings.append("ecosystem mismatch")
        if desired_lane and agent.get("lane") == desired_lane:
            score += 20
            reasons.append("lane match")
        elif desired_lane and agent.get("agent_kind") == "generic":
            if allow_generic_fallback:
                score += 6
                reasons.append("generic fallback coverage")
            else:
                policy_pass = False
                warnings.append("generic fallback disabled")
        supported_budget_types = agent.get("supported_budget_types") or []
        budget_compatible = bool(set(supported_budget_types) & set(budget_priority)) if supported_budget_types else True
        if budget_compatible:
            score += 10
            reasons.append("budget compatible")
        else:
            warnings.append("budget type mismatch")
        if _trust_value(agent.get("trust_tier", "")) >= _trust_value(required_trust):
            score += 10
            reasons.append("trust tier satisfies requirement")
        else:
            policy_pass = False
            warnings.append("trust tier too low")
        score += 8 if agent.get("agent_kind") == "specialist" else 3
        reasons.append("specialized fit" if agent.get("agent_kind") == "specialist" else "low-cost generic fallback")
        score += int(round(float(agent.get("acceptance_rate_30d") or 0) * 10)) - int(round(float(agent.get("revert_rate_90d") or 0) * 10))
        reasons.append("historical performance")
        recommendations.append({"recommendation_id": _make_id("rec"), "agent_id": agent["id"], "specialist_id": agent.get("specialist_id", ""), "agent_kind": agent.get("agent_kind", "generic"), "slug": agent["slug"], "display_name": agent["display_name"], "pod": agent.get("pod", ""), "lane": agent.get("lane", ""), "trust_tier": agent["trust_tier"], "pricing_profile": agent.get("pricing_profile", "per_accepted_change"), "score": score, "recommended": policy_pass, "policy_pass": policy_pass, "budget_compatible": budget_compatible, "requires_plan": _plan_required(job, agent.get("lane", "")), "reasons": reasons, "policy_warnings": warnings, "matched_job_classes": [job["job_class"]] if job["job_class"] in (agent.get("supported_job_classes") or []) else [], "matched_ecosystems": [desired_pod] if pod_match else []})
    recommendations.sort(key=lambda item: (item["recommended"], item["score"]), reverse=True)
    return recommendations


def _default_plan(job: dict, recommendation: dict) -> tuple[str, list[str]]:
    return (
        f"Let {recommendation['display_name']} produce a narrow, policy-compliant fix for {job['title']}.",
        ["inspect repository files relevant to the job", "prepare the smallest safe code change", "record evidence and open a maintainer-review submission"],
    )


def _execute_assignment(job: dict, account: dict, assignment: dict, mode: str = "apply") -> tuple[dict, dict | None]:
    agent = store.market_agent_profile_get(assignment["agent_id"])
    if not agent:
        raise ValueError("assigned agent not found")
    if not account.get("local_path"):
        raise ValueError("repository account has no local_path configured")
    plan = store.market_job_plan_get(assignment.get("plan_id", "")) if assignment.get("plan_id") else None
    run_id = _make_id("run")
    with contract_trace(job=job, account=account, agent=agent, assignment=assignment, plan=plan) as trace_ctx:
        base_evidence = {}
        if trace_ctx:
            base_evidence = {
                "langfuse_trace_id": trace_ctx.get("trace_id", ""),
                "langfuse_trace_url": trace_ctx.get("trace_url", ""),
            }
        store.market_execution_run_create(run_id=run_id, job_id=job["id"], agent_id=agent["id"], repository_account_id=account["id"], assignment_id=assignment["id"], mode=mode, status="running", summary=f"Running {agent['display_name']}", logs=[], changed_files=[], evidence=base_evidence, started_at=time.time())
        if agent.get("execution_backend") == "shared_model_runtime":
            result = execute_agent_assignment(agent=agent, job=job, account=account, mode=mode)
        else:
            result = execute_managed_job(repo_path=account["local_path"], job=job, agent=agent, mode=mode)
        evidence = dict(result["evidence"] or {})
        evidence.update(base_evidence)
        result["evidence"] = evidence
        update_contract_trace(
            trace_ctx,
            output={
                "summary": result["summary"],
                "changed_files": result["changed_files"],
                "diff_summary": result["diff_summary"],
            },
            metadata={
                "status": "completed" if result["changed_files"] else "noop",
                "submission_expected": bool(result["changed_files"]),
            },
        )
    submission = None
    if result["changed_files"]:
        submission_id = _make_id("sub")
        store.market_submission_create(submission_id=submission_id, job_id=job["id"], agent_id=agent["id"], branch_name=f"agent/{agent['slug']}/{job['id']}", diff_summary=result["diff_summary"], evidence=result["evidence"], status="submitted")
        submission = store.market_submission_get(submission_id)
        store.market_execution_run_update(run_id, status="completed", summary=result["summary"], logs=result["logs"], changed_files=result["changed_files"], evidence=result["evidence"], submission_id=submission_id, finished_at=time.time())
        emit("agent", f"{agent['display_name']} produced a submission for {job['repo_full_name']}", data={"job_id": job["id"], "submission_id": submission_id})
    else:
        store.market_execution_run_update(run_id, status="noop", summary=result["summary"], logs=result["logs"], changed_files=result["changed_files"], evidence=result["evidence"], finished_at=time.time())
        emit("agent", f"{agent['display_name']} found no safe change for {job['repo_full_name']}", data={"job_id": job["id"]})
    return store.market_execution_run_get(run_id), submission


def _opportunity_to_job(account: dict, opportunity: dict) -> dict:
    return {
        "repository_account_id": account["id"],
        "repo_full_name": account["repo_full_name"],
        "job_class": "config_remediation" if opportunity["opportunity_type"] == "architecture" else "dependency_update",
        "trigger_source": "architecture_scout" if opportunity["opportunity_type"] == "architecture" else "upgrade_scout",
        "title": opportunity["title"],
        "summary": opportunity["summary"],
        "risk_level": "medium" if opportunity["severity"] in {"medium", "high"} else "low",
        "acceptance_policy": "maintainer_accept_or_merge",
        "budget_ceiling": account.get("per_job_spend_cap") or 0,
        "status": "open",
        "candidate_agents": [],
        "source_event_key": f"opp:{opportunity['id']}",
        "metadata": {
            "pod": opportunity["pod"],
            "lane": opportunity["lane"],
            "files": opportunity.get("files") or [],
            "evidence": opportunity.get("evidence") or {},
            "required_trust_tier": "trusted" if opportunity["opportunity_type"] == "architecture" else "standard",
        },
        "expires_at": time.time() + 7 * 24 * 3600,
    }


@market_bp.route("/marketplace", methods=["GET"])
def marketplace_ui():
    asset = Path(__file__).resolve().parents[1] / "market_ui.html"
    if asset.is_file():
        return Response(asset.read_text(encoding="utf-8"), mimetype="text/html")
    return Response("<h1>Agent Market</h1><p>market_ui.html missing</p>", mimetype="text/html")


@market_bp.route("/market/repositories", methods=["GET"])
def list_repository_accounts():
    return jsonify({"repositories": store.market_repository_accounts_list(installation_id=request.args.get("installation_id", type=int))})


@market_bp.route("/market/repositories/setup", methods=["POST"])
def setup_repository_accounts():
    body = request.json or {}
    installation_id = int(body.get("installation_id") or 0)
    repos = body.get("repos") or []
    if not installation_id:
        return jsonify({"error": "installation_id required"}), 400
    if not repos:
        return jsonify({"error": "repos required"}), 400
    updated: list[dict] = []
    for repo in repos:
        current = store.market_repository_account_get_by_repo(repo)
        store.market_repository_account_upsert(
            account_id=current["id"] if current else _make_id("ra"),
            repo_full_name=repo,
            installation_id=installation_id,
            owner_account_id=body.get("owner_account_id") or body.get("owner") or "",
            enabled_job_classes=body.get("enabled_job_classes") or ["ci_repair", "dependency_update", "test_repair", "config_remediation"],
            blocked_paths=body.get("blocked_paths") or [],
            required_checks=body.get("required_checks") or [],
            review_policy=body.get("review_policy") or "maintainer_review",
            merge_policy=body.get("merge_policy") or "manual_merge",
            budget_priority=body.get("budget_priority") or ["platform_credits"],
            monthly_spend_cap=int(body.get("monthly_spend_cap") or 0),
            per_job_spend_cap=int(body.get("per_job_spend_cap") or 0),
            allowed_agent_pools=body.get("allowed_agent_pools") or ["managed-generic"],
            api_key_provider=body.get("api_key_provider") or "",
            has_api_key_pool=bool(body.get("has_api_key_pool")),
            local_path=(body.get("local_path") or (current or {}).get("local_path") or "").strip(),
            default_branch=(body.get("default_branch") or (current or {}).get("default_branch") or "main").strip(),
            status=body.get("status") or "active",
        )
        updated.append(store.market_repository_account_get_by_repo(repo))
    return jsonify({"status": "configured", "repositories": updated})


@market_bp.route("/market/repositories/<path:repo_full_name>/apply-preset", methods=["POST"])
def apply_lane_preset(repo_full_name: str):
    account = store.market_repository_account_get_by_repo(repo_full_name)
    if not account:
        return jsonify({"error": f"repository_account missing for {repo_full_name}"}), 404
    preset = _LANE_PRESETS.get(((request.json or {}).get("preset") or "").strip())
    if not preset:
        return jsonify({"error": "unknown preset"}), 400
    store.market_repository_account_upsert(
        account_id=account["id"],
        repo_full_name=account["repo_full_name"],
        installation_id=account["installation_id"],
        owner_account_id=account["owner_account_id"],
        enabled_job_classes=preset["enabled_job_classes"],
        blocked_paths=preset["blocked_paths"],
        required_checks=preset["required_checks"],
        review_policy=preset["review_policy"],
        merge_policy=preset["merge_policy"],
        budget_priority=preset["budget_priority"],
        monthly_spend_cap=account["monthly_spend_cap"],
        per_job_spend_cap=account["per_job_spend_cap"],
        allowed_agent_pools=preset["allowed_agent_pools"],
        api_key_provider=account["api_key_provider"],
        has_api_key_pool=account["has_api_key_pool"],
        local_path=account["local_path"],
        default_branch=account["default_branch"],
        status=account["status"],
    )
    return jsonify({"status": "preset_applied", "repository": store.market_repository_account_get_by_repo(repo_full_name), "job_metadata_template": preset["job_metadata"]})


@market_bp.route("/market/presets/lanes", methods=["GET"])
def list_lane_presets():
    return jsonify({"presets": _LANE_PRESETS})


@market_bp.route("/market/specialists", methods=["GET"])
def list_specialists():
    return jsonify({"specialists": store.market_specialists_list(status=request.args.get("status"))})


@market_bp.route("/market/specialists", methods=["POST"])
def create_or_update_specialist():
    body = request.json or {}
    slug = (body.get("slug") or "").strip()
    display_name = (body.get("display_name") or "").strip()
    if not slug or not display_name:
        return jsonify({"error": "slug and display_name required"}), 400
    existing = next((s for s in store.market_specialists_list() if s["slug"] == slug), None)
    specialist_id = (body.get("id") or "").strip() or (existing["id"] if existing else _make_id("spec"))
    store.market_specialist_upsert(
        specialist_id=specialist_id,
        slug=slug,
        display_name=display_name,
        pod=(body.get("pod") or "").strip(),
        lane=(body.get("lane") or "").strip(),
        summary=body.get("summary") or "",
        supported_job_classes=body.get("supported_job_classes") or [],
        supported_ecosystems=body.get("supported_ecosystems") or [],
        supported_budget_types=body.get("supported_budget_types") or [],
        trust_tier=body.get("trust_tier") or "standard",
        review_requirement=body.get("review_requirement") or "maintainer_review",
        status=body.get("status") or "active",
    )
    specialist = next((s for s in store.market_specialists_list() if s["id"] == specialist_id), {"id": specialist_id})
    return jsonify({"status": "saved", "specialist": specialist})


@market_bp.route("/market/specialists/seed", methods=["POST"])
def seed_managed_specialists():
    return jsonify({"status": "seeded", "specialists": _seed_managed_specialists()})


@market_bp.route("/market/agents", methods=["GET"])
def list_agents():
    return jsonify({"agents": store.market_agent_profiles_list(status=request.args.get("status"), agent_kind=request.args.get("agent_kind"))})


@market_bp.route("/market/runtime", methods=["GET"])
def get_runtime_status():
    requested_slug = (request.args.get("agent_slug") or "").strip()
    if requested_slug:
        try:
            status = runtime_status_for_agent(requested_slug)
        except ValueError:
            return jsonify({"error": "agent serving profile not found"}), 404
        return jsonify({"runtime": status})
    return jsonify(
        {
            "runtime": runtime_summary(),
            "agents": [
                runtime_status_for_agent(profile.slug)
                for profile in AGENT_SERVING_PROFILES.values()
            ],
        }
    )


@market_bp.route("/market/agents", methods=["POST"])
def create_or_update_agent():
    body = request.json or {}
    slug = (body.get("slug") or "").strip()
    display_name = (body.get("display_name") or "").strip()
    if not slug or not display_name:
        return jsonify({"error": "slug and display_name required"}), 400
    existing = next((a for a in store.market_agent_profiles_list() if a["slug"] == slug), None)
    agent_id = (body.get("id") or "").strip() or (existing["id"] if existing else _make_id("agent"))
    store.market_agent_profile_upsert(
        agent_id=agent_id,
        slug=slug,
        display_name=display_name,
        operator_id=body.get("operator_id") or "",
        summary=body.get("summary") or "",
        agent_kind=body.get("agent_kind") or "generic",
        pod=body.get("pod") or "",
        lane=body.get("lane") or "",
        supported_job_classes=body.get("supported_job_classes") or [],
        supported_ecosystems=body.get("supported_ecosystems") or [],
        supported_budget_types=body.get("supported_budget_types") or [],
        model=body.get("model") or "",
        execution_backend=body.get("execution_backend") or "",
        specialist_id=body.get("specialist_id") or "",
        trust_tier=body.get("trust_tier") or "standard",
        pricing_profile=body.get("pricing_profile") or "per_accepted_change",
        acceptance_rate_30d=float(body.get("acceptance_rate_30d") or 0.0),
        median_time_to_pr_seconds=int(body.get("median_time_to_pr_seconds") or 0),
        revert_rate_90d=float(body.get("revert_rate_90d") or 0.0),
        badges=body.get("badges") or [],
        status=body.get("status") or "active",
    )
    return jsonify({"status": "saved", "agent": store.market_agent_profile_get(agent_id)})


@market_bp.route("/market/agents/seed", methods=["POST"])
def seed_managed_agents():
    agents = _seed_managed_agents()
    return jsonify({"status": "seeded", "agents": agents, "specialists": store.market_specialists_list(status="active")})


@market_bp.route("/market/opportunities", methods=["GET"])
def list_opportunities():
    return jsonify(
        {
            "opportunities": store.market_opportunities_list(
                repo_full_name=request.args.get("repo"),
                status=request.args.get("status"),
                limit=request.args.get("limit", default=50, type=int),
            )
        }
    )


@market_bp.route("/market/repositories/<path:repo_full_name>/scan", methods=["POST"])
def scan_repository_opportunities(repo_full_name: str):
    account = store.market_repository_account_get_by_repo(repo_full_name)
    if not account:
        return jsonify({"error": f"repository_account missing for {repo_full_name}"}), 404
    if not account.get("local_path"):
        return jsonify({"error": "repository_account local_path required"}), 400
    agent = next((a for a in _seed_managed_agents() if a["slug"] == "ts-architect"), None)
    opportunities = discover_repo_opportunities(repo_path=account["local_path"])
    saved = []
    for item in opportunities:
        opportunity_id = _make_id("opp")
        store.market_opportunity_upsert(
            opportunity_id=opportunity_id,
            repository_account_id=account["id"],
            repo_full_name=account["repo_full_name"],
            opportunity_type=item["opportunity_type"],
            title=item["title"],
            summary=item["summary"],
            pod=item.get("pod", ""),
            lane=item.get("lane", ""),
            severity=item.get("severity", "medium"),
            confidence=float(item.get("confidence", 0.0)),
            files=item.get("files") or [],
            evidence=item.get("evidence") or {},
            source_agent_id=(agent or {}).get("id", ""),
            status="open",
        )
        saved_item = store.market_opportunity_get(opportunity_id)
        if saved_item:
            saved.append(saved_item)
    emit("agent", f"Scanned {repo_full_name} for opportunities", data={"repo": repo_full_name, "count": len(saved)})
    return jsonify({"status": "scanned", "opportunities": saved})


@market_bp.route("/market/opportunities/<opportunity_id>/promote", methods=["POST"])
def promote_opportunity(opportunity_id: str):
    opportunity = store.market_opportunity_get(opportunity_id)
    if not opportunity:
        return jsonify({"error": "opportunity not found"}), 404
    account = store.market_repository_account_get_by_repo(opportunity["repo_full_name"])
    if not account:
        return jsonify({"error": "repository_account missing for opportunity"}), 404
    existing = store.market_job_get_by_source_event_key(f"opp:{opportunity_id}")
    if existing:
        return jsonify({"status": "existing", "job": existing})
    job_payload = _opportunity_to_job(account, opportunity)
    job_id = _make_id("job")
    store.market_job_upsert(job_id=job_id, **job_payload)
    return jsonify({"status": "promoted", "job": store.market_job_get(job_id)})


@market_bp.route("/market/jobs", methods=["GET"])
def list_jobs():
    return jsonify({"jobs": store.market_jobs_list(repo_full_name=request.args.get("repo"), status=request.args.get("status"), limit=request.args.get("limit", default=50, type=int))})


@market_bp.route("/market/jobs", methods=["POST"])
def create_job():
    body = request.json or {}
    repo_full_name = (body.get("repo_full_name") or "").strip()
    job_class = (body.get("job_class") or "").strip()
    title = (body.get("title") or "").strip()
    if not repo_full_name or not job_class or not title:
        return jsonify({"error": "repo_full_name, job_class, and title required"}), 400
    account = store.market_repository_account_get_by_repo(repo_full_name)
    if not account:
        return jsonify({"error": f"repository_account missing for {repo_full_name}"}), 404
    job_id = _make_id("job")
    store.market_job_upsert(
        job_id=job_id,
        repository_account_id=account["id"],
        repo_full_name=repo_full_name,
        job_class=job_class,
        trigger_source=body.get("trigger_source") or "manual",
        title=title,
        summary=body.get("summary") or "",
        risk_level=body.get("risk_level") or "medium",
        acceptance_policy=body.get("acceptance_policy") or "maintainer_accept_or_merge",
        budget_ceiling=int(body.get("budget_ceiling") or account.get("per_job_spend_cap") or 0),
        status=body.get("status") or "open",
        candidate_agents=body.get("candidate_agents") or [],
        source_event_key=body.get("source_event_key") or "",
        metadata=body.get("metadata") or {},
        expires_at=float(body.get("expires_at") or 0) or (time.time() + 7 * 24 * 3600),
    )
    emit("agent", f"Created market job for {repo_full_name}", data={"job_id": job_id, "job_class": job_class})
    return jsonify({"status": "created", "job": store.market_job_get(job_id)}), 201


@market_bp.route("/market/jobs/<job_id>", methods=["GET"])
def get_job(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify({"job": job, "plans": store.market_job_plans_list(job_id), "assignments": store.market_job_assignments_list(job_id), "submissions": store.market_submissions_list(job_id), "payouts": store.market_payout_ledger_list(job_id), "recommendations": store.market_job_recommendations_list(job_id), "runs": store.market_execution_runs_list(job_id), "invocations": store.market_agent_invocations_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/recommendations", methods=["POST"])
def recommend_for_job(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return jsonify({"error": "repository_account missing for job"}), 404
    if request.args.get("seed", "1") != "0":
        _seed_managed_agents()
    recommendations = _recommend_agents(job, account, store.market_agent_profiles_list(status="active"))
    store.market_job_recommendations_replace(job_id, recommendations)
    return jsonify({"job_id": job_id, "routing_summary": {"repo_full_name": job["repo_full_name"], "job_class": job["job_class"], "required_trust_tier": (job.get("metadata") or {}).get("required_trust_tier", "standard"), "budget_priority": account.get("budget_priority") or []}, "eligible_agents": [r for r in recommendations if r["policy_pass"]], "blocked_agents": [r for r in recommendations if not r["policy_pass"]], "recommendations": recommendations})


@market_bp.route("/market/jobs/<job_id>/recommendations", methods=["GET"])
def list_recommendations_for_job(job_id: str):
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    return jsonify({"job_id": job_id, "recommendations": store.market_job_recommendations_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/plans", methods=["GET"])
def list_job_plans(job_id: str):
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    return jsonify({"plans": store.market_job_plans_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/plans", methods=["POST"])
def create_job_plan(job_id: str):
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    body = request.json or {}
    summary = (body.get("summary") or "").strip()
    if not summary:
        return jsonify({"error": "summary required"}), 400
    plan_id = _make_id("plan")
    store.market_job_plan_create(plan_id=plan_id, job_id=job_id, agent_id=(body.get("agent_id") or "").strip(), operator_id=(body.get("operator_id") or "").strip(), summary=summary, steps=body.get("steps") or [], estimated_cost=int(body.get("estimated_cost") or 0), estimated_seconds=int(body.get("estimated_seconds") or 0), status=body.get("status") or "proposed")
    return jsonify({"status": "created", "plan": store.market_job_plan_get(plan_id)}), 201


@market_bp.route("/market/jobs/<job_id>/assignments", methods=["GET"])
def list_job_assignments(job_id: str):
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    return jsonify({"assignments": store.market_job_assignments_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/assignments", methods=["POST"])
def create_job_assignment(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    body = request.json or {}
    recommendation_id = (body.get("recommendation_id") or "").strip()
    recommendation = store.market_job_recommendation_get(recommendation_id) if recommendation_id else None
    if recommendation_id and (not recommendation or recommendation.get("job_id") != job_id or not recommendation.get("policy_pass")):
        return jsonify({"error": "invalid recommendation_id"}), 400
    agent_id = (body.get("agent_id") or "").strip() or (recommendation or {}).get("agent_id", "")
    specialist_id = (body.get("specialist_id") or "").strip() or (recommendation or {}).get("specialist_id", "")
    if not agent_id:
        return jsonify({"error": "agent_id required"}), 400
    plan_id = (body.get("plan_id") or "").strip()
    if recommendation and recommendation.get("requires_plan") and not plan_id:
        return jsonify({"error": "plan_id required for this recommendation"}), 400
    if plan_id:
        plan = store.market_job_plan_get(plan_id)
        if not plan or plan["job_id"] != job_id:
            return jsonify({"error": "plan_id does not belong to job"}), 400
    assignment_id = _make_id("assign")
    store.market_job_assignment_create(assignment_id=assignment_id, job_id=job_id, agent_id=agent_id, specialist_id=specialist_id, recommendation_id=recommendation_id, plan_id=plan_id, assigned_by=(body.get("assigned_by") or "").strip(), mode=body.get("mode") or "exclusive", status=body.get("status") or "active", lease_expires_at=time.time() + int(body.get("lease_seconds") or 3600))
    _set_job_status(job, "assigned")
    return jsonify({"status": "created", "assignment": store.market_job_assignments_list(job_id)[0]}), 201


@market_bp.route("/market/jobs/<job_id>/runs", methods=["GET"])
def list_job_runs(job_id: str):
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    return jsonify({"runs": store.market_execution_runs_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/invocations", methods=["GET"])
def list_job_invocations(job_id: str):
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    return jsonify({"invocations": store.market_agent_invocations_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/execute", methods=["POST"])
def execute_job(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return jsonify({"error": "repository_account missing for job"}), 404
    assignment_id = ((request.json or {}).get("assignment_id") or "").strip()
    assignment = next((a for a in store.market_job_assignments_list(job_id) if a["id"] == assignment_id), None) if assignment_id else None
    if not assignment:
        return jsonify({"error": "assignment_id required"}), 400
    try:
        run, submission = _execute_assignment(job, account, assignment, mode=((request.json or {}).get("mode") or "apply"))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"status": "executed", "run": run, "submission": submission})


@market_bp.route("/market/jobs/<job_id>/autopilot", methods=["POST"])
def autopilot_job(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return jsonify({"error": "repository_account missing for job"}), 404
    if not account.get("local_path"):
        return jsonify({"error": "repository_account local_path required"}), 400
    _seed_managed_agents()
    recommendations = _recommend_agents(job, account, store.market_agent_profiles_list(status="active"))
    store.market_job_recommendations_replace(job_id, recommendations)
    recommendation = next((r for r in recommendations if r["policy_pass"]), None)
    if not recommendation:
        return jsonify({"error": "no eligible agent recommendation"}), 400
    plan_summary, plan_steps = _default_plan(job, recommendation)
    plan_id = _make_id("plan")
    store.market_job_plan_create(plan_id=plan_id, job_id=job_id, agent_id=recommendation["agent_id"], operator_id="platform-router", summary=plan_summary, steps=plan_steps, estimated_cost=0, estimated_seconds=900, status="proposed")
    assignment_id = _make_id("assign")
    store.market_job_assignment_create(assignment_id=assignment_id, job_id=job_id, agent_id=recommendation["agent_id"], specialist_id=recommendation.get("specialist_id", ""), recommendation_id=recommendation["recommendation_id"], plan_id=plan_id if recommendation.get("requires_plan") else "", assigned_by="platform-router", mode="exclusive", status="active", lease_expires_at=time.time() + 3600)
    _set_job_status(job, "assigned")
    try:
        run, submission = _execute_assignment(job, account, store.market_job_assignments_list(job_id)[0])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"status": "autopilot_complete", "recommendation": recommendation, "plan": store.market_job_plan_get(plan_id), "assignment": store.market_job_assignments_list(job_id)[0], "run": run, "submission": submission})


@market_bp.route("/market/submissions", methods=["POST"])
def create_submission():
    body = request.json or {}
    job_id = (body.get("job_id") or "").strip()
    agent_id = (body.get("agent_id") or "").strip()
    if not job_id or not agent_id:
        return jsonify({"error": "job_id and agent_id required"}), 400
    if not store.market_job_get(job_id):
        return jsonify({"error": "job not found"}), 404
    submission_id = _make_id("sub")
    store.market_submission_create(submission_id=submission_id, job_id=job_id, agent_id=agent_id, branch_name=body.get("branch_name") or "", pr_number=int(body.get("pr_number") or 0), pr_url=body.get("pr_url") or "", diff_summary=body.get("diff_summary") or "", evidence=body.get("evidence") or {}, status=body.get("status") or "submitted", acceptance_attribution=body.get("acceptance_attribution") or "")
    return jsonify({"status": "created", "submission": store.market_submission_get(submission_id)}), 201


@market_bp.route("/market/submissions/<submission_id>/decision", methods=["POST"])
def decide_submission(submission_id: str):
    submission = store.market_submission_get(submission_id)
    if not submission:
        return jsonify({"error": "submission not found"}), 404
    job = store.market_job_get(submission["job_id"])
    if not job:
        return jsonify({"error": "job not found for submission"}), 404
    body = request.json or {}
    decision = (body.get("decision") or "").strip()
    if decision not in {"accepted", "rejected"}:
        return jsonify({"error": "decision must be accepted or rejected"}), 400
    evidence = dict(submission.get("evidence") or {})
    if body.get("merged_by"):
        evidence["merged_by"] = body["merged_by"]
    if body.get("notes"):
        evidence["decision_notes"] = body["notes"]
    store.market_submission_update(submission_id, status=decision, acceptance_attribution=(body.get("acceptance_attribution") or "").strip(), evidence=evidence)
    matching = [a for a in store.market_job_assignments_list(job["id"]) if a["agent_id"] == submission["agent_id"]]
    if decision == "accepted":
        _set_job_status(job, "completed")
        for assignment in matching:
            store.market_job_assignment_update_status(assignment["id"], "completed")
        if int(body.get("payout_amount") or 0) > 0:
            store.market_payout_ledger_create(payout_id=_make_id("pay"), job_id=job["id"], submission_id=submission_id, agent_id=submission["agent_id"], operator_id=(body.get("operator_id") or "").strip(), amount=int(body.get("payout_amount") or 0), currency=(body.get("currency") or "credits").strip(), funding_source=(body.get("funding_source") or "").strip(), status="approved", notes=(body.get("notes") or "").strip())
    else:
        _set_job_status(job, "open")
        for assignment in matching:
            store.market_job_assignment_update_status(assignment["id"], "rejected")
    trace_id = (submission.get("evidence") or {}).get("langfuse_trace_id", "")
    score_contract_acceptance(
        trace_id=trace_id,
        accepted=decision == "accepted",
        comment=f"submission {decision}",
        metadata={
            "job_id": job["id"],
            "submission_id": submission_id,
            "agent_id": submission["agent_id"],
            "acceptance_attribution": (body.get("acceptance_attribution") or "").strip(),
        },
    )
    return jsonify({"status": "decided", "job": store.market_job_get(job["id"]), "submission": store.market_submission_get(submission_id), "payouts": store.market_payout_ledger_list(job["id"])})
