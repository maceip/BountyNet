from __future__ import annotations

import os
import re
import shlex
import subprocess
import time
import uuid
from pathlib import Path

from gateway import store
from gateway.ops_env import apply_do_token_aliases, load_env_file

_DEFAULT_MODULES = {
    "digitalocean_edge": "digitalocean-regional-lbs",
    "digitalocean_global_lb": "digitalocean-global-lb",
    "digitalocean_global_dns": "digitalocean-global-dns",
    "aws_global_accelerator": "aws-global-accelerator",
}


def _infra_root() -> Path:
    override = (os.getenv("MARKET_INFRA_ROOT") or "").strip()
    if override:
        return Path(override).expanduser()
    return Path(__file__).resolve().parents[1] / "infra" / "marketplace-fleet"


def _terraform_exe() -> str:
    configured = (os.getenv("TERRAFORM_BIN") or "").strip()
    if configured:
        return configured
    return "terraform"


def _summarize_plan(stdout_text: str) -> dict:
    add_match = re.search(r"Plan:\s+(\d+)\s+to add,\s+(\d+)\s+to change,\s+(\d+)\s+to destroy\.", stdout_text)
    if add_match:
        return {
            "to_add": int(add_match.group(1)),
            "to_change": int(add_match.group(2)),
            "to_destroy": int(add_match.group(3)),
        }
    return {}


def run_drift_once(trigger: str = "scheduled") -> list[dict]:
    infra_root = _infra_root()
    terraform_root = infra_root / "terraform"
    env = os.environ.copy()
    env_file = Path((os.getenv("MARKET_INFRA_ENV_FILE") or str(Path.cwd() / ".env.infra.txt")).strip())
    env.update(load_env_file(env_file))
    apply_do_token_aliases(env)

    results: list[dict] = []
    for module_key, module_dir_name in _DEFAULT_MODULES.items():
        module_path = terraform_root / module_dir_name
        if not module_path.is_dir():
            continue
        run_id = f"drift_{uuid.uuid4().hex[:12]}"
        store.market_ops_drift_run_create(
            run_id=run_id,
            module_key=module_key,
            module_path=str(module_path),
            trigger=trigger,
            status="running",
        )
        started_at = time.time()
        cmd = [
            _terraform_exe(),
            f"-chdir={module_path}",
            "plan",
            "-detailed-exitcode",
            "-input=false",
            "-no-color",
        ]
        try:
            completed = subprocess.run(
                cmd,
                env=env,
                text=True,
                capture_output=True,
                timeout=max(60, int(os.getenv("MARKET_OPS_DRIFT_TIMEOUT_SEC", "1800"))),
                check=False,
            )
            drift_detected = completed.returncode == 2
            status = "ok" if completed.returncode in {0, 2} else "failed"
            diff_summary = {
                "command": " ".join(shlex.quote(part) for part in cmd),
                "plan": _summarize_plan(completed.stdout or ""),
            }
            item = store.market_ops_drift_run_update(
                run_id,
                status=status,
                exit_code=completed.returncode,
                drift_detected=drift_detected,
                stdout_text=(completed.stdout or "")[-20000:],
                stderr_text=(completed.stderr or "")[-10000:],
                diff_summary=diff_summary,
                started_at=started_at,
                finished_at=time.time(),
            )
            if drift_detected:
                store.market_ops_alert_create(
                    alert_id=f"ops_alert_{uuid.uuid4().hex[:12]}",
                    alert_type="infra_drift_detected",
                    severity="high",
                    source="ops_drift_runner",
                    message=f"drift detected in {module_key}",
                    metadata={"run_id": run_id, "module_key": module_key, "diff_summary": diff_summary},
                )
            elif completed.returncode not in {0, 2}:
                store.market_ops_alert_create(
                    alert_id=f"ops_alert_{uuid.uuid4().hex[:12]}",
                    alert_type="infra_drift_failed",
                    severity="critical",
                    source="ops_drift_runner",
                    message=f"terraform plan failed in {module_key}",
                    metadata={"run_id": run_id, "exit_code": completed.returncode},
                )
            if item:
                results.append(item)
        except Exception as exc:
            item = store.market_ops_drift_run_update(
                run_id,
                status="failed",
                exit_code=1,
                drift_detected=False,
                stderr_text=str(exc),
                started_at=started_at,
                finished_at=time.time(),
            )
            store.market_ops_alert_create(
                alert_id=f"ops_alert_{uuid.uuid4().hex[:12]}",
                alert_type="infra_drift_failed",
                severity="critical",
                source="ops_drift_runner",
                message=f"drift runner crashed for {module_key}",
                metadata={"run_id": run_id, "error": str(exc)},
            )
            if item:
                results.append(item)
    return results

