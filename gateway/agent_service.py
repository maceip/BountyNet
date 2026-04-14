from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from gateway import store
from gateway.agent_fleet import get_serving_profile
from gateway.market_exec import execute_managed_job
from gateway.model_runtime import complete_json, runtime_available, runtime_config_for_profile, runtime_summary


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _repo_snapshot(repo_path: str) -> dict[str, str]:
    root = Path(repo_path).expanduser().resolve()
    snapshots: dict[str, str] = {}
    candidates = [
        root / "package.json",
        root / "tsconfig.json",
        root / "tsconfig.base.json",
        root / "Cargo.toml",
    ]
    workflows = list((root / ".github" / "workflows").glob("*.y*ml")) if (root / ".github" / "workflows").is_dir() else []
    for path in candidates + workflows[:4]:
        if path.is_file():
            try:
                snapshots[path.relative_to(root).as_posix()] = path.read_text(encoding="utf-8")[:4000]
            except Exception:
                continue
    return snapshots


def build_agent_request(*, agent: dict[str, Any], job: dict[str, Any], account: dict[str, Any]) -> dict[str, Any]:
    profile = get_serving_profile(agent["slug"])
    if not profile:
        raise ValueError(f"no serving profile for {agent['slug']}")
    repo_context = _repo_snapshot(account["local_path"]) if account.get("local_path") else {}
    metadata = job.get("metadata") or {}
    runtime = runtime_config_for_profile(profile, agent_model=agent.get("model", ""))
    return {
        "agent_slug": agent["slug"],
        "agent_display_name": agent["display_name"],
        "repo_full_name": account["repo_full_name"],
        "repo_path": account.get("local_path", ""),
        "job": {
            "id": job["id"],
            "job_class": job["job_class"],
            "title": job["title"],
            "summary": job.get("summary", ""),
            "risk_level": job.get("risk_level", "medium"),
            "metadata": metadata,
        },
        "policy": {
            "allowed_tools": list(profile.allowed_tools),
            "allowed_files": list(profile.allowed_files),
            "validator_recipe": list(profile.validator_recipe),
            "plan_required": profile.plan_required,
        },
        "runtime": {
            "provider": runtime.provider,
            "model": runtime.model,
            "resolved_model": runtime.resolved_model,
            "fallback_model": runtime.fallback_model,
            "resolved_fallback_model": runtime.resolved_fallback_model,
            "reasoning_effort": runtime.reasoning_effort,
            "adapter": profile.runtime_adapter,
        },
        "repo_context": repo_context,
    }


def _messages_for_request(request_payload: dict[str, Any]) -> list[dict[str, str]]:
    profile = get_serving_profile(request_payload["agent_slug"])
    assert profile is not None
    user_payload = {
        "repo_full_name": request_payload["repo_full_name"],
        "job": request_payload["job"],
        "policy": request_payload["policy"],
        "repo_context": request_payload["repo_context"],
        "required_response": {
            "summary": "string",
            "why_this_change": "string",
            "planned_tools": ["tool names from allowed_tools"],
            "files_to_touch": ["relative file paths"],
            "proposed_updates": [{"package": "name", "target_version": "version", "reason": "why"}],
            "validator_notes": ["string"],
        },
    }
    return [
        {"role": "system", "content": profile.system_prompt + " Respond with strict JSON only."},
        {"role": "user", "content": json.dumps(user_payload, indent=2)},
    ]


def invoke_agent(*, agent: dict[str, Any], job: dict[str, Any], account: dict[str, Any]) -> dict[str, Any]:
    request_payload = build_agent_request(agent=agent, job=job, account=account)
    profile = get_serving_profile(agent["slug"])
    assert profile is not None
    config = runtime_config_for_profile(profile, agent_model=agent.get("model", ""))
    invocation_id = _make_id("invoke")
    store.market_agent_invocation_create(
        invocation_id=invocation_id,
        agent_id=agent["id"],
        job_id=job["id"],
        repository_account_id=account["id"],
        model=config.model or profile.runtime_model,
        provider=config.provider or profile.runtime_provider,
        status="running",
        request=request_payload,
        started_at=time.time(),
    )
    if runtime_available(config):
        try:
            response = complete_json(messages=_messages_for_request(request_payload), config=config)
            tool_calls = [{"tool": tool, "allowed": True} for tool in response["parsed"].get("planned_tools", []) if isinstance(response["parsed"], dict)]
            validations = [{"name": name, "status": "pending"} for name in profile.validator_recipe]
            store.market_agent_invocation_update(
                invocation_id,
                status="completed",
                response=response["parsed"],
                tool_calls=tool_calls,
                validations=validations,
                tokens_in=response["tokens_in"],
                tokens_out=response["tokens_out"],
                finished_at=time.time(),
            )
        except Exception as exc:
            fallback = {
                "summary": f"{agent['display_name']} runtime call failed; using bounded local executor fallback.",
                "why_this_change": str(exc),
                "planned_tools": list(profile.allowed_tools),
                "files_to_touch": [],
                "proposed_updates": [],
                "validator_notes": list(profile.validator_recipe),
                "fallback": True,
                "runtime_error": str(exc),
            }
            store.market_agent_invocation_update(
                invocation_id,
                status="fallback",
                response=fallback,
                tool_calls=[{"tool": tool, "allowed": True} for tool in profile.allowed_tools],
                validations=[{"name": name, "status": "pending"} for name in profile.validator_recipe],
                finished_at=time.time(),
            )
    else:
        fallback = {
            "summary": f"{agent['display_name']} runtime unavailable; using bounded local executor fallback.",
            "why_this_change": "The shared model runtime is not configured in this environment.",
            "planned_tools": list(profile.allowed_tools),
            "files_to_touch": [],
            "proposed_updates": [],
            "validator_notes": list(profile.validator_recipe),
            "fallback": True,
        }
        store.market_agent_invocation_update(
            invocation_id,
            status="fallback",
            response=fallback,
            tool_calls=[{"tool": tool, "allowed": True} for tool in profile.allowed_tools],
            validations=[{"name": name, "status": "pending"} for name in profile.validator_recipe],
            finished_at=time.time(),
        )
    return store.market_agent_invocation_get(invocation_id) or {"id": invocation_id}


def runtime_status_for_agent(agent_slug: str, *, agent_model: str = "") -> dict[str, Any]:
    profile = get_serving_profile(agent_slug)
    if not profile:
        raise ValueError(f"no serving profile for {agent_slug}")
    cfg = runtime_config_for_profile(profile, agent_model=agent_model)
    status = runtime_summary(cfg)
    status["agent_slug"] = profile.slug
    status["adapter"] = profile.runtime_adapter
    status["validator_recipe"] = list(profile.validator_recipe)
    status["allowed_tools"] = list(profile.allowed_tools)
    status["plan_required"] = profile.plan_required
    return status


def execute_agent_assignment(*, agent: dict[str, Any], job: dict[str, Any], account: dict[str, Any], mode: str = "apply") -> dict[str, Any]:
    invocation = invoke_agent(agent=agent, job=job, account=account)
    execution = execute_managed_job(repo_path=account["local_path"], job=job, agent=agent, mode=mode)
    execution["invocation"] = invocation
    execution["validations"] = invocation.get("validations", [])
    return execution
