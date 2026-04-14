from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import litellm


@dataclass(frozen=True)
class RuntimeConfig:
    provider: str
    model: str
    api_base: str
    api_key: str


def default_runtime_config() -> RuntimeConfig:
    return RuntimeConfig(
        provider=(os.environ.get("AGENT_RUNTIME_PROVIDER") or "openai_compatible").strip(),
        model=(os.environ.get("AGENT_RUNTIME_MODEL") or "mistral-small").strip(),
        api_base=(os.environ.get("AGENT_RUNTIME_API_BASE") or "").strip(),
        api_key=(os.environ.get("AGENT_RUNTIME_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip(),
    )


def runtime_available(config: RuntimeConfig | None = None) -> bool:
    cfg = config or default_runtime_config()
    return bool(cfg.model and cfg.api_key)


def complete_json(*, messages: list[dict[str, str]], config: RuntimeConfig | None = None) -> dict[str, Any]:
    cfg = config or default_runtime_config()
    if not runtime_available(cfg):
        raise RuntimeError("shared model runtime is not configured")

    kwargs: dict[str, Any] = {
        "model": cfg.model,
        "messages": messages,
        "api_key": cfg.api_key,
        "temperature": 0.2,
    }
    if cfg.api_base:
        kwargs["api_base"] = cfg.api_base
    response = litellm.completion(**kwargs)
    payload = response.model_dump()
    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {"raw_content": content}
    usage = payload.get("usage", {}) or {}
    return {
        "provider": cfg.provider,
        "model": cfg.model,
        "raw": payload,
        "parsed": parsed,
        "tokens_in": int(usage.get("prompt_tokens") or 0),
        "tokens_out": int(usage.get("completion_tokens") or 0),
    }
