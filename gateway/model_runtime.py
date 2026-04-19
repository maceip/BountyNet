from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import litellm

from gateway.agent_fleet import AgentServingProfile


_DOTENV_LOADED = False
_DEFAULT_LOGICAL_MODEL = "agents/default"
_DEFAULT_LOGICAL_FALLBACK = "agents/fallback"


def _load_root_env() -> None:
    global _DOTENV_LOADED
    if _DOTENV_LOADED:
        return
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if env_path.is_file():
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    _DOTENV_LOADED = True


def _env(name: str, default: str = "") -> str:
    _load_root_env()
    return (os.environ.get(name) or default).strip()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = _env(name)
    if not raw:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _env_json(name: str) -> dict[str, Any]:
    raw = _env(name)
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


@dataclass(frozen=True)
class RuntimeConfig:
    provider: str
    model: str
    resolved_model: str
    fallback_model: str
    resolved_fallback_model: str
    api_base: str
    api_key: str
    timeout_seconds: int
    reasoning_effort: str
    use_responses_api: bool
    extra_body: dict[str, Any]
    extra_headers: dict[str, str]


def default_runtime_config() -> RuntimeConfig:
    provider = _env("AGENT_RUNTIME_PROVIDER", "litellm")
    default_model = _DEFAULT_LOGICAL_MODEL
    default_fallback = _DEFAULT_LOGICAL_FALLBACK
    resolved_model = _resolve_model_alias(default_model, provider=provider)
    resolved_fallback_model = _resolve_model_alias(default_fallback, provider=provider)
    return RuntimeConfig(
        provider=provider,
        model=default_model,
        resolved_model=resolved_model,
        fallback_model=default_fallback,
        resolved_fallback_model=resolved_fallback_model,
        api_base=_env("AGENT_RUNTIME_API_BASE"),
        api_key=_key_for_model(resolved_model),
        timeout_seconds=_env_int("AGENT_RUNTIME_TIMEOUT_SECONDS", 120),
        reasoning_effort="",
        use_responses_api=_env_bool("AGENT_RUNTIME_USE_RESPONSES_API", False),
        extra_body=_env_json("AGENT_RUNTIME_EXTRA_BODY_JSON"),
        extra_headers={k: str(v) for k, v in _env_json("AGENT_RUNTIME_HEADERS_JSON").items()},
    )


def _resolve_model_alias(model: str, *, provider: str) -> str:
    mapping = _env_json("AGENT_RUNTIME_MODEL_MAP_JSON")
    if model in mapping and isinstance(mapping[model], str) and mapping[model].strip():
        return mapping[model].strip()
    # For LiteLLM proxy mode, keep logical model aliases (e.g. agents/default)
    # and let LiteLLM handle provider/model routing.
    if provider == "litellm":
        return model
    if model.startswith("agents/"):
        return _env("AGENT_RUNTIME_DEFAULT_HOSTED_MODEL", "anthropic/claude-sonnet-4-5")
    return model


def _key_for_model(model: str) -> str:
    explicit = _env("AGENT_RUNTIME_API_KEY")
    if explicit:
        return explicit
    if model.startswith("anthropic/"):
        return _env("ANTHROPIC_API_KEY")
    if model.startswith("openai/"):
        return _env("OPENAI_API_KEY")
    if model.startswith("gemini/"):
        return _env("GEMINI_API_KEY")
    return _env("OPENAI_API_KEY") or _env("ANTHROPIC_API_KEY") or _env("GEMINI_API_KEY")


def runtime_config_for_profile(profile: AgentServingProfile, *, agent_model: str = "") -> RuntimeConfig:
    base = default_runtime_config()
    provider = profile.runtime_provider or base.provider
    model = (agent_model or profile.runtime_model or base.model).strip()
    fallback_model = profile.runtime_fallback_model or base.fallback_model
    resolved_model = _resolve_model_alias(model, provider=provider)
    resolved_fallback_model = _resolve_model_alias(fallback_model, provider=provider)
    extra_body = dict(base.extra_body)
    extra_body.setdefault("metadata", {})
    metadata = extra_body["metadata"]
    if isinstance(metadata, dict):
        metadata.setdefault("agent_slug", profile.slug)
        metadata.setdefault("agent_adapter", profile.runtime_adapter)
        metadata.setdefault("agent_lane", profile.lane)
        metadata.setdefault("agent_pod", profile.pod)
        metadata.setdefault("kv_cache_window_seconds", _env_int("VLLM_KV_CACHE_WINDOW_SECONDS", 300))
        metadata.setdefault("context_floor_tokens", _env_int("AGENT_RUNTIME_CONTEXT_FLOOR_TOKENS", 262144))
    extra_headers = dict(base.extra_headers)
    agent_id_header = _env("VLLM_AGENT_ID_HEADER", "X-Agent-ID")
    if agent_id_header:
        # Layer-A -> Layer-B identity handoff for adapter routing.
        extra_headers.setdefault(agent_id_header, profile.runtime_adapter or profile.slug)
    return RuntimeConfig(
        provider=provider,
        model=model,
        resolved_model=resolved_model,
        fallback_model=fallback_model,
        resolved_fallback_model=resolved_fallback_model,
        api_base=base.api_base,
        api_key=_key_for_model(resolved_model),
        timeout_seconds=base.timeout_seconds,
        reasoning_effort=profile.reasoning_effort or base.reasoning_effort,
        use_responses_api=base.use_responses_api,
        extra_body=extra_body,
        extra_headers=extra_headers,
    )


def runtime_available(config: RuntimeConfig | None = None) -> bool:
    cfg = config or default_runtime_config()
    if cfg.provider == "litellm":
        return bool(cfg.resolved_model and cfg.api_base)
    return bool(cfg.resolved_model and cfg.api_key)


def runtime_summary(config: RuntimeConfig | None = None) -> dict[str, Any]:
    cfg = config or default_runtime_config()
    payload = asdict(cfg)
    payload["api_key"] = "***" if cfg.api_key else ""
    payload["configured"] = runtime_available(cfg)
    payload["has_api_key"] = bool(cfg.api_key)
    return payload


def _completion_kwargs(cfg: RuntimeConfig, messages: list[dict[str, str]]) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": cfg.resolved_model,
        "messages": messages,
        "temperature": 0.2,
        "timeout": cfg.timeout_seconds,
        "response_format": {"type": "json_object"},
        "extra_body": cfg.extra_body,
    }
    if cfg.api_key:
        kwargs["api_key"] = cfg.api_key
    if cfg.api_base:
        kwargs["api_base"] = cfg.api_base
    if cfg.extra_headers:
        kwargs["extra_headers"] = cfg.extra_headers
    if cfg.reasoning_effort:
        kwargs["reasoning_effort"] = cfg.reasoning_effort
    return kwargs


def complete_json(*, messages: list[dict[str, str]], config: RuntimeConfig | None = None) -> dict[str, Any]:
    cfg = config or default_runtime_config()
    if not runtime_available(cfg):
        raise RuntimeError("shared model runtime is not configured")

    kwargs = _completion_kwargs(cfg, messages)
    try:
        response = litellm.completion(**kwargs)
    except Exception:
        if not cfg.fallback_model or cfg.fallback_model == cfg.model:
            raise
        fallback_kwargs = dict(kwargs)
        fallback_kwargs["model"] = cfg.resolved_fallback_model
        response = litellm.completion(**fallback_kwargs)
        cfg = RuntimeConfig(
            provider=cfg.provider,
            model=cfg.fallback_model,
            resolved_model=cfg.resolved_fallback_model,
            fallback_model=cfg.fallback_model,
            resolved_fallback_model=cfg.resolved_fallback_model,
            api_base=cfg.api_base,
            api_key=_key_for_model(cfg.resolved_fallback_model),
            timeout_seconds=cfg.timeout_seconds,
            reasoning_effort=cfg.reasoning_effort,
            use_responses_api=cfg.use_responses_api,
            extra_body=cfg.extra_body,
            extra_headers=cfg.extra_headers,
        )
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
        "resolved_model": cfg.resolved_model,
        "fallback_model": cfg.fallback_model,
        "resolved_fallback_model": cfg.resolved_fallback_model,
        "raw": payload,
        "parsed": parsed,
        "tokens_in": int(usage.get("prompt_tokens") or 0),
        "tokens_out": int(usage.get("completion_tokens") or 0),
    }
