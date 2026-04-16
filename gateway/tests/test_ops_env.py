from __future__ import annotations

from pathlib import Path

from gateway.ops_env import apply_do_token_aliases
from gateway import ops_executor


def test_apply_do_token_aliases_prefers_explicit_tf_var():
    env = {
        "TF_VAR_do_token": "already-set",
        "DIGITAL_OCEAN_TOKEN": "primary",
        "DIGITALOCEAN_TOKEN": "legacy",
    }
    apply_do_token_aliases(env)
    assert env["TF_VAR_do_token"] == "already-set"


def test_apply_do_token_aliases_supports_legacy_names():
    env = {"DIGITALOCEAN_TOKEN": "legacy-token"}
    apply_do_token_aliases(env)
    assert env["TF_VAR_do_token"] == "legacy-token"


def test_terraform_command_blocks_apply_without_arming(monkeypatch):
    monkeypatch.delenv("MARKET_OPS_TERRAFORM_ARMED", raising=False)
    action = {"execution_mode": "apply", "action": "start"}
    try:
        ops_executor._terraform_command(Path("."), action)
        raised = False
    except RuntimeError as exc:
        raised = "MARKET_OPS_TERRAFORM_ARMED" in str(exc)
    assert raised


def test_terraform_command_allows_apply_when_armed(monkeypatch):
    monkeypatch.setenv("MARKET_OPS_TERRAFORM_ARMED", "1")
    action = {"execution_mode": "apply", "action": "start"}
    cmd = ops_executor._terraform_command(Path("infra"), action)
    assert "apply" in cmd
    assert "-auto-approve" in cmd
