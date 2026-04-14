from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def _update_text_file(path: Path, transform) -> bool:
    before = _read_text(path)
    after = transform(before)
    if after != before:
        _write_text(path, after)
        return True
    return False


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(_read_text(path))


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    _write_text(path, json.dumps(payload, indent=2, sort_keys=True) + "\n")


def _bump_github_actions(repo_path: Path, mode: str, logs: list[str], changed_files: list[str]) -> int:
    replacements = [
        (r"actions/checkout@v[1-3]\b", "actions/checkout@v4"),
        (r"actions/setup-node@v[1-3]\b", "actions/setup-node@v4"),
        (r"actions/setup-python@v[1-4]\b", "actions/setup-python@v5"),
        (r"actions/cache@v[1-3]\b", "actions/cache@v4"),
        (r"actions/upload-artifact@v[1-3]\b", "actions/upload-artifact@v4"),
        (r"actions/download-artifact@v[1-3]\b", "actions/download-artifact@v4"),
    ]
    workflows_dir = repo_path / ".github" / "workflows"
    if not workflows_dir.is_dir():
        logs.append("No .github/workflows directory found.")
        return 0

    updates = 0
    for path in sorted(workflows_dir.glob("*.y*ml")):
        before = _read_text(path)
        after = before
        for pattern, replacement in replacements:
            after = re.sub(pattern, replacement, after)
        if after != before:
            updates += 1
            logs.append(f"Updated workflow action versions in {path.relative_to(repo_path)}.")
            changed_files.append(path.relative_to(repo_path).as_posix())
            if mode == "apply":
                _write_text(path, after)
    if updates == 0:
        logs.append("No stale workflow action versions found.")
    return updates


def _fix_tsconfig(repo_path: Path, mode: str, logs: list[str], changed_files: list[str]) -> int:
    candidates = [
        repo_path / "tsconfig.json",
        repo_path / "tsconfig.base.json",
        repo_path / "tsconfig.build.json",
    ]
    updates = 0
    for path in candidates:
        if not path.is_file():
            continue
        payload = _load_json(path)
        compiler_options = payload.setdefault("compilerOptions", {})
        changed = False
        for key, value in {"skipLibCheck": True, "noEmit": True}.items():
            if compiler_options.get(key) != value:
                compiler_options[key] = value
                changed = True
        if changed:
            updates += 1
            logs.append(f"Normalized compiler options in {path.relative_to(repo_path)}.")
            changed_files.append(path.relative_to(repo_path).as_posix())
            if mode == "apply":
                _write_json(path, payload)
    if updates == 0:
        logs.append("No tsconfig normalization opportunities found.")
    return updates


def _update_package_json(
    repo_path: Path,
    package_name: str,
    target_version: str,
    mode: str,
    logs: list[str],
    changed_files: list[str],
) -> int:
    path = repo_path / "package.json"
    if not path.is_file():
        logs.append("No package.json found for dependency update.")
        return 0
    payload = _load_json(path)
    updates = 0
    for section in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        deps = payload.get(section) or {}
        if package_name in deps and deps[package_name] != target_version:
            deps[package_name] = target_version
            payload[section] = deps
            updates += 1
    if updates:
        logs.append(f"Updated {package_name} to {target_version} in package.json.")
        changed_files.append("package.json")
        if mode == "apply":
            _write_json(path, payload)
    else:
        logs.append(f"{package_name} not found or already set to {target_version}.")
    return updates


def _update_cargo_toml(
    repo_path: Path,
    crate_name: str,
    target_version: str,
    mode: str,
    logs: list[str],
    changed_files: list[str],
) -> int:
    path = repo_path / "Cargo.toml"
    if not path.is_file():
        logs.append("No Cargo.toml found for dependency update.")
        return 0
    before = _read_text(path)
    after = before
    patterns = [
        (
            rf'(^\s*{re.escape(crate_name)}\s*=\s*")([^"]+)(".*$)',
            rf'\g<1>{target_version}\g<3>',
        ),
        (
            rf'(^\s*{re.escape(crate_name)}\s*=\s*\{{[^}}]*version\s*=\s*")([^"]+)(")',
            rf'\g<1>{target_version}\g<3>',
        ),
    ]
    for pattern, replacement in patterns:
        after = re.sub(pattern, replacement, after, flags=re.MULTILINE)
    if after != before:
        logs.append(f"Updated {crate_name} to {target_version} in Cargo.toml.")
        changed_files.append("Cargo.toml")
        if mode == "apply":
            _write_text(path, after)
        return 1
    logs.append(f"{crate_name} not found or already set to {target_version}.")
    return 0


def discover_repo_opportunities(*, repo_path: str) -> list[dict[str, Any]]:
    workspace = Path(repo_path).expanduser().resolve()
    if not workspace.is_dir():
        raise FileNotFoundError(f"Repository path does not exist: {workspace}")

    opportunities: list[dict[str, Any]] = []

    workflows_dir = workspace / ".github" / "workflows"
    if workflows_dir.is_dir():
        stale_actions: list[str] = []
        for path in sorted(workflows_dir.glob("*.y*ml")):
            text = _read_text(path)
            if re.search(r"actions/(checkout|setup-node|setup-python|cache|upload-artifact|download-artifact)@v[1-3]\b", text):
                stale_actions.append(path.relative_to(workspace).as_posix())
        if stale_actions:
            opportunities.append(
                {
                    "opportunity_type": "upgrade",
                    "title": "Upgrade stale GitHub Actions workflow dependencies",
                    "summary": "Workflow files still pin older action major versions and are good candidates for a narrow upgrade PR.",
                    "pod": "github_actions",
                    "lane": "workflow_repair",
                    "severity": "medium",
                    "confidence": 0.84,
                    "files": stale_actions,
                    "evidence": {"stale_workflows": stale_actions},
                }
            )

    package_json = workspace / "package.json"
    if package_json.is_file():
        payload = _load_json(package_json)
        deps = payload.get("dependencies") or {}
        dev_deps = payload.get("devDependencies") or {}
        stale_ts_files = []
        if "typescript" in deps or "typescript" in dev_deps:
            version = deps.get("typescript") or dev_deps.get("typescript") or ""
            if "5" not in version:
                stale_ts_files.append("package.json")
        if stale_ts_files:
            opportunities.append(
                {
                    "opportunity_type": "upgrade",
                    "title": "TypeScript runtime/tooling looks behind current major",
                    "summary": "The repository appears to pin an older TypeScript version and is a good upgrade candidate.",
                    "pod": "typescript",
                    "lane": "migration",
                    "severity": "medium",
                    "confidence": 0.72,
                    "files": stale_ts_files,
                    "evidence": {"package": "typescript", "current_version": version},
                }
            )

    tsconfig = workspace / "tsconfig.json"
    if tsconfig.is_file():
        payload = _load_json(tsconfig)
        compiler_options = payload.get("compilerOptions") or {}
        missing = [key for key in ("skipLibCheck", "noEmit") if compiler_options.get(key) is not True]
        if missing:
            opportunities.append(
                {
                    "opportunity_type": "architecture",
                    "title": "Tighten TypeScript compiler boundary for safer maintenance",
                    "summary": "The repository is missing a few compiler options that reduce maintenance noise and improve upgrade safety.",
                    "pod": "typescript",
                    "lane": "architecture_refactor",
                    "severity": "low",
                    "confidence": 0.69,
                    "files": ["tsconfig.json"],
                    "evidence": {"missing_compiler_options": missing},
                }
            )

    cargo_toml = workspace / "Cargo.toml"
    if cargo_toml.is_file():
        text = _read_text(cargo_toml)
        if re.search(r'^\s*tokio\s*=\s*"(0|1\.[0-9]{1,2})', text, flags=re.MULTILINE):
            opportunities.append(
                {
                    "opportunity_type": "architecture",
                    "title": "Review async/runtime dependency layout",
                    "summary": "The Rust dependency surface suggests an opportunity to review runtime feature use and simplify async boundaries.",
                    "pod": "rust",
                    "lane": "architecture_refactor",
                    "severity": "low",
                    "confidence": 0.53,
                    "files": ["Cargo.toml"],
                    "evidence": {"signal": "tokio dependency present"},
                }
            )

    return opportunities


def execute_managed_job(
    *,
    repo_path: str,
    job: dict[str, Any],
    agent: dict[str, Any],
    mode: str = "apply",
) -> dict[str, Any]:
    workspace = Path(repo_path).expanduser().resolve()
    if not workspace.is_dir():
        raise FileNotFoundError(f"Repository path does not exist: {workspace}")

    metadata = job.get("metadata") or {}
    logs: list[str] = [f"Running {agent.get('slug')} against {workspace} in {mode} mode."]
    changed_files: list[str] = []
    changes = 0

    package_name = (metadata.get("package") or "").strip()
    target_version = (metadata.get("target_version") or "").strip()
    crate_name = (metadata.get("crate") or package_name).strip()
    pod = (metadata.get("pod") or agent.get("pod") or "").strip()
    lane = (metadata.get("lane") or agent.get("lane") or "").strip()
    job_class = (job.get("job_class") or "").strip()

    if job_class in {"ci_repair", "config_remediation"} or lane in {"migration", "workflow_repair"}:
        changes += _bump_github_actions(workspace, mode, logs, changed_files)

    if pod == "typescript" or lane in {"migration", "architecture_refactor"} or job_class in {
        "type_repair",
        "lint_cleanup",
        "test_repair",
    }:
        changes += _fix_tsconfig(workspace, mode, logs, changed_files)

    if job_class in {"dependency_update", "security_update"} and package_name and target_version:
        if pod == "rust" or (workspace / "Cargo.toml").is_file():
            changes += _update_cargo_toml(workspace, crate_name, target_version, mode, logs, changed_files)
        else:
            changes += _update_package_json(workspace, package_name, target_version, mode, logs, changed_files)

    if changes == 0 and job_class == "ci_repair":
        changes += _fix_tsconfig(workspace, mode, logs, changed_files)

    changed_files = sorted(set(changed_files))
    summary = f"{agent.get('display_name')} produced {len(changed_files)} file change(s)." if changed_files else (
        f"{agent.get('display_name')} found no safe deterministic change to apply."
    )

    evidence = {
        "repo_path": str(workspace),
        "job_class": job_class,
        "pod": pod,
        "lane": lane,
        "changed_files": changed_files,
        "changes_applied": bool(changed_files),
        "mode": mode,
    }
    return {
        "summary": summary,
        "logs": logs,
        "changed_files": changed_files,
        "evidence": evidence,
        "diff_summary": "; ".join(logs[1:]) if len(logs) > 1 else summary,
    }
