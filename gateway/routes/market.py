from __future__ import annotations

import time
import uuid
import os
from pathlib import Path

from flask import Blueprint, Response, current_app, jsonify, redirect, request

from gateway import store
from gateway.agent_fleet import AGENT_SERVING_PROFILES
from gateway.agent_service import execute_agent_assignment, runtime_status_for_agent
from gateway.events import emit
from gateway.langfuse_market import contract_trace, score_contract_acceptance, update_contract_trace
from gateway.market_exec import discover_repo_opportunities, execute_managed_job
from gateway.model_runtime import runtime_summary
from gateway.auth_stack import request_session_authorized
from gateway.ops_drift import run_drift_once

market_bp = Blueprint("market", __name__)


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


_TRUST_ORDER = {"standard": 1, "trusted": 2, "critical": 3}
_SUBMISSION_REVIEW_ACTIONS = {"start_review", "comment", "changes_requested", "approve"}
_SUBMISSION_REVIEW_STATUS = {
    "start_review": "under_review",
    "comment": None,
    "changes_requested": "changes_requested",
    "approve": "approved",
}

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

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_JOB_STATUS_TRANSITIONS = {
    "open": {"assigned", "awarded", "cancelled"},
    "assigned": {"open", "awarded", "completed", "cancelled"},
    "awarded": {"assigned", "open", "completed", "cancelled"},
    "completed": {"open", "awarded"},
    "cancelled": set(),
}
_MUTATING_JOB_STATUSES = {"open", "assigned", "awarded"}
_EXECUTION_MODES = {"dry_run", "apply"}
_OPS_REGIONAL_TARGET_DROPLETS = {
    "na_west": 2,
    "na_east": 2,
    "eu": 3,
    "asia": 2,
    "australia": 1,
}
_OPS_REGIONAL_LABELS = {
    "na_west": "North America (West Coast)",
    "na_east": "North America (East Coast)",
    "eu": "Europe",
    "asia": "Asia",
    "australia": "Australia",
}
_OPS_COMPONENT_CATALOG = [
    {
        "component_id": "edge_digitalocean_gateways",
        "label": "DigitalOcean Edge Gateways",
        "kind": "edge",
        "terraform_module": "digitalocean-regional-lbs",
    },
    {
        "component_id": "global_aws_accelerator",
        "label": "AWS Global Accelerator",
        "kind": "global_ingress",
        "terraform_module": "aws-global-accelerator",
    },
    {
        "component_id": "global_do_dns",
        "label": "DigitalOcean Global DNS",
        "kind": "global_ingress",
        "terraform_module": "digitalocean-global-dns",
    },
    {
        "component_id": "global_do_primary_backup_lb",
        "label": "DigitalOcean Primary + Backup Global LB",
        "kind": "global_ingress",
        "terraform_module": "digitalocean-global-lb",
    },
    {
        "component_id": "bedrock_supervisor_mistral",
        "label": "Supervisor API (Qwen3.6-Flash)",
        "kind": "qwen_supervisor",
    },
    {
        "component_id": "bedrock_worker_glm",
        "label": "Universal Worker Pool (Qwen3.6-35B-A3B)",
        "kind": "qwen_worker",
    },
    {
        "component_id": "bedrock_worker_minimax",
        "label": "Worker Thinking Lane (Qwen3.6-35B-A3B)",
        "kind": "qwen_worker",
    },
    {
        "component_id": "trainium_tuning_loop",
        "label": "Trainium Tuning Loop (Axolotl qLoRA)",
        "kind": "training",
    },
]


def _infra_root() -> Path:
    override = (os.getenv("MARKET_INFRA_ROOT") or "").strip()
    if override:
        return Path(override).expanduser()
    return Path(__file__).resolve().parents[2] / "infra" / "marketplace-fleet"


def _ops_links() -> dict:
    return {
        "langfuse_app_url": (os.getenv("LANGFUSE_PUBLIC_URL") or "http://localhost:3001").strip(),
        "langfuse_docs_url": "https://langfuse.com/docs",
    }


def _ops_authorized() -> bool:
    expected_token = (os.getenv("MARKET_API_TOKEN") or "").strip()
    auth = (request.headers.get("Authorization") or "").strip()
    supplied = ""
    if auth.lower().startswith("bearer "):
        supplied = auth.split(" ", 1)[1].strip()
    supplied = supplied or (request.headers.get("X-Market-Token") or "").strip()
    if expected_token and supplied == expected_token:
        return True
    return request_session_authorized(role="admin", min_aal=2)


def _ops_default_regional_weights() -> dict[str, int]:
    return {
        "na_west": 20,
        "na_east": 20,
        "eu": 30,
        "asia": 20,
        "australia": 10,
    }


def _ops_resolve_regional_weights(body: dict) -> dict[str, int]:
    raw = body.get("regional_weights")
    if isinstance(raw, dict):
        resolved = {}
        for region in _OPS_REGIONAL_TARGET_DROPLETS:
            resolved[region] = int(raw.get(region) or 0)
        return resolved
    if "us_percent" in body or "eu_percent" in body:
        return {
            "na_west": int(body.get("us_percent") or 0),
            "na_east": 0,
            "eu": int(body.get("eu_percent") or 0),
            "asia": 0,
            "australia": 0,
        }
    return _ops_default_regional_weights()


def _ops_infra_drift_snapshot(infra_root: Path) -> dict:
    terraform_root = infra_root / "terraform"
    modules = {
        "aws_global_accelerator": terraform_root / "aws-global-accelerator",
        "digitalocean_edge": terraform_root / "digitalocean-regional-lbs",
        "digitalocean_global_lb": terraform_root / "digitalocean-global-lb",
        "digitalocean_global_dns": terraform_root / "digitalocean-global-dns",
    }
    module_state = {
        key: {
            "path": str(path),
            "present": path.is_dir(),
            "terraform_lock_present": (path / ".terraform.lock.hcl").is_file(),
            "tfvars_present": (path / "terraform.tfvars").is_file(),
        }
        for key, path in modules.items()
    }
    return {
        "status": "ok",
        "module_state": module_state,
        "recent_runs": store.market_ops_drift_runs_list(limit=10),
        "active_alerts": store.market_ops_alerts_list(limit=20, include_acknowledged=False),
        "recommended_commands": [
            "terraform -chdir=infra/marketplace-fleet/terraform/digitalocean-regional-lbs plan",
            "terraform -chdir=infra/marketplace-fleet/terraform/digitalocean-global-lb plan",
            "terraform -chdir=infra/marketplace-fleet/terraform/aws-global-accelerator plan",
            "terraform -chdir=infra/marketplace-fleet/terraform/digitalocean-global-dns plan",
        ],
    }


def _ops_component_desired_state(action: str) -> str:
    if action in {"stop", "disable", "scale_down"}:
        return "stopped"
    if action in {"start", "enable", "scale_up", "restart"}:
        return "running"
    return "unknown"


def _ops_component_snapshot() -> dict:
    persisted = {item["component_id"]: item for item in store.market_ops_component_states_list()}
    components = []
    for component in _OPS_COMPONENT_CATALOG:
        row = persisted.get(component["component_id"])
        components.append(
            {
                **component,
                "desired_state": (row or {}).get("desired_state", "running"),
                "last_action": (row or {}).get("last_action", ""),
                "updated_by": (row or {}).get("updated_by", ""),
                "notes": (row or {}).get("notes", ""),
                "updated_at": (row or {}).get("updated_at", 0),
            }
        )
    return {
        "components": components,
        "recent_actions": store.market_ops_component_actions_list(limit=10),
    }


def _rollback_action_for(action: str) -> str:
    lookup = {
        "start": "stop",
        "enable": "disable",
        "stop": "start",
        "disable": "enable",
        "scale_up": "scale_down",
        "scale_down": "scale_up",
        "restart": "restart",
    }
    return lookup.get(action, "restart")


def _error(message: str, status_code: int = 400, code: str = "invalid_request"):
    return jsonify({"error": message, "error_code": code}), status_code


def _require_market_auth():
    if request.method in _SAFE_METHODS:
        return None
    expected_token = (os.getenv("MARKET_API_TOKEN") or "").strip()
    if not expected_token:
        return None
    auth = (request.headers.get("Authorization") or "").strip()
    supplied = ""
    if auth.lower().startswith("bearer "):
        supplied = auth.split(" ", 1)[1].strip()
    supplied = supplied or (request.headers.get("X-Market-Token") or "").strip()
    if supplied != expected_token:
        if request.path.startswith("/ops/") and request_session_authorized(role="admin", min_aal=2):
            return None
        return _error("unauthorized market write", status_code=401, code="unauthorized")
    return None


@market_bp.before_request
def _market_before_request():
    auth_error = _require_market_auth()
    if auth_error:
        return auth_error
    return None


def _check_repo_owner_access(account: dict) -> tuple[bool, str]:
    expected_owner = (account.get("owner_account_id") or "").strip()
    if not expected_owner:
        return True, ""
    body = request.get_json(silent=True) or {}
    requester_owner = (
        (request.headers.get("X-Market-Owner") or "").strip()
        or (body.get("owner") or "").strip()
    )
    if requester_owner and requester_owner != expected_owner:
        return False, f"requester owner '{requester_owner}' does not match repository owner"
    return True, ""


def _agent_pool_tags(agent: dict) -> set[str]:
    tags = set()
    pod = (agent.get("pod") or "").strip()
    if pod:
        tags.add(f"managed-{pod}")
    if agent.get("agent_kind") == "generic":
        tags.add("managed-generic")
    elif agent.get("agent_kind") == "specialist":
        tags.add(f"managed-{pod}" if pod else "managed-specialist")
    if agent.get("operator_id") and agent.get("operator_id") != "platform-managed":
        tags.add("operator-owned")
    return tags


def _agent_policy_violations(job: dict, account: dict, agent: dict) -> list[str]:
    metadata = job.get("metadata") or {}
    desired_pod = (metadata.get("pod") or metadata.get("language") or "").strip()
    desired_lane = (metadata.get("lane") or "").strip()
    required_trust = (metadata.get("required_trust_tier") or "standard").strip()
    violations: list[str] = []

    if job["job_class"] not in (agent.get("supported_job_classes") or []):
        violations.append("job class unsupported by agent")
    if desired_pod and not (
        agent.get("pod") == desired_pod or desired_pod in (agent.get("supported_ecosystems") or [])
    ):
        violations.append("agent does not support requested pod/ecosystem")
    if desired_lane and agent.get("lane") not in {desired_lane, ""} and agent.get("agent_kind") != "generic":
        violations.append("agent lane does not match requested lane")
    if _trust_value(agent.get("trust_tier", "")) < _trust_value(required_trust):
        violations.append("agent trust tier below required level")

    allowed_pools = account.get("allowed_agent_pools") or []
    if allowed_pools:
        agent_pools = _agent_pool_tags(agent)
        if not (set(allowed_pools) & agent_pools):
            violations.append("agent is outside allowed agent pools")
    return violations


def _is_agent_or_operator_suspended(agent: dict) -> tuple[bool, str]:
    if (agent.get("status") or "").strip().lower() in {"suspended", "disabled"}:
        return True, "agent is suspended"
    operator_id = (agent.get("operator_id") or "").strip()
    if operator_id and operator_id != "platform-managed":
        operator = store.market_operator_get(operator_id)
        if operator and (operator.get("status") or "").strip().lower() in {"suspended", "disabled"}:
            return True, "operator is suspended"
    return False, ""


def _record_reputation_from_submission(submission: dict, decision: str) -> None:
    agent_id = (submission.get("agent_id") or "").strip()
    if not agent_id:
        return
    agent = store.market_agent_profile_get(agent_id) or {}
    operator_id = (agent.get("operator_id") or "").strip()
    if decision == "accepted":
        store.market_reputation_record("agent", agent_id, wins_delta=1, jobs_delta=1)
        if operator_id:
            store.market_reputation_record("operator", operator_id, wins_delta=1, jobs_delta=1)
        return
    store.market_reputation_record("agent", agent_id, rejects_delta=1, jobs_delta=1)
    if operator_id:
        store.market_reputation_record("operator", operator_id, rejects_delta=1, jobs_delta=1)


def _record_reputation_dispute(dispute: dict, ruling: str) -> None:
    settlement = store.market_settlement_get((dispute.get("settlement_id") or "").strip()) or {}
    agent_id = (settlement.get("agent_id") or "").strip()
    operator_id = (settlement.get("operator_id") or "").strip()
    disputes_won_delta = 1 if ruling in {"uphold_agent", "agent_wins"} else 0
    if agent_id:
        store.market_reputation_record(
            "agent",
            agent_id,
            disputes_delta=1,
            disputes_won_delta=disputes_won_delta,
        )
    if operator_id:
        store.market_reputation_record(
            "operator",
            operator_id,
            disputes_delta=1,
            disputes_won_delta=disputes_won_delta,
        )


def _record_reputation_refund(settlement: dict) -> None:
    agent_id = (settlement.get("agent_id") or "").strip()
    operator_id = (settlement.get("operator_id") or "").strip()
    if agent_id:
        store.market_reputation_record("agent", agent_id, refunds_delta=1)
    if operator_id:
        store.market_reputation_record("operator", operator_id, refunds_delta=1)


def _validate_mode(raw_mode: str) -> str | None:
    mode = (raw_mode or "").strip() or "dry_run"
    if mode not in _EXECUTION_MODES:
        return None
    return mode


def _is_terminal_submission(submission: dict) -> bool:
    return submission.get("status") in {"accepted", "rejected"}


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


def _set_job_status(job: dict, status: str) -> bool:
    current = store.market_job_get(job["id"]) or job
    current_status = (current.get("status") or "open").strip()
    target_status = (status or "").strip()
    if not target_status:
        return False
    if target_status == current_status:
        return True
    allowed = _JOB_STATUS_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        return False
    store.market_job_upsert(
        job_id=current["id"],
        repository_account_id=current["repository_account_id"],
        repo_full_name=current["repo_full_name"],
        job_class=current["job_class"],
        trigger_source=current["trigger_source"],
        title=current["title"],
        summary=current["summary"],
        risk_level=current["risk_level"],
        acceptance_policy=current["acceptance_policy"],
        budget_ceiling=current["budget_ceiling"],
        status=target_status,
        candidate_agents=current["candidate_agents"],
        source_event_key=current["source_event_key"],
        metadata=current["metadata"],
        expires_at=current["expires_at"],
    )
    return True


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


def _operator_payload(operator: dict) -> dict:
    payload = dict(operator)
    payload["summary_metrics"] = store.market_operator_summary(operator["id"])
    payload["agents"] = [agent for agent in store.market_agent_profiles_list(status="active") if agent.get("operator_id") == operator["id"]]
    return payload


def _execute_assignment(
    job: dict,
    account: dict,
    assignment: dict,
    mode: str = "dry_run",
    idempotency_key: str = "",
) -> tuple[dict, dict | None]:
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
        if idempotency_key:
            base_evidence["idempotency_key"] = idempotency_key
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
    web_marketplace_url = (os.getenv("WEB_MARKETPLACE_URL") or "http://127.0.0.1:5173/marketplace").strip()
    return redirect(web_marketplace_url, code=302)


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
            enabled_job_classes=body.get("enabled_job_classes") or ["ci_repair", "dependency_update", "security_update", "test_repair", "config_remediation", "type_repair", "codemod"],
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


@market_bp.route("/market/operators", methods=["GET"])
def list_operators():
    operators = [_operator_payload(item) for item in store.market_operators_list(status=request.args.get("status"))]
    return jsonify({"operators": operators})


@market_bp.route("/market/operators", methods=["POST"])
def create_or_update_operator():
    body = request.json or {}
    slug = (body.get("slug") or "").strip()
    display_name = (body.get("display_name") or "").strip()
    if not slug or not display_name:
        return jsonify({"error": "slug and display_name required"}), 400
    existing = store.market_operator_get_by_slug(slug)
    operator_id = (body.get("id") or "").strip() or ((existing or {}).get("id") or _make_id("op"))
    store.market_operator_upsert(
        operator_id=operator_id,
        slug=slug,
        display_name=display_name,
        summary=body.get("summary") or "",
        status=body.get("status") or "pending",
        onboarding_status=body.get("onboarding_status") or "draft",
        identity_anchor=body.get("identity_anchor") or "",
        wallet=body.get("wallet") or "",
        ens_name=body.get("ens_name") or "",
        verification_status=body.get("verification_status") or "unverified",
        contact_email=body.get("contact_email") or "",
        website_url=body.get("website_url") or "",
        metadata=body.get("metadata") or {},
    )
    operator = store.market_operator_get(operator_id)
    return jsonify({"status": "saved", "operator": _operator_payload(operator) if operator else {"id": operator_id}})


@market_bp.route("/market/operators/<operator_id>", methods=["GET"])
def get_operator(operator_id: str):
    operator = store.market_operator_get(operator_id)
    if not operator:
        return jsonify({"error": "operator not found"}), 404
    return jsonify({"operator": _operator_payload(operator)})


@market_bp.route("/market/operators/<operator_id>/onboard", methods=["POST"])
def onboard_operator(operator_id: str):
    operator = store.market_operator_get(operator_id)
    if not operator:
        return jsonify({"error": "operator not found"}), 404
    body = request.json or {}
    store.market_operator_upsert(
        operator_id=operator["id"],
        slug=operator["slug"],
        display_name=operator["display_name"],
        summary=body.get("summary") if body.get("summary") is not None else operator.get("summary", ""),
        status=body.get("status") or "active",
        onboarding_status=body.get("onboarding_status") or "completed",
        identity_anchor=body.get("identity_anchor") or operator.get("identity_anchor", ""),
        wallet=body.get("wallet") or operator.get("wallet", ""),
        ens_name=body.get("ens_name") or operator.get("ens_name", ""),
        verification_status=body.get("verification_status") or "verified",
        contact_email=body.get("contact_email") or operator.get("contact_email", ""),
        website_url=body.get("website_url") or operator.get("website_url", ""),
        metadata={**(operator.get("metadata") or {}), **(body.get("metadata") or {})},
    )
    updated = store.market_operator_get(operator_id)
    return jsonify({"status": "onboarded", "operator": _operator_payload(updated) if updated else {"id": operator_id}})


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


@market_bp.route("/ops/serving/topology", methods=["GET"])
def ops_serving_topology():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    infra_root = _infra_root()
    traffic_state = store.market_ops_traffic_state_get()
    latest_rollout = store.market_ops_model_rollout_latest()
    return jsonify(
        {
            "status": "ok",
            "infra_root": str(infra_root),
            "edge_layer": {
                "provider": "digitalocean",
                "droplet_target_by_region": _OPS_REGIONAL_TARGET_DROPLETS,
                "total_droplets": sum(_OPS_REGIONAL_TARGET_DROPLETS.values()),
                "gateway_runtime": "litellm_or_custom_openrouter_style_gateway",
                "redis_prefix_cache": True,
                "identity_injection": True,
                "forwarded_identity_header": "X-Agent-ID",
                "identity_header_examples": {
                    "rust_security": "Rust: Security Patch",
                    "vendor_swap_rust": "Rust: Vendor Swap",
                    "recovery_rust": "Rust: Get Back On Track",
                },
                "project_state_cache_strategy": {
                    "mode": "kv_cache_reuse_plus_incremental_files",
                    "cache_window_seconds": 300,
                    "context_goal_tokens": 256000,
                },
                "circuit_breakers": {
                    "primary": "aws_inference_core",
                    "fallbacks": ["anthropic", "openai", "gemini"],
                    "trip_on": {"latency_ms": 60000, "status_codes": [503]},
                },
            },
            "supervisor_layer": {
                "provider": "qwen_api",
                "model": "qwen3.6-flash",
                "context_window_tokens": 256000,
                "role": "triage_and_context_pruning",
                "enable_thinking": True,
            },
            "worker_layer": {
                "provider": "self_hosted_qwen",
                "model": "qwen3.6-35b-a3b",
                "execution_core": {
                    "inference_server": "vllm_neuron_sdk",
                    "primary_hardware": "aws_inferentia2_inf2_xlarge",
                    "cpu_worker_lane": "llama_cpp_on_aws_graviton_c8g",
                    "adapter_runtime": "hot_swap_lora_by_agent_id",
                },
                "identities": {
                    "security_patch_ts": "qwen3.6-35b-a3b-axolotl-tuned",
                    "security_patch_rust": "qwen3.6-35b-a3b-axolotl-tuned",
                    "vendor_swap_ts": "qwen3.6-35b-a3b-axolotl-tuned",
                    "vendor_swap_rust": "qwen3.6-35b-a3b-axolotl-tuned",
                    "get_back_on_track_ts": "qwen3.6-35b-a3b-axolotl-tuned",
                    "get_back_on_track_rust": "qwen3.6-35b-a3b-axolotl-tuned",
                },
                "preserve_thinking": True,
            },
            "tuning_loop": {
                "hardware": "aws_trainium_trn1_32xlarge",
                "engine": "axolotl_qlora",
                "artifact_source": "s3_successful_marketplace_outcomes",
                "trace_source": "langfuse_preserved_thinking_and_successful_prs",
                "cadence": "weekly",
                "dual_tune_strategy": {
                    "golden_base": "qwen3.6-35b-a3b-agentic-golden-base",
                    "base_tune_cadence": "infrequent",
                    "identity_adapter_cadence": "frequent",
                    "identity_count": 6,
                    "identity_focus": "borrow_checker_vendor_swap_recovery_security",
                },
                "long_context_training": {
                    "liger_rope": True,
                    "fsdp": True,
                    "max_context_tokens": 256000,
                },
            },
            "regions": [
                {
                    "id": region,
                    "label": _OPS_REGIONAL_LABELS[region],
                    "provider": "digitalocean",
                    "droplet_target": count,
                }
                for region, count in _OPS_REGIONAL_TARGET_DROPLETS.items()
            ],
            "global_ingress": {
                "aws_global_accelerator_module": (infra_root / "terraform" / "aws-global-accelerator").is_dir(),
                "do_regional_lb_module": (infra_root / "terraform" / "digitalocean-regional-lbs").is_dir(),
                "do_primary_backup_global_lb_module": (infra_root / "terraform" / "digitalocean-global-lb").is_dir(),
                "do_global_dns_module": (infra_root / "terraform" / "digitalocean-global-dns").is_dir(),
            },
            "traffic": traffic_state,
            "last_rollout": latest_rollout,
            "components": _ops_component_snapshot(),
            "infra_drift": _ops_infra_drift_snapshot(infra_root),
        }
    )


@market_bp.route("/ops/serving/traffic-shift", methods=["POST"])
def ops_serving_traffic_shift():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    body = request.json or {}
    regional_weights = _ops_resolve_regional_weights(body)
    if any(weight < 0 for weight in regional_weights.values()):
        return _error("regional traffic percentages must be non-negative", 400, "invalid_traffic_shift")
    if sum(regional_weights.values()) != 100:
        return _error("regional traffic percentages must sum to 100", 400, "invalid_traffic_shift")
    changed_by = (body.get("changed_by") or "operator_panel").strip()
    notes = (body.get("notes") or "").strip()
    store.market_ops_traffic_state_set(
        us_percent=int(regional_weights["na_west"]) + int(regional_weights["na_east"]),
        eu_percent=int(regional_weights["eu"]),
        changed_by=changed_by,
        notes=notes,
        regional_weights=regional_weights,
    )
    applied = store.market_ops_traffic_state_get()
    return jsonify(
        {
            "status": "applied",
            "traffic": applied,
            "note": "Traffic state persisted. Wire Terraform apply pipeline to enact globally.",
        }
    )


@market_bp.route("/ops/serving/model-rollout", methods=["POST"])
def ops_model_rollout():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    body = request.json or {}
    target = (body.get("target") or "").strip()
    revision = (body.get("revision") or "").strip()
    if target not in {
        "base",
        "specialist",
        "supervisor",
        "worker_security",
        "worker_vendor_swap",
        "worker_recovery",
        "edge_gateway",
        "tuning_loop",
    }:
        return _error("invalid rollout target", 400, "invalid_rollout_target")
    if not revision:
        return _error("revision required", 400, "missing_revision")
    strategy = (body.get("strategy") or "canary").strip() or "canary"
    requested_by = (body.get("requested_by") or "operator_panel").strip()
    metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
    rollout_id = _make_id("rollout")
    store.market_ops_model_rollout_create(
        rollout_id=rollout_id,
        target=target,
        revision=revision,
        strategy=strategy,
        requested_by=requested_by,
        status="queued",
        metadata=metadata,
    )
    rollout = store.market_ops_model_rollout_latest()
    return jsonify(
        {
            "status": "queued",
            "rollout": rollout,
            "note": "Connect this endpoint to deployment automation for live rollout execution.",
        }
    )


@market_bp.route("/ops/observability/langfuse", methods=["GET"])
def ops_langfuse():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    links = _ops_links()
    latest_rollout = store.market_ops_model_rollout_latest()
    recent_rollouts = store.market_ops_model_rollouts_list(limit=5)
    return jsonify(
        {
            "status": "ok",
            "links": links,
            "hints": [
                "Use trace ids to join marketplace execution runs and payouts.",
                "Track model/adapter revisions in trace metadata for postmortems.",
                "Track circuit-break events by region to tune edge fallback policies.",
            ],
            "last_rollout": latest_rollout,
            "recent_rollouts": recent_rollouts,
        }
    )


@market_bp.route("/ops/observability/runbook", methods=["GET"])
def ops_observability_runbook():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    return jsonify(
        {
            "status": "ok",
            "slo_targets": {
                "ops_action_queue_approval_minutes_p95": 15,
                "ops_action_execution_minutes_p95": 20,
                "drift_detection_interval_minutes": max(1, int(os.getenv("MARKET_OPS_DRIFT_INTERVAL_SEC", "1800")) // 60),
            },
            "dashboards": _ops_links(),
            "runbooks": [
                {
                    "id": "ops-action-failure",
                    "summary": "If component action fails, inspect action.command_trace/error_trace, then trigger rollback endpoint.",
                },
                {
                    "id": "infra-drift-alert",
                    "summary": "When drift alert fires, review persisted terraform diff, open approval-gated action, then apply.",
                },
            ],
            "recent_component_actions": store.market_ops_component_actions_list(limit=10),
            "recent_drift_runs": store.market_ops_drift_runs_list(limit=10),
            "active_alerts": store.market_ops_alerts_list(limit=20),
        }
    )


@market_bp.route("/ops/infra/drift", methods=["GET"])
def ops_infra_drift():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    infra_root = _infra_root()
    snapshot = _ops_infra_drift_snapshot(infra_root)
    return jsonify(snapshot)


@market_bp.route("/ops/infra/drift/run", methods=["POST"])
def ops_infra_drift_run():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    body = request.json or {}
    trigger = (body.get("trigger") or "manual").strip() or "manual"
    runs = run_drift_once(trigger=trigger)
    return jsonify({"status": "completed", "runs": runs, "active_alerts": store.market_ops_alerts_list(limit=20)})


@market_bp.route("/ops/components", methods=["GET"])
def ops_components():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    return jsonify({"status": "ok", **_ops_component_snapshot()})


@market_bp.route("/ops/components/action", methods=["POST"])
def ops_components_action():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    body = request.json or {}
    component_id = (body.get("component_id") or "").strip()
    action = (body.get("action") or "").strip().lower()
    execution_mode = (body.get("execution_mode") or "dry_run").strip().lower() or "dry_run"
    requested_by = (body.get("requested_by") or "operator_panel").strip()
    notes = (body.get("notes") or "").strip()
    requires_approval = bool(body.get("requires_approval", True))
    if component_id not in {item["component_id"] for item in _OPS_COMPONENT_CATALOG}:
        return _error("unknown component_id", 400, "invalid_component")
    if action not in {"start", "stop", "restart", "scale_up", "scale_down", "enable", "disable"}:
        return _error("invalid action", 400, "invalid_action")
    if execution_mode not in {"dry_run", "apply"}:
        return _error("execution_mode must be dry_run or apply", 400, "invalid_execution_mode")
    action_id = _make_id("component_action")
    desired_state = _ops_component_desired_state(action)
    initial_status = "pending_approval" if requires_approval else "approved"
    approved_by = ""
    approved_at = 0.0
    if not requires_approval:
        approved_by = requested_by
        approved_at = time.time()
    store.market_ops_component_action_create(
        action_id=action_id,
        component_id=component_id,
        action=action,
        requested_by=requested_by,
        status=initial_status,
        execution_mode=execution_mode,
        notes=notes,
        metadata={"automation": "queued"},
        approved_by=approved_by,
        approved_at=approved_at,
    )
    store.market_ops_component_state_set(
        component_id=component_id,
        desired_state=desired_state,
        last_action=action,
        updated_by=requested_by,
        notes=notes,
        metadata={"last_action_id": action_id},
    )
    return jsonify(
        {
            "status": initial_status,
            "action_id": action_id,
            "component_state": store.market_ops_component_state_get(component_id),
            "action": store.market_ops_component_action_get(action_id),
        }
    )


@market_bp.route("/ops/components/action/<action_id>/approve", methods=["POST"])
def ops_components_action_approve(action_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    body = request.json or {}
    actor = (body.get("approved_by") or "operator_panel").strip()
    row = store.market_ops_component_action_get(action_id)
    if not row:
        return _error("action not found", 404, "action_not_found")
    if row["status"] not in {"pending_approval", "approved"}:
        return _error("action cannot be approved in current status", 409, "invalid_action_state")
    updated = store.market_ops_component_action_update(
        action_id,
        status="approved",
        approved_by=actor,
        approved_at=time.time(),
    )
    return jsonify({"status": "approved", "action": updated})


@market_bp.route("/ops/components/action/<action_id>/rollback", methods=["POST"])
def ops_components_action_rollback(action_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    prior = store.market_ops_component_action_get(action_id)
    if not prior:
        return _error("action not found", 404, "action_not_found")
    if prior["status"] != "succeeded":
        return _error("rollback requires a succeeded action", 409, "invalid_action_state")
    body = request.json or {}
    requested_by = (body.get("requested_by") or "operator_panel").strip()
    rollback_action = _rollback_action_for(prior["action"])
    rollback_id = _make_id("component_action")
    store.market_ops_component_action_create(
        action_id=rollback_id,
        component_id=prior["component_id"],
        action=rollback_action,
        requested_by=requested_by,
        status="approved",
        execution_mode="apply",
        notes=f"Rollback for {action_id}",
        metadata={"rollback_reason": body.get("reason") or "", "source_action_id": action_id},
        approved_by=requested_by,
        approved_at=time.time(),
        rollback_of_action_id=action_id,
    )
    store.market_ops_component_state_set(
        component_id=prior["component_id"],
        desired_state=_ops_component_desired_state(rollback_action),
        last_action=rollback_action,
        updated_by=requested_by,
        notes=f"Rollback queued for {action_id}",
        metadata={"last_action_id": rollback_id, "rollback_of_action_id": action_id},
    )
    return jsonify({"status": "rollback_queued", "action": store.market_ops_component_action_get(rollback_id)})


@market_bp.route("/market/agents", methods=["POST"])
def create_or_update_agent():
    body = request.json or {}
    slug = (body.get("slug") or "").strip()
    display_name = (body.get("display_name") or "").strip()
    if not slug or not display_name:
        return jsonify({"error": "slug and display_name required"}), 400
    operator_id = (body.get("operator_id") or "").strip()
    # Operators can be fully onboarded through /market/operators, but legacy
    # solver flows also submit stable external operator identifiers.
    existing = next((a for a in store.market_agent_profiles_list() if a["slug"] == slug), None)
    agent_id = (body.get("id") or "").strip() or (existing["id"] if existing else _make_id("agent"))
    store.market_agent_profile_upsert(
        agent_id=agent_id,
        slug=slug,
        display_name=display_name,
        operator_id=operator_id,
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


@market_bp.route("/market/agents/<agent_id>/manifest", methods=["GET"])
def get_agent_manifest(agent_id: str):
    if not store.market_agent_profile_get(agent_id):
        return jsonify({"error": "agent not found"}), 404
    manifest = store.market_capability_manifest_get_by_agent(agent_id)
    if not manifest:
        return jsonify({"error": "manifest not found"}), 404
    return jsonify({"manifest": manifest})


@market_bp.route("/market/agents/<agent_id>/manifest", methods=["POST"])
def create_or_update_agent_manifest(agent_id: str):
    agent = store.market_agent_profile_get(agent_id)
    if not agent:
        return jsonify({"error": "agent not found"}), 404
    body = request.json or {}
    manifest_id = ((store.market_capability_manifest_get_by_agent(agent_id) or {}).get("id") or _make_id("manifest"))
    store.market_capability_manifest_upsert(
        manifest_id=manifest_id,
        agent_id=agent_id,
        operator_id=body.get("operator_id") or agent.get("operator_id", ""),
        manifest_version=int(body.get("manifest_version") or 1),
        job_classes=body.get("job_classes") or [],
        languages=body.get("languages") or [],
        package_managers=body.get("package_managers") or [],
        frameworks=body.get("frameworks") or [],
        ci_providers=body.get("ci_providers") or [],
        max_change_scope=body.get("max_change_scope") or "medium",
        allowed_file_classes=body.get("allowed_file_classes") or [],
        requires_human_review=bool(body.get("requires_human_review", True)),
        can_open_prs=bool(body.get("can_open_prs", False)),
        preferred_budget_types=body.get("preferred_budget_types") or [],
        signed_at=body.get("signed_at") or "",
        metadata=body.get("metadata") or {},
    )
    return jsonify({"status": "saved", "manifest": store.market_capability_manifest_get_by_agent(agent_id)})


@market_bp.route("/market/agents/seed", methods=["POST"])
def seed_managed_agents():
    agents = _seed_managed_agents()
    return jsonify({"status": "seeded", "agents": agents, "specialists": store.market_specialists_list(status="active")})


@market_bp.route("/market/opportunities", methods=["GET"])
def list_opportunities():
    limit = request.args.get("limit", default=50, type=int)
    offset = request.args.get("offset", default=0, type=int)
    return jsonify(
        {
            "opportunities": store.market_opportunities_list(
                repo_full_name=request.args.get("repo"),
                status=request.args.get("status"),
                limit=limit,
                offset=offset,
            )
        }
    )


@market_bp.route("/market/repositories/<path:repo_full_name>/scan", methods=["POST"])
def scan_repository_opportunities(repo_full_name: str):
    account = store.market_repository_account_get_by_repo(repo_full_name)
    if not account:
        return _error(f"repository_account missing for {repo_full_name}", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    if not account.get("local_path"):
        return _error("repository_account local_path required", 400, "repository_path_required")
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
        return _error("opportunity not found", 404, "opportunity_not_found")
    account = store.market_repository_account_get_by_repo(opportunity["repo_full_name"])
    if not account:
        return _error("repository_account missing for opportunity", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    existing = store.market_job_get_by_source_event_key(f"opp:{opportunity_id}")
    if existing:
        return jsonify({"status": "existing", "job": existing})
    job_payload = _opportunity_to_job(account, opportunity)
    job_id = _make_id("job")
    store.market_job_upsert(job_id=job_id, **job_payload)
    store.market_opportunity_upsert(
        opportunity_id=opportunity["id"],
        repository_account_id=opportunity["repository_account_id"],
        repo_full_name=opportunity["repo_full_name"],
        opportunity_type=opportunity["opportunity_type"],
        title=opportunity["title"],
        summary=opportunity["summary"],
        pod=opportunity.get("pod", ""),
        lane=opportunity.get("lane", ""),
        severity=opportunity.get("severity", "medium"),
        confidence=float(opportunity.get("confidence", 0.0)),
        files=opportunity.get("files") or [],
        evidence=opportunity.get("evidence") or {},
        source_agent_id=opportunity.get("source_agent_id", ""),
        status="promoted",
    )
    return jsonify({"status": "promoted", "job": store.market_job_get(job_id)})


@market_bp.route("/market/jobs", methods=["GET"])
def list_jobs():
    return jsonify(
        {
            "jobs": store.market_jobs_list(
                repo_full_name=request.args.get("repo"),
                status=request.args.get("status"),
                limit=request.args.get("limit", default=50, type=int),
                offset=request.args.get("offset", default=0, type=int),
            )
        }
    )


@market_bp.route("/market/jobs", methods=["POST"])
def create_job():
    body = request.json or {}
    repo_full_name = (body.get("repo_full_name") or "").strip()
    job_class = (body.get("job_class") or "").strip()
    title = (body.get("title") or "").strip()
    if not repo_full_name or not job_class or not title:
        return _error("repo_full_name, job_class, and title required", 400, "missing_required_fields")
    account = store.market_repository_account_get_by_repo(repo_full_name)
    if not account:
        return _error(f"repository_account missing for {repo_full_name}", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")

    enabled_job_classes = set(account.get("enabled_job_classes") or [])
    if enabled_job_classes and job_class not in enabled_job_classes:
        return _error("job_class is not enabled for this repository", 400, "job_class_not_enabled")

    risk_level = (body.get("risk_level") or "low").strip()
    if risk_level not in {"low", "medium", "high"}:
        return _error("risk_level must be low, medium, or high", 400, "invalid_risk_level")

    source_event_key = (body.get("source_event_key") or "").strip()
    if source_event_key:
        existing = store.market_job_get_by_source_event_key(source_event_key)
        if existing:
            return jsonify({"status": "existing", "job": existing})

    budget_ceiling = int(body.get("budget_ceiling") or account.get("per_job_spend_cap") or 0)
    if budget_ceiling < 0:
        return _error("budget_ceiling must be non-negative", 400, "invalid_budget")
    per_job_cap = int(account.get("per_job_spend_cap") or 0)
    if per_job_cap > 0 and budget_ceiling > per_job_cap:
        return _error("budget_ceiling exceeds repository per_job_spend_cap", 400, "budget_exceeds_cap")

    metadata = body.get("metadata") or {}
    required_trust = (metadata.get("required_trust_tier") or "").strip()
    if not required_trust:
        metadata = dict(metadata)
        metadata["required_trust_tier"] = "critical" if risk_level == "high" else ("trusted" if risk_level == "medium" else "standard")

    status = (body.get("status") or "open").strip()
    if status not in _MUTATING_JOB_STATUSES:
        return _error("job status must start as open or assigned", 400, "invalid_initial_job_status")

    job_id = _make_id("job")
    store.market_job_upsert(
        job_id=job_id,
        repository_account_id=account["id"],
        repo_full_name=repo_full_name,
        job_class=job_class,
        trigger_source=body.get("trigger_source") or "manual",
        title=title,
        summary=body.get("summary") or "",
        risk_level=risk_level,
        acceptance_policy=body.get("acceptance_policy") or "maintainer_accept_or_merge",
        budget_ceiling=budget_ceiling,
        status=status,
        candidate_agents=body.get("candidate_agents") or [],
        source_event_key=source_event_key,
        metadata=metadata,
        expires_at=float(body.get("expires_at") or 0) or (time.time() + 7 * 24 * 3600),
    )
    emit("agent", f"Created market job for {repo_full_name}", data={"job_id": job_id, "job_class": job_class})
    return jsonify({"status": "created", "job": store.market_job_get(job_id)}), 201


@market_bp.route("/market/jobs/<job_id>", methods=["GET"])
def get_job(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify({
        "job": job,
        "plans": store.market_job_plans_list(job_id),
        "assignments": store.market_job_assignments_list(job_id),
        "submissions": store.market_submissions_list(job_id),
        "submission_reviews": store.market_submission_reviews_list_by_job(job_id),
        "payouts": store.market_payout_ledger_list(job_id),
        "offers": store.market_offers_list(job_id),
        "award": store.market_award_get_by_job(job_id),
        "settlements": store.market_settlements_list(job_id),
        "disputes": store.market_disputes_list(job_id),
        "recommendations": store.market_job_recommendations_list(job_id),
        "runs": store.market_execution_runs_list(job_id),
        "invocations": store.market_agent_invocations_list(job_id),
    })


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
        return _error("job not found", 404, "job_not_found")
    if job.get("status") not in _MUTATING_JOB_STATUSES:
        return _error("job is not assignable in its current status", 409, "invalid_job_state")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    body = request.json or {}
    recommendation_id = (body.get("recommendation_id") or "").strip()
    recommendation = store.market_job_recommendation_get(recommendation_id) if recommendation_id else None
    if recommendation_id and (not recommendation or recommendation.get("job_id") != job_id or not recommendation.get("policy_pass")):
        return _error("invalid recommendation_id", 400, "invalid_recommendation")
    agent_id = (body.get("agent_id") or "").strip() or (recommendation or {}).get("agent_id", "")
    specialist_id = (body.get("specialist_id") or "").strip() or (recommendation or {}).get("specialist_id", "")
    if not agent_id:
        return _error("agent_id required", 400, "agent_required")
    agent = store.market_agent_profile_get(agent_id)
    if not agent:
        return _error("agent not found", 404, "agent_not_found")
    suspended, suspend_reason = _is_agent_or_operator_suspended(agent)
    if suspended:
        return _error(suspend_reason, 409, "agent_suspended")

    direct_violations = _agent_policy_violations(job, account, agent)
    if direct_violations and not recommendation:
        return _error("; ".join(direct_violations), 400, "agent_policy_violation")

    if recommendation and recommendation.get("agent_id") != agent_id:
        return _error("recommendation agent_id mismatch", 400, "recommendation_agent_mismatch")

    plan_id = (body.get("plan_id") or "").strip()
    requires_plan = bool(recommendation and recommendation.get("requires_plan")) or _plan_required(job, agent.get("lane", ""))
    if requires_plan and not plan_id:
        return _error("plan_id required for this assignment", 400, "plan_required")
    if plan_id:
        plan = store.market_job_plan_get(plan_id)
        if not plan or plan["job_id"] != job_id:
            return _error("plan_id does not belong to job", 400, "invalid_plan")

    assignments = store.market_job_assignments_list(job_id)
    if any(
        existing["agent_id"] == agent_id
        and existing["status"] in {"active", "approved", "changes_requested"}
        for existing in assignments
    ):
        return _error("agent already has an active assignment for this job", 409, "assignment_conflict")

    assignment_id = _make_id("assign")
    store.market_job_assignment_create(assignment_id=assignment_id, job_id=job_id, agent_id=agent_id, specialist_id=specialist_id, recommendation_id=recommendation_id, plan_id=plan_id, assigned_by=(body.get("assigned_by") or "").strip(), mode=body.get("mode") or "exclusive", status=body.get("status") or "active", lease_expires_at=time.time() + int(body.get("lease_seconds") or 3600))
    if not _set_job_status(job, "assigned"):
        return _error("job status transition to assigned is not allowed", 409, "invalid_job_state")
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
        return _error("job not found", 404, "job_not_found")
    if job.get("status") not in _MUTATING_JOB_STATUSES:
        return _error("job is not executable in its current status", 409, "invalid_job_state")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    body = request.json or {}
    assignment_id = (body.get("assignment_id") or "").strip()
    assignment = next((a for a in store.market_job_assignments_list(job_id) if a["id"] == assignment_id), None) if assignment_id else None
    if not assignment:
        return _error("assignment_id required", 400, "assignment_required")
    if assignment.get("status") not in {"active", "approved", "changes_requested"}:
        return _error("assignment is not executable", 409, "invalid_assignment_state")
    agent = store.market_agent_profile_get(assignment["agent_id"])
    if not agent:
        return _error("assignment agent not found", 404, "agent_not_found")
    suspended, suspend_reason = _is_agent_or_operator_suspended(agent)
    if suspended:
        return _error(suspend_reason, 409, "agent_suspended")
    mode = _validate_mode(body.get("mode") or "dry_run")
    if mode is None:
        return _error("mode must be dry_run or apply", 400, "invalid_mode")
    force = bool(body.get("force", False))
    idempotency_key = (body.get("idempotency_key") or "").strip()
    runs = [r for r in store.market_execution_runs_list(job_id) if r.get("assignment_id") == assignment_id]
    running = next((r for r in runs if r.get("status") == "running"), None)
    if running:
        return _error("assignment already has a running execution", 409, "execution_in_progress")
    if idempotency_key:
        replay = next((r for r in runs if (r.get("evidence") or {}).get("idempotency_key") == idempotency_key), None)
        if replay:
            submission = store.market_submission_get(replay.get("submission_id") or "") if replay.get("submission_id") else None
            return jsonify({"status": "idempotent_replay", "run": replay, "submission": submission})
    if not force:
        latest = next((r for r in runs if r.get("status") in {"completed", "noop"} and r.get("mode") == mode), None)
        if latest:
            submission = store.market_submission_get(latest.get("submission_id") or "") if latest.get("submission_id") else None
            return jsonify({"status": "reused_existing_run", "run": latest, "submission": submission})
    try:
        run, submission = _execute_assignment(job, account, assignment, mode=mode, idempotency_key=idempotency_key)
    except Exception:
        current_app.logger.exception("market execution failed", extra={"job_id": job_id, "assignment_id": assignment_id})
        return _error("execution failed; see gateway logs for details", 400, "execution_failed")
    return jsonify({"status": "executed", "run": run, "submission": submission})


@market_bp.route("/market/jobs/<job_id>/autopilot", methods=["POST"])
def autopilot_job(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return _error("job not found", 404, "job_not_found")
    if job.get("status") not in _MUTATING_JOB_STATUSES:
        return _error("job is not executable in its current status", 409, "invalid_job_state")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    if not account.get("local_path"):
        return _error("repository_account local_path required", 400, "repository_path_required")
    body = request.json or {}
    mode = _validate_mode(body.get("mode") or "apply")
    if mode is None:
        return _error("mode must be dry_run or apply", 400, "invalid_mode")
    _seed_managed_agents()
    recommendations = _recommend_agents(job, account, store.market_agent_profiles_list(status="active"))
    store.market_job_recommendations_replace(job_id, recommendations)
    recommendation = next((r for r in recommendations if r["policy_pass"]), None)
    if not recommendation:
        return _error("no eligible agent recommendation", 400, "no_eligible_recommendation")
    plan_summary, plan_steps = _default_plan(job, recommendation)
    plan_id = _make_id("plan")
    store.market_job_plan_create(plan_id=plan_id, job_id=job_id, agent_id=recommendation["agent_id"], operator_id="platform-router", summary=plan_summary, steps=plan_steps, estimated_cost=0, estimated_seconds=900, status="proposed")
    assignment_id = _make_id("assign")
    store.market_job_assignment_create(assignment_id=assignment_id, job_id=job_id, agent_id=recommendation["agent_id"], specialist_id=recommendation.get("specialist_id", ""), recommendation_id=recommendation["recommendation_id"], plan_id=plan_id if recommendation.get("requires_plan") else "", assigned_by="platform-router", mode="exclusive", status="active", lease_expires_at=time.time() + 3600)
    if not _set_job_status(job, "assigned"):
        return _error("job status transition to assigned is not allowed", 409, "invalid_job_state")
    try:
        run, submission = _execute_assignment(job, account, store.market_job_assignments_list(job_id)[0], mode=mode)
    except Exception:
        current_app.logger.exception("market autopilot failed", extra={"job_id": job_id})
        return _error("autopilot execution failed; see gateway logs for details", 400, "execution_failed")
    return jsonify({"status": "autopilot_complete", "recommendation": recommendation, "plan": store.market_job_plan_get(plan_id), "assignment": store.market_job_assignments_list(job_id)[0], "run": run, "submission": submission})


@market_bp.route("/market/jobs/<job_id>/offers", methods=["GET"])
def list_job_offers(job_id: str):
    if not store.market_job_get(job_id):
        return _error("job not found", 404, "job_not_found")
    return jsonify({"offers": store.market_offers_list(job_id)})


@market_bp.route("/market/jobs/<job_id>/offers", methods=["POST"])
def create_job_offer(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return _error("job not found", 404, "job_not_found")
    body = request.json or {}
    agent_id = (body.get("agent_id") or "").strip()
    if not agent_id:
        return _error("agent_id required", 400, "missing_required_fields")
    agent = store.market_agent_profile_get(agent_id)
    if not agent:
        return _error("agent not found", 404, "agent_not_found")
    if (agent.get("status") or "").strip().lower() != "active":
        return _error("agent must be active to offer", 409, "agent_inactive")
    suspended, suspend_reason = _is_agent_or_operator_suspended(agent)
    if suspended:
        return _error(suspend_reason, 409, "agent_suspended")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    violations = _agent_policy_violations(job, account, agent)
    if violations:
        return _error("; ".join(violations), 400, "agent_policy_violation")
    offer_id = _make_id("offer")
    store.market_offer_create(
        offer_id=offer_id,
        job_id=job_id,
        agent_id=agent_id,
        operator_id=(agent.get("operator_id") or "").strip(),
        amount=int(body.get("amount") or 0),
        currency=(body.get("currency") or "credits").strip(),
        eta_seconds=int(body.get("eta_seconds") or 0),
        sla_summary=(body.get("sla_summary") or "").strip(),
        notes=(body.get("notes") or "").strip(),
        status="open",
    )
    return jsonify({"status": "created", "offer": store.market_offer_get(offer_id)}), 201


@market_bp.route("/market/jobs/<job_id>/award", methods=["GET"])
def get_job_award(job_id: str):
    if not store.market_job_get(job_id):
        return _error("job not found", 404, "job_not_found")
    return jsonify({"award": store.market_award_get_by_job(job_id)})


@market_bp.route("/market/jobs/<job_id>/award", methods=["POST"])
def award_job_offer(job_id: str):
    job = store.market_job_get(job_id)
    if not job:
        return _error("job not found", 404, "job_not_found")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    body = request.json or {}
    offer_id = (body.get("offer_id") or "").strip()
    offer = store.market_offer_get(offer_id) if offer_id else None
    if not offer or offer.get("job_id") != job_id:
        return _error("valid offer_id required", 400, "invalid_offer")
    if offer.get("status") != "open":
        return _error("offer is not open", 409, "invalid_offer_state")
    agent = store.market_agent_profile_get(offer["agent_id"])
    if not agent:
        return _error("offered agent not found", 404, "agent_not_found")
    suspended, suspend_reason = _is_agent_or_operator_suspended(agent)
    if suspended:
        return _error(suspend_reason, 409, "agent_suspended")
    award_id = _make_id("award")
    store.market_award_upsert(
        award_id=award_id,
        job_id=job_id,
        offer_id=offer_id,
        awarded_agent_id=offer["agent_id"],
        awarded_by=(body.get("awarded_by") or "").strip(),
        decision_notes=(body.get("decision_notes") or "").strip(),
        status="awarded",
    )
    store.market_offer_update_status(offer_id, "accepted")
    for other in store.market_offers_list(job_id):
        if other["id"] != offer_id and other["status"] == "open":
            store.market_offer_update_status(other["id"], "rejected")
    if not _set_job_status(job, "awarded"):
        return _error("job status transition to awarded is not allowed", 409, "invalid_job_state")
    return jsonify({"status": "awarded", "award": store.market_award_get_by_job(job_id)})


@market_bp.route("/market/settlements", methods=["GET"])
def list_settlements():
    return jsonify({"settlements": store.market_settlements_list()})


@market_bp.route("/market/jobs/<job_id>/settlements", methods=["GET"])
def list_job_settlements(job_id: str):
    if not store.market_job_get(job_id):
        return _error("job not found", 404, "job_not_found")
    return jsonify({"settlements": store.market_settlements_list(job_id)})


@market_bp.route("/market/settlements/<settlement_id>/pay", methods=["POST"])
def pay_settlement(settlement_id: str):
    settlement = store.market_settlement_get(settlement_id)
    if not settlement:
        return _error("settlement not found", 404, "settlement_not_found")
    if settlement.get("frozen"):
        return _error("settlement is frozen", 409, "settlement_frozen")
    body = request.json or {}
    store.market_settlement_update(
        settlement_id,
        status="paid",
        resolution_notes=(body.get("notes") or "").strip(),
    )
    store.market_payout_ledger_create(
        payout_id=_make_id("pay"),
        job_id=settlement["job_id"],
        submission_id=settlement.get("submission_id", ""),
        agent_id=settlement.get("agent_id", ""),
        operator_id=settlement.get("operator_id", ""),
        amount=int(settlement.get("amount") or 0),
        currency=(settlement.get("currency") or "credits"),
        funding_source=(settlement.get("funding_source") or ""),
        status="paid",
        notes=(body.get("notes") or "settlement paid"),
    )
    return jsonify({"status": "paid", "settlement": store.market_settlement_get(settlement_id)})


@market_bp.route("/market/settlements/<settlement_id>/refund", methods=["POST"])
def refund_settlement(settlement_id: str):
    settlement = store.market_settlement_get(settlement_id)
    if not settlement:
        return _error("settlement not found", 404, "settlement_not_found")
    if settlement.get("frozen"):
        return _error("settlement is frozen", 409, "settlement_frozen")
    body = request.json or {}
    store.market_settlement_update(
        settlement_id,
        status="refunded",
        resolution_notes=(body.get("notes") or "").strip(),
    )
    store.market_payout_ledger_create(
        payout_id=_make_id("pay"),
        job_id=settlement["job_id"],
        submission_id=settlement.get("submission_id", ""),
        agent_id=settlement.get("agent_id", ""),
        operator_id=settlement.get("operator_id", ""),
        amount=int(settlement.get("amount") or 0),
        currency=(settlement.get("currency") or "credits"),
        funding_source=(settlement.get("funding_source") or ""),
        status="refunded",
        notes=(body.get("notes") or "settlement refunded"),
    )
    _record_reputation_refund(settlement)
    return jsonify({"status": "refunded", "settlement": store.market_settlement_get(settlement_id)})


@market_bp.route("/market/jobs/<job_id>/disputes", methods=["GET"])
def list_job_disputes(job_id: str):
    if not store.market_job_get(job_id):
        return _error("job not found", 404, "job_not_found")
    disputes = store.market_disputes_list(job_id)
    for dispute in disputes:
        dispute["events"] = store.market_dispute_events_list(dispute["id"])
    return jsonify({"disputes": disputes})


@market_bp.route("/market/jobs/<job_id>/disputes", methods=["POST"])
def open_job_dispute(job_id: str):
    if not store.market_job_get(job_id):
        return _error("job not found", 404, "job_not_found")
    body = request.json or {}
    dispute_id = _make_id("disp")
    settlement_id = (body.get("settlement_id") or "").strip()
    submission_id = (body.get("submission_id") or "").strip()
    store.market_dispute_create(
        dispute_id=dispute_id,
        job_id=job_id,
        settlement_id=settlement_id,
        submission_id=submission_id,
        opened_by=(body.get("opened_by") or "").strip(),
        reason_code=(body.get("reason_code") or "").strip(),
        reason=(body.get("reason") or "").strip(),
        status="open",
    )
    store.market_dispute_event_create(
        event_id=_make_id("dispev"),
        dispute_id=dispute_id,
        actor_id=(body.get("opened_by") or "").strip(),
        event_type="opened",
        detail={"reason": (body.get("reason") or "").strip()},
    )
    if settlement_id:
        store.market_settlement_update(settlement_id, status="hold")
    dispute = store.market_dispute_get(dispute_id)
    dispute["events"] = store.market_dispute_events_list(dispute_id)
    return jsonify({"status": "opened", "dispute": dispute}), 201


@market_bp.route("/market/disputes/<dispute_id>/evidence", methods=["POST"])
def add_dispute_evidence(dispute_id: str):
    dispute = store.market_dispute_get(dispute_id)
    if not dispute:
        return _error("dispute not found", 404, "dispute_not_found")
    body = request.json or {}
    store.market_dispute_event_create(
        event_id=_make_id("dispev"),
        dispute_id=dispute_id,
        actor_id=(body.get("actor_id") or "").strip(),
        event_type="evidence",
        detail={
            "summary": (body.get("summary") or "").strip(),
            "payload": body.get("payload") or {},
        },
    )
    return jsonify({"status": "evidence_recorded", "events": store.market_dispute_events_list(dispute_id)})


@market_bp.route("/market/disputes/<dispute_id>/resolve", methods=["POST"])
def resolve_dispute(dispute_id: str):
    dispute = store.market_dispute_get(dispute_id)
    if not dispute:
        return _error("dispute not found", 404, "dispute_not_found")
    body = request.json or {}
    ruling = (body.get("ruling") or "").strip()
    if ruling not in {"uphold_agent", "refund_buyer", "split"}:
        return _error("ruling must be uphold_agent, refund_buyer, or split", 400, "invalid_ruling")
    settlement_id = (dispute.get("settlement_id") or "").strip()
    if settlement_id:
        if ruling == "refund_buyer":
            store.market_settlement_update(settlement_id, status="refunded", resolution_notes=(body.get("notes") or "").strip())
            settlement = store.market_settlement_get(settlement_id)
            if settlement:
                _record_reputation_refund(settlement)
        elif ruling == "uphold_agent":
            store.market_settlement_update(settlement_id, status="approved", resolution_notes=(body.get("notes") or "").strip())
        else:
            store.market_settlement_update(settlement_id, status="paid", resolution_notes=(body.get("notes") or "").strip())
    store.market_dispute_update(dispute_id, status="resolved", ruling=ruling)
    store.market_dispute_event_create(
        event_id=_make_id("dispev"),
        dispute_id=dispute_id,
        actor_id=(body.get("resolved_by") or "").strip(),
        event_type="resolved",
        detail={"ruling": ruling, "notes": (body.get("notes") or "").strip()},
    )
    updated = store.market_dispute_get(dispute_id)
    _record_reputation_dispute(updated or {}, ruling)
    return jsonify({"status": "resolved", "dispute": updated, "events": store.market_dispute_events_list(dispute_id)})


@market_bp.route("/market/reputation/agents", methods=["GET"])
def list_agent_reputation():
    return jsonify({"reputation": store.market_reputation_list("agent")})


@market_bp.route("/market/reputation/operators", methods=["GET"])
def list_operator_reputation():
    return jsonify({"reputation": store.market_reputation_list("operator")})


@market_bp.route("/market/reputation/agents/<agent_id>", methods=["GET"])
def get_agent_reputation(agent_id: str):
    record = store.market_reputation_get("agent", agent_id)
    if not record:
        return _error("reputation not found", 404, "reputation_not_found")
    return jsonify({"reputation": record})


@market_bp.route("/ops/market/operators/<operator_id>/suspend", methods=["POST"])
def suspend_operator(operator_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    operator = store.market_operator_get(operator_id)
    if not operator:
        return _error("operator not found", 404, "operator_not_found")
    body = request.json or {}
    store.market_operator_upsert(
        operator_id=operator["id"],
        slug=operator["slug"],
        display_name=operator["display_name"],
        summary=operator.get("summary", ""),
        status="suspended",
        onboarding_status=operator.get("onboarding_status", "completed"),
        identity_anchor=operator.get("identity_anchor", ""),
        wallet=operator.get("wallet", ""),
        ens_name=operator.get("ens_name", ""),
        verification_status=operator.get("verification_status", "verified"),
        contact_email=operator.get("contact_email", ""),
        website_url=operator.get("website_url", ""),
        metadata=operator.get("metadata") or {},
    )
    store.market_admin_action_create(
        action_id=_make_id("adm"),
        action_type="suspend_operator",
        target_type="operator",
        target_id=operator_id,
        actor=(body.get("actor") or "admin").strip(),
        notes=(body.get("notes") or "").strip(),
    )
    return jsonify({"status": "suspended", "operator": store.market_operator_get(operator_id)})


@market_bp.route("/ops/market/operators/<operator_id>/unsuspend", methods=["POST"])
def unsuspend_operator(operator_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    operator = store.market_operator_get(operator_id)
    if not operator:
        return _error("operator not found", 404, "operator_not_found")
    body = request.json or {}
    store.market_operator_upsert(
        operator_id=operator["id"],
        slug=operator["slug"],
        display_name=operator["display_name"],
        summary=operator.get("summary", ""),
        status="active",
        onboarding_status=operator.get("onboarding_status", "completed"),
        identity_anchor=operator.get("identity_anchor", ""),
        wallet=operator.get("wallet", ""),
        ens_name=operator.get("ens_name", ""),
        verification_status=operator.get("verification_status", "verified"),
        contact_email=operator.get("contact_email", ""),
        website_url=operator.get("website_url", ""),
        metadata=operator.get("metadata") or {},
    )
    store.market_admin_action_create(
        action_id=_make_id("adm"),
        action_type="unsuspend_operator",
        target_type="operator",
        target_id=operator_id,
        actor=(body.get("actor") or "admin").strip(),
        notes=(body.get("notes") or "").strip(),
    )
    return jsonify({"status": "active", "operator": store.market_operator_get(operator_id)})


@market_bp.route("/ops/market/agents/<agent_id>/suspend", methods=["POST"])
def suspend_agent(agent_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    agent = store.market_agent_profile_get(agent_id)
    if not agent:
        return _error("agent not found", 404, "agent_not_found")
    body = request.json or {}
    store.market_agent_profile_upsert(
        agent_id=agent["id"],
        slug=agent["slug"],
        display_name=agent["display_name"],
        operator_id=agent.get("operator_id", ""),
        summary=agent.get("summary", ""),
        agent_kind=agent.get("agent_kind", "generic"),
        pod=agent.get("pod", ""),
        lane=agent.get("lane", ""),
        supported_job_classes=agent.get("supported_job_classes", []),
        supported_ecosystems=agent.get("supported_ecosystems", []),
        supported_budget_types=agent.get("supported_budget_types", []),
        model=agent.get("model", ""),
        execution_backend=agent.get("execution_backend", ""),
        specialist_id=agent.get("specialist_id", ""),
        trust_tier=agent.get("trust_tier", "standard"),
        pricing_profile=agent.get("pricing_profile", "per_accepted_change"),
        acceptance_rate_30d=float(agent.get("acceptance_rate_30d") or 0),
        median_time_to_pr_seconds=int(agent.get("median_time_to_pr_seconds") or 0),
        revert_rate_90d=float(agent.get("revert_rate_90d") or 0),
        badges=agent.get("badges", []),
        status="suspended",
    )
    store.market_admin_action_create(
        action_id=_make_id("adm"),
        action_type="suspend_agent",
        target_type="agent",
        target_id=agent_id,
        actor=(body.get("actor") or "admin").strip(),
        notes=(body.get("notes") or "").strip(),
    )
    return jsonify({"status": "suspended", "agent": store.market_agent_profile_get(agent_id)})


@market_bp.route("/ops/market/agents/<agent_id>/unsuspend", methods=["POST"])
def unsuspend_agent(agent_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    agent = store.market_agent_profile_get(agent_id)
    if not agent:
        return _error("agent not found", 404, "agent_not_found")
    body = request.json or {}
    store.market_agent_profile_upsert(
        agent_id=agent["id"],
        slug=agent["slug"],
        display_name=agent["display_name"],
        operator_id=agent.get("operator_id", ""),
        summary=agent.get("summary", ""),
        agent_kind=agent.get("agent_kind", "generic"),
        pod=agent.get("pod", ""),
        lane=agent.get("lane", ""),
        supported_job_classes=agent.get("supported_job_classes", []),
        supported_ecosystems=agent.get("supported_ecosystems", []),
        supported_budget_types=agent.get("supported_budget_types", []),
        model=agent.get("model", ""),
        execution_backend=agent.get("execution_backend", ""),
        specialist_id=agent.get("specialist_id", ""),
        trust_tier=agent.get("trust_tier", "standard"),
        pricing_profile=agent.get("pricing_profile", "per_accepted_change"),
        acceptance_rate_30d=float(agent.get("acceptance_rate_30d") or 0),
        median_time_to_pr_seconds=int(agent.get("median_time_to_pr_seconds") or 0),
        revert_rate_90d=float(agent.get("revert_rate_90d") or 0),
        badges=agent.get("badges", []),
        status="active",
    )
    store.market_admin_action_create(
        action_id=_make_id("adm"),
        action_type="unsuspend_agent",
        target_type="agent",
        target_id=agent_id,
        actor=(body.get("actor") or "admin").strip(),
        notes=(body.get("notes") or "").strip(),
    )
    return jsonify({"status": "active", "agent": store.market_agent_profile_get(agent_id)})


@market_bp.route("/ops/market/settlements/<settlement_id>/freeze", methods=["POST"])
def freeze_settlement(settlement_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    settlement = store.market_settlement_get(settlement_id)
    if not settlement:
        return _error("settlement not found", 404, "settlement_not_found")
    body = request.json or {}
    store.market_settlement_update(settlement_id, frozen=True, status="hold", resolution_notes=(body.get("notes") or "").strip())
    store.market_admin_action_create(
        action_id=_make_id("adm"),
        action_type="freeze_settlement",
        target_type="settlement",
        target_id=settlement_id,
        actor=(body.get("actor") or "admin").strip(),
        notes=(body.get("notes") or "").strip(),
    )
    return jsonify({"status": "frozen", "settlement": store.market_settlement_get(settlement_id)})


@market_bp.route("/ops/market/settlements/<settlement_id>/unfreeze", methods=["POST"])
def unfreeze_settlement(settlement_id: str):
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    settlement = store.market_settlement_get(settlement_id)
    if not settlement:
        return _error("settlement not found", 404, "settlement_not_found")
    body = request.json or {}
    target_status = (body.get("status") or "approved").strip() or "approved"
    store.market_settlement_update(settlement_id, frozen=False, status=target_status, resolution_notes=(body.get("notes") or "").strip())
    store.market_admin_action_create(
        action_id=_make_id("adm"),
        action_type="unfreeze_settlement",
        target_type="settlement",
        target_id=settlement_id,
        actor=(body.get("actor") or "admin").strip(),
        notes=(body.get("notes") or "").strip(),
    )
    return jsonify({"status": "unfrozen", "settlement": store.market_settlement_get(settlement_id)})


@market_bp.route("/ops/market/incidents", methods=["GET"])
def list_market_incidents():
    if not _ops_authorized():
        return _error("admin authentication required", 401, "unauthorized")
    return jsonify({"incidents": store.market_admin_actions_list(limit=request.args.get("limit", default=100, type=int))})


@market_bp.route("/market/submissions", methods=["POST"])
def create_submission():
    body = request.json or {}
    job_id = (body.get("job_id") or "").strip()
    agent_id = (body.get("agent_id") or "").strip()
    if not job_id or not agent_id:
        return _error("job_id and agent_id required", 400, "missing_required_fields")
    job = store.market_job_get(job_id)
    if not job:
        return _error("job not found", 404, "job_not_found")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    assignments = [a for a in store.market_job_assignments_list(job_id) if a["agent_id"] == agent_id]
    if not assignments:
        return _error("submission requires an assignment for this agent", 400, "assignment_required")
    if not any(a["status"] in {"active", "approved", "changes_requested"} for a in assignments):
        return _error("agent does not have an assignment in a submittable state", 409, "invalid_assignment_state")
    submission_id = _make_id("sub")
    store.market_submission_create(submission_id=submission_id, job_id=job_id, agent_id=agent_id, branch_name=body.get("branch_name") or "", pr_number=int(body.get("pr_number") or 0), pr_url=body.get("pr_url") or "", diff_summary=body.get("diff_summary") or "", evidence=body.get("evidence") or {}, status=body.get("status") or "submitted", acceptance_attribution=body.get("acceptance_attribution") or "")
    return jsonify({"status": "created", "submission": store.market_submission_get(submission_id)}), 201


@market_bp.route("/market/submissions/<submission_id>/reviews", methods=["GET"])
def list_submission_reviews(submission_id: str):
    submission = store.market_submission_get(submission_id)
    if not submission:
        return jsonify({"error": "submission not found"}), 404
    return jsonify({"submission": submission, "reviews": store.market_submission_reviews_list(submission_id)})


@market_bp.route("/market/submissions/<submission_id>/reviews", methods=["POST"])
def review_submission(submission_id: str):
    submission = store.market_submission_get(submission_id)
    if not submission:
        return jsonify({"error": "submission not found"}), 404
    body = request.json or {}
    action = (body.get("action") or "").strip()
    if action not in _SUBMISSION_REVIEW_ACTIONS:
        return jsonify({"error": "action must be one of start_review, comment, changes_requested, approve"}), 400
    review_id = _make_id("review")
    payload = body.get("payload") or {}
    summary = (body.get("summary") or "").strip()
    notes = (body.get("notes") or "").strip()
    store.market_submission_review_create(
        review_id=review_id,
        submission_id=submission_id,
        job_id=submission["job_id"],
        agent_id=submission["agent_id"],
        reviewer_id=(body.get("reviewer_id") or "").strip(),
        reviewer_role=(body.get("reviewer_role") or "maintainer").strip() or "maintainer",
        action=action,
        summary=summary,
        notes=notes,
        payload=payload,
    )
    evidence = dict(submission.get("evidence") or {})
    review_history = evidence.get("review_history", [])
    review_history.append(
        {
            "review_id": review_id,
            "action": action,
            "summary": summary,
            "reviewer_id": (body.get("reviewer_id") or "").strip(),
            "reviewer_role": (body.get("reviewer_role") or "maintainer").strip() or "maintainer",
        }
    )
    evidence["review_history"] = review_history
    if notes:
        evidence["latest_review_notes"] = notes
    next_status = _SUBMISSION_REVIEW_STATUS[action]
    if next_status:
        store.market_submission_update(submission_id, status=next_status, evidence=evidence)
    else:
        store.market_submission_update(submission_id, evidence=evidence)
    if action == "changes_requested":
        for assignment in [a for a in store.market_job_assignments_list(submission["job_id"]) if a["agent_id"] == submission["agent_id"]]:
            store.market_job_assignment_update_status(assignment["id"], "changes_requested")
    elif action == "approve":
        for assignment in [a for a in store.market_job_assignments_list(submission["job_id"]) if a["agent_id"] == submission["agent_id"]]:
            if assignment["status"] not in {"completed", "rejected"}:
                store.market_job_assignment_update_status(assignment["id"], "approved")
    return jsonify({
        "status": "review_recorded",
        "submission": store.market_submission_get(submission_id),
        "review": store.market_submission_reviews_list(submission_id)[-1],
        "reviews": store.market_submission_reviews_list(submission_id),
    }), 201


@market_bp.route("/market/submissions/<submission_id>/decision", methods=["POST"])
def decide_submission(submission_id: str):
    submission = store.market_submission_get(submission_id)
    if not submission:
        return _error("submission not found", 404, "submission_not_found")
    job = store.market_job_get(submission["job_id"])
    if not job:
        return _error("job not found for submission", 404, "job_not_found")
    account = store.market_repository_account_get_by_repo(job["repo_full_name"])
    if not account:
        return _error("repository_account missing for job", 404, "repository_not_found")
    can_write, owner_error = _check_repo_owner_access(account)
    if not can_write:
        return _error(owner_error, 403, "owner_mismatch")
    body = request.json or {}
    decision = (body.get("decision") or "").strip()
    if decision not in {"accepted", "rejected"}:
        return _error("decision must be accepted or rejected", 400, "invalid_decision")
    if _is_terminal_submission(submission):
        if submission.get("status") != decision:
            return _error("submission already has a terminal decision", 409, "terminal_submission")
        return jsonify({"status": "already_decided", "job": job, "submission": submission, "payouts": store.market_payout_ledger_list(job["id"])})
    evidence = dict(submission.get("evidence") or {})
    if body.get("merged_by"):
        evidence["merged_by"] = body["merged_by"]
    if body.get("notes"):
        evidence["decision_notes"] = body["notes"]
    store.market_submission_update(submission_id, status=decision, acceptance_attribution=(body.get("acceptance_attribution") or "").strip(), evidence=evidence)
    matching = [a for a in store.market_job_assignments_list(job["id"]) if a["agent_id"] == submission["agent_id"]]
    award = store.market_award_get_by_job(job["id"])
    settlement = store.market_settlement_get_by_submission(submission_id)
    if decision == "accepted":
        if not _set_job_status(job, "completed"):
            return _error("job status transition to completed is not allowed", 409, "invalid_job_state")
        for assignment in matching:
            store.market_job_assignment_update_status(assignment["id"], "completed")
        payout_amount = int(body.get("payout_amount") or 0)
        if payout_amount > 0:
            if settlement:
                store.market_settlement_update(
                    settlement["id"],
                    status="approved",
                    resolution_notes=(body.get("notes") or "").strip(),
                )
            else:
                store.market_settlement_create(
                    settlement_id=_make_id("set"),
                    job_id=job["id"],
                    submission_id=submission_id,
                    award_id=(award or {}).get("id", ""),
                    agent_id=submission["agent_id"],
                    operator_id=(body.get("operator_id") or "").strip(),
                    amount=payout_amount,
                    currency=(body.get("currency") or "credits").strip(),
                    funding_source=(body.get("funding_source") or "").strip(),
                    status="approved",
                    resolution_notes=(body.get("notes") or "").strip(),
                )
            store.market_payout_ledger_create(
                payout_id=_make_id("pay"),
                job_id=job["id"],
                submission_id=submission_id,
                agent_id=submission["agent_id"],
                operator_id=(body.get("operator_id") or "").strip(),
                amount=payout_amount,
                currency=(body.get("currency") or "credits").strip(),
                funding_source=(body.get("funding_source") or "").strip(),
                status="approved",
                notes=(body.get("notes") or "").strip() or "settlement approved",
            )
        _record_reputation_from_submission(submission, "accepted")
    else:
        other_accepted = [
            row for row in store.market_submissions_list(job["id"])
            if row["id"] != submission_id and row.get("status") == "accepted"
        ]
        if not other_accepted:
            if not _set_job_status(job, "open"):
                return _error("job status transition to open is not allowed", 409, "invalid_job_state")
        for assignment in matching:
            store.market_job_assignment_update_status(assignment["id"], "rejected")
        _record_reputation_from_submission(submission, "rejected")
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
