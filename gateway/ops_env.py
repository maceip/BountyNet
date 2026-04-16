from __future__ import annotations

from pathlib import Path


def truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def apply_do_token_aliases(env: dict[str, str]) -> None:
    if env.get("TF_VAR_do_token"):
        return
    for key in ("DIGITAL_OCEAN_TOKEN", "DIGITALOCEAN_TOKEN", "DIGITALOCEAN_ACCESS_TOKEN"):
        value = (env.get(key) or "").strip()
        if value:
            env["TF_VAR_do_token"] = value
            return
