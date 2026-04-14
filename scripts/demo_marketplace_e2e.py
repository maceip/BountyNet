from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

from starlette.testclient import TestClient


def run() -> dict:
    workspace = Path(__file__).resolve().parents[1]
    if str(workspace) not in sys.path:
        sys.path.insert(0, str(workspace))
    runtime_dir = workspace / "projects" / "agent-market" / "demo"
    runtime_dir.mkdir(parents=True, exist_ok=True)

    db_path = runtime_dir / "demo-marketplace-e2e.db"
    if db_path.exists():
        db_path.unlink()

    repo = runtime_dir / "demo-marketplace-repo"
    if repo.exists():
        shutil.rmtree(repo)

    os.environ["BOUNTYNET_DB_PATH"] = str(db_path)
    os.environ["BOUNTYNET_DEV_SKIP_JWT_VERIFICATION"] = "1"
    os.environ["BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY"] = "1"
    os.environ["TEMP"] = str(runtime_dir)
    os.environ["TMP"] = str(runtime_dir)

    (repo / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
    (repo / ".github" / "workflows" / "ci.yml").write_text(
        "name: CI\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v3\n      - uses: actions/setup-node@v3\n",
        encoding="utf-8",
    )
    (repo / "tsconfig.json").write_text('{"compilerOptions":{"strict":true}}\n', encoding="utf-8")

    from gateway.factory import create_asgi_app

    app = create_asgi_app()
    with TestClient(app) as client:
        seed = client.post("/market/agents/seed")
        runtime = client.get("/market/runtime")
        setup = client.post(
            "/market/repositories/setup",
            json={
                "installation_id": 1200,
                "repos": ["local/demo-marketplace-repo"],
                "local_path": str(repo),
                "budget_priority": ["platform_credits", "api_key_pool"],
            },
        )
        job = client.post(
            "/market/jobs",
            json={
                "repo_full_name": "local/demo-marketplace-repo",
                "job_class": "ci_repair",
                "title": "Repair workflow drift",
                "metadata": {"pod": "typescript", "lane": "migration", "required_trust_tier": "trusted"},
            },
        )
        job_id = job.json()["job"]["id"]
        recommendations = client.post(f"/market/jobs/{job_id}/recommendations")
        autopilot = client.post(f"/market/jobs/{job_id}/autopilot", json={})
        detail = client.get(f"/market/jobs/{job_id}")
        submission_id = ((autopilot.json().get("submission") or {}).get("id") or "")
        decision = None
        if submission_id:
            decision = client.post(
                f"/market/submissions/{submission_id}/decision",
                json={
                    "decision": "accepted",
                    "acceptance_attribution": "maintainer_accepted",
                    "merged_by": "demo-maintainer",
                    "operator_id": "platform-managed",
                    "funding_source": "platform_credits",
                    "currency": "credits",
                    "payout_amount": 100,
                    "notes": "Demo acceptance for Langfuse verification.",
                },
            )
        final_detail = client.get(f"/market/jobs/{job_id}")

    return {
        "seed_status": seed.status_code,
        "runtime": runtime.json(),
        "setup_status": setup.status_code,
        "job_status": job.status_code,
        "recommendations_status": recommendations.status_code,
        "recommendations": recommendations.json(),
        "autopilot_status": autopilot.status_code,
        "autopilot": autopilot.json(),
        "detail": detail.json(),
        "decision_status": decision.status_code if decision else 0,
        "decision": decision.json() if decision else {},
        "final_detail": final_detail.json(),
        "workflow": (repo / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8"),
        "tsconfig": (repo / "tsconfig.json").read_text(encoding="utf-8"),
    }


if __name__ == "__main__":
    payload = run()
    out = Path(__file__).resolve().parents[1] / "projects" / "agent-market" / "demo" / "demo-marketplace-e2e.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(out)
