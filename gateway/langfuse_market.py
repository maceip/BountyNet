from __future__ import annotations

from contextlib import contextmanager
from typing import Any


def _client():
    try:
        from langfuse import get_client
    except Exception:
        return None
    try:
        return get_client()
    except Exception:
        return None


def _trace_seed(*, job_id: str, assignment_id: str, agent_id: str) -> str:
    return f"market:{job_id}:{assignment_id}:{agent_id}"


@contextmanager
def contract_trace(
    *,
    job: dict[str, Any],
    account: dict[str, Any],
    agent: dict[str, Any],
    assignment: dict[str, Any],
    plan: dict[str, Any] | None = None,
):
    client = _client()
    if not client:
        yield None
        return
    try:
        trace_id = client.create_trace_id(seed=_trace_seed(job_id=job["id"], assignment_id=assignment["id"], agent_id=agent["id"]))
        trace_url = client.get_trace_url(trace_id=trace_id)
        metadata = {
            "repo_full_name": account["repo_full_name"],
            "job_class": job["job_class"],
            "agent_slug": agent.get("slug", ""),
            "agent_kind": agent.get("agent_kind", ""),
            "lane": agent.get("lane", ""),
            "plan_id": (plan or {}).get("id", ""),
            "assignment_id": assignment["id"],
        }
        with client.start_as_current_observation(
            as_type="span",
            name="marketplace-contract",
            trace_context={"trace_id": trace_id},
            input={
                "repo_full_name": account["repo_full_name"],
                "job_id": job["id"],
                "job_title": job.get("title", ""),
                "job_class": job["job_class"],
                "agent_slug": agent.get("slug", ""),
                "assignment_id": assignment["id"],
            },
            metadata=metadata,
        ) as span:
            yield {"client": client, "span": span, "trace_id": trace_id, "trace_url": trace_url}
            client.flush()
    except Exception:
        yield None


def update_contract_trace(context: dict[str, Any] | None, *, output: dict[str, Any], metadata: dict[str, Any] | None = None) -> None:
    if not context:
        return
    span = context.get("span")
    if not span:
        return
    try:
        span.update(output=output, metadata=metadata or {})
        context["client"].flush()
    except Exception:
        return


def score_contract_acceptance(
    *,
    trace_id: str,
    accepted: bool,
    comment: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    client = _client()
    if not client or not trace_id:
        return
    try:
        client.create_score(
            trace_id=trace_id,
            name="accepted_change",
            value=1 if accepted else 0,
            data_type="BOOLEAN",
            comment=comment,
            metadata=metadata or {},
        )
        client.flush()
    except Exception:
        return
