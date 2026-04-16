from __future__ import annotations

import os
import shlex
import subprocess
import time
import uuid
from pathlib import Path

from gateway import store
from gateway.ops_env import apply_do_token_aliases, load_env_file, truthy

_STOP_ACTIONS = {"stop", "disable", "scale_down"}

_COMPONENT_MODULES = {
    "edge_digitalocean_gateways": "digitalocean-regional-lbs",
    "global_aws_accelerator": "aws-global-accelerator",
    "global_do_dns": "digitalocean-global-dns",
    "global_do_primary_backup_lb": "digitalocean-global-lb",
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


def _desired_state_for_action(action: str) -> str:
    if action in _STOP_ACTIONS:
        return "stopped"
    return "running"


def _terraform_command(module_path: Path, action: dict) -> list[str]:
    mode = (action.get("execution_mode") or "dry_run").strip()
    op = (action.get("action") or "").strip().lower()
    tf = _terraform_exe()
    if mode == "dry_run":
        return [tf, f"-chdir={module_path}", "plan", "-input=false", "-no-color"]
    if not truthy(os.getenv("MARKET_OPS_TERRAFORM_ARMED")):
        raise RuntimeError("blocked non-dry-run terraform execution (set MARKET_OPS_TERRAFORM_ARMED=1)")
    if op in _STOP_ACTIONS:
        return [tf, f"-chdir={module_path}", "destroy", "-auto-approve", "-input=false", "-no-color"]
    return [tf, f"-chdir={module_path}", "apply", "-auto-approve", "-input=false", "-no-color"]


def execute_next_action() -> dict | None:
    action = store.market_ops_component_action_next_approved()
    if not action:
        return None
    action_id = action["id"]
    started_at = time.time()
    store.market_ops_component_action_update(action_id, status="executing", started_at=started_at)

    module_name = _COMPONENT_MODULES.get(action["component_id"], "")
    module_path = _infra_root() / "terraform" / module_name if module_name else Path()
    if not module_name or not module_path.is_dir():
        err = f"missing terraform module for component={action['component_id']} module={module_name}"
        finished = store.market_ops_component_action_update(
            action_id,
            status="failed",
            finished_at=time.time(),
            error_trace=err,
        )
        store.market_ops_alert_create(
            alert_id=f"ops_alert_{uuid.uuid4().hex[:12]}",
            alert_type="component_action_failed",
            severity="critical",
            source="ops_executor",
            message=err,
            metadata={"action_id": action_id},
        )
        return finished

    env = os.environ.copy()
    env_file = Path((os.getenv("MARKET_INFRA_ENV_FILE") or str(Path.cwd() / ".env.infra.txt")).strip())
    env.update(load_env_file(env_file))
    apply_do_token_aliases(env)

    cmd = _terraform_command(module_path, action)
    command_trace = " ".join(shlex.quote(part) for part in cmd)
    try:
        result = subprocess.run(
            cmd,
            env=env,
            text=True,
            capture_output=True,
            timeout=max(60, int(os.getenv("MARKET_OPS_EXECUTOR_TIMEOUT_SEC", "1200"))),
            check=False,
        )
        command_trace = f"{command_trace}\n{(result.stdout or '').strip()}"
        error_trace = (result.stderr or "").strip()
        if result.returncode == 0:
            desired = _desired_state_for_action(action["action"])
            store.market_ops_component_state_set(
                component_id=action["component_id"],
                desired_state=desired,
                last_action=action["action"],
                updated_by=(action.get("approved_by") or action.get("requested_by") or "ops_executor"),
                notes=action.get("notes") or "",
                metadata={"last_action_id": action_id, "last_execution_mode": action.get("execution_mode", "dry_run")},
            )
            return store.market_ops_component_action_update(
                action_id,
                status="succeeded",
                finished_at=time.time(),
                command_trace=command_trace,
                error_trace=error_trace,
            )
        store.market_ops_alert_create(
            alert_id=f"ops_alert_{uuid.uuid4().hex[:12]}",
            alert_type="component_action_failed",
            severity="critical",
            source="ops_executor",
            message=f"action {action_id} failed with exit_code={result.returncode}",
            metadata={"action_id": action_id, "exit_code": result.returncode},
        )
        return store.market_ops_component_action_update(
            action_id,
            status="failed",
            finished_at=time.time(),
            command_trace=command_trace,
            error_trace=error_trace,
        )
    except Exception as exc:
        return store.market_ops_component_action_update(
            action_id,
            status="failed",
            finished_at=time.time(),
            command_trace=command_trace,
            error_trace=str(exc),
        )

