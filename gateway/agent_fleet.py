from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AgentServingProfile:
    slug: str
    display_name: str
    pod: str
    lane: str
    system_prompt: str
    allowed_tools: tuple[str, ...]
    allowed_files: tuple[str, ...]
    validator_recipe: tuple[str, ...]
    runtime_model: str
    runtime_fallback_model: str
    runtime_provider: str
    runtime_adapter: str
    reasoning_effort: str
    plan_required: bool


_DEFAULT_MODEL = "agents/default"
_DEFAULT_FALLBACK_MODEL = "agents/fallback"
_DEFAULT_PROVIDER = "litellm"


AGENT_SERVING_PROFILES: dict[str, AgentServingProfile] = {
    "ts-migrator": AgentServingProfile(
        slug="ts-migrator",
        display_name="TypeScript Migrator",
        pod="typescript",
        lane="migration",
        system_prompt="You are TypeScript Migrator. Your job is to produce narrow, mergeable TypeScript upgrade and migration changes. Prefer scoped config, workflow, and dependency upgrades. Do not widen scope. Explain why each touched file changed.",
        allowed_tools=("repo_context", "workflow_upgrade", "tsconfig_normalize", "package_json_update", "diff_summary"),
        allowed_files=("package.json", "tsconfig.json", "tsconfig.base.json", ".github/workflows/*.yml", ".github/workflows/*.yaml"),
        validator_recipe=("typecheck", "tests", "ci-policy"),
        runtime_model="agents/ts-migrator",
        runtime_fallback_model=_DEFAULT_FALLBACK_MODEL,
        runtime_provider=_DEFAULT_PROVIDER,
        runtime_adapter="ts-migrator",
        reasoning_effort="medium",
        plan_required=True,
    ),
    "ts-auditor": AgentServingProfile(
        slug="ts-auditor",
        display_name="TypeScript Auditor",
        pod="typescript",
        lane="security_audit",
        system_prompt="You are TypeScript Auditor. You review and patch actionable dependency and configuration security issues in TypeScript repositories. Prefer narrow, high-confidence fixes with explicit risk notes.",
        allowed_tools=("repo_context", "package_json_update", "tsconfig_normalize", "diff_summary"),
        allowed_files=("package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", ".github/workflows/*.yml", ".github/workflows/*.yaml"),
        validator_recipe=("audit", "typecheck", "tests"),
        runtime_model="agents/ts-auditor",
        runtime_fallback_model=_DEFAULT_FALLBACK_MODEL,
        runtime_provider=_DEFAULT_PROVIDER,
        runtime_adapter="ts-auditor",
        reasoning_effort="high",
        plan_required=True,
    ),
    "ts-architect": AgentServingProfile(
        slug="ts-architect",
        display_name="TypeScript Architect",
        pod="typescript",
        lane="architecture_refactor",
        system_prompt="You are TypeScript Architect. You identify and, when authorized, implement scoped architecture improvements that reduce maintenance drag. Prefer proposals first, then tightly scoped refactors.",
        allowed_tools=("repo_context", "opportunity_scan", "tsconfig_normalize", "diff_summary"),
        allowed_files=("tsconfig.json", "tsconfig.base.json", "src/**/*.ts", "src/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"),
        validator_recipe=("typecheck", "tests", "scope-check"),
        runtime_model="agents/ts-architect",
        runtime_fallback_model=_DEFAULT_FALLBACK_MODEL,
        runtime_provider=_DEFAULT_PROVIDER,
        runtime_adapter="ts-architect",
        reasoning_effort="high",
        plan_required=True,
    ),
    "rust-porter": AgentServingProfile(
        slug="rust-porter",
        display_name="Rust Porter",
        pod="rust",
        lane="porting",
        system_prompt="You are Rust Porter. You handle narrow Rust migration and dependency modernization work. Prefer idiomatic, minimal changes and explicitly note feature or crate compatibility assumptions.",
        allowed_tools=("repo_context", "cargo_update", "workflow_upgrade", "diff_summary"),
        allowed_files=("Cargo.toml", "Cargo.lock", ".github/workflows/*.yml", ".github/workflows/*.yaml", "src/**/*.rs"),
        validator_recipe=("cargo-check", "tests", "fmt"),
        runtime_model="agents/rust-porter",
        runtime_fallback_model=_DEFAULT_FALLBACK_MODEL,
        runtime_provider=_DEFAULT_PROVIDER,
        runtime_adapter="rust-porter",
        reasoning_effort="medium",
        plan_required=True,
    ),
    "rust-sentinel": AgentServingProfile(
        slug="rust-sentinel",
        display_name="Rust Sentinel",
        pod="rust",
        lane="security_patch",
        system_prompt="You are Rust Sentinel. You patch actionable Rust dependency and configuration security issues with high confidence and minimal blast radius. Prefer advisory-driven upgrades and clear evidence.",
        allowed_tools=("repo_context", "cargo_update", "diff_summary"),
        allowed_files=("Cargo.toml", "Cargo.lock", ".cargo/config.toml", ".github/workflows/*.yml", ".github/workflows/*.yaml"),
        validator_recipe=("cargo-check", "tests", "audit"),
        runtime_model="agents/rust-sentinel",
        runtime_fallback_model=_DEFAULT_FALLBACK_MODEL,
        runtime_provider=_DEFAULT_PROVIDER,
        runtime_adapter="rust-sentinel",
        reasoning_effort="high",
        plan_required=True,
    ),
    "rust-optimizer": AgentServingProfile(
        slug="rust-optimizer",
        display_name="Rust Optimizer",
        pod="rust",
        lane="performance_optimization",
        system_prompt="You are Rust Optimizer. You look for narrow, low-risk performance and maintainability improvements in Rust repos. Prefer scoped changes with a clear rationale and do not speculate.",
        allowed_tools=("repo_context", "opportunity_scan", "cargo_update", "diff_summary"),
        allowed_files=("Cargo.toml", "src/**/*.rs", "benches/**/*.rs"),
        validator_recipe=("cargo-check", "tests", "scope-check"),
        runtime_model="agents/rust-optimizer",
        runtime_fallback_model=_DEFAULT_FALLBACK_MODEL,
        runtime_provider=_DEFAULT_PROVIDER,
        runtime_adapter="rust-optimizer",
        reasoning_effort="medium",
        plan_required=True,
    ),
}


def get_serving_profile(slug: str) -> AgentServingProfile | None:
    return AGENT_SERVING_PROFILES.get(slug)
