"""
SimBountyNet Agent — autonomous solver that exercises the full pipeline (HTTP/API).

Browser automation for the same persona lives in `sim/sim_solver.py`.

One script, one agent_id. Run N instances for a fleet.
Rep accumulates on the agent's EIP-8004 NFT metadata.

Modes:
  --honest     Tries to actually fix the CI failure (default)
  --hallucinate  Submits plausible but wrong fixes (tests failure path)
  --malicious  Tries to game the system (adversarial testing)

Honest mode tries fixes in order: **Cursor Cloud Agents** (`CURSOR_API_KEY`), then
Anthropic (gateway bearer token from claim, or `ANTHROPIC_API_KEY` direct).

Usage:
  python sim/agent.py                          # honest solver
  python sim/agent.py --hallucinate            # bad solver
  python sim/agent.py --malicious              # adversarial
  python sim/agent.py --repo maceip/freehold-relay --once
"""
import os
import sys
import base64
import json
import time
import argparse
import logging
import requests
import subprocess
import tempfile
import shutil
import random
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [agent] %(message)s")
log = logging.getLogger("agent")

GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
AGENT_CONFIG = Path.home() / ".bountynet" / "agent.json"


# ── Config ─────────────────────────────────────────────────────

def load_or_register(gateway: str, name: str = "") -> dict:
    if AGENT_CONFIG.exists():
        config = json.loads(AGENT_CONFIG.read_text())
        log.info("agent #%s wallet=%s", config["agent_id"], config["wallet"])
        return config

    resp = requests.post(
        f"{gateway}/identity/onboard",
        json={"external_id": f"sim:{name or 'agent'}-{int(time.time())}"},
        timeout=15,
    )
    data = resp.json()
    config = {
        "agent_id": data.get("agent_id", 0),
        "wallet": data.get("wallet", ""),
        "ens": data.get("ens", ""),
        "token": data.get("token", ""),
        "gateway": gateway,
    }
    AGENT_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    AGENT_CONFIG.write_text(json.dumps(config, indent=2))
    AGENT_CONFIG.chmod(0o600)
    log.info("registered agent #%s", config["agent_id"])
    return config


# ── Bounty Ops ─────────────────────────────────────────────────

def poll(gateway: str, repo_filter: str = "") -> list:
    try:
        resp = requests.get(f"{gateway}/bounties?status=all&limit=20", timeout=10)
        bounties = resp.json().get("bounties", [])
        claimable = [b for b in bounties if b.get("claimable")]
        if repo_filter:
            claimable = [b for b in claimable if repo_filter in b.get("repo", "")]
        return claimable
    except Exception as e:
        log.error("poll: %s", e)
        return []


def claim(gateway: str, ctx: str, agent_id: int) -> dict | None:
    try:
        r = requests.post(f"{gateway}/bounties/{ctx}/claim", json={"agent_id": agent_id}, timeout=15)
        d = r.json()
        if d.get("error"):
            log.warning("claim rejected: %s", d["error"])
            return None
        log.info("claimed %s", ctx[:16])
        return d
    except Exception as e:
        log.error("claim: %s", e)
        return None


def submit_pr(gateway: str, repo: str, ctx: str, agent_id: int, files: list, title: str) -> dict | None:
    try:
        r = requests.post(f"{gateway}/github/submit-pr", json={
            "repo": repo, "context_hash": ctx, "agent_id": agent_id,
            "title": title, "body": f"SimBountyNet agent #{agent_id}", "files": files,
        }, timeout=30)
        d = r.json()
        if d.get("error"):
            log.error("submit: %s", d["error"])
            return None
        log.info("PR: %s", d.get("pr_url", "?"))
        return d
    except Exception as e:
        log.error("submit: %s", e)
        return None


# ── Repo Analysis ─────────────────────────────────────────────

def clone_repo(repo: str) -> str | None:
    d = tempfile.mkdtemp(prefix="sim-")
    try:
        subprocess.run(["git", "clone", "--depth", "1", f"https://github.com/{repo}.git", d],
                       capture_output=True, timeout=60)
        return d
    except Exception:
        shutil.rmtree(d, ignore_errors=True)
        return None


def read_context(repo_path: str) -> str:
    """Collect CI configs + manifest files + README for the LLM."""
    parts: list[str] = []
    for wf_dir in [".github/workflows", ".circleci", ".gitlab-ci.yml"]:
        wf_path = Path(repo_path) / wf_dir
        if wf_path.is_dir():
            for f in list(wf_path.glob("*.yml")) + list(wf_path.glob("*.yaml")):
                parts.append(f"=== {f.name} ===\n{f.read_text()[:2000]}")
        elif wf_path.is_file():
            parts.append(f"=== {wf_dir} ===\n{wf_path.read_text()[:2000]}")
    for config in ["package.json", "Cargo.toml", "pyproject.toml", "requirements.txt", "Makefile"]:
        p = Path(repo_path) / config
        if p.exists():
            parts.append(f"=== {config} ===\n{p.read_text()[:1500]}")
    for readme in ["README.md", "readme.md", "README"]:
        p = Path(repo_path) / readme
        if p.exists():
            parts.append(f"=== README ===\n{p.read_text()[:1500]}")
            break
    return "\n\n".join(parts) if parts else "No project files found."


def get_ci_error(gateway: str, repo: str, context_hash: str, bounty: dict) -> str:
    try:
        r = requests.get(f"{gateway}/bounties/{context_hash}", timeout=10)
        data = r.json()
        check_name = data.get("check_name", "CI")
        return f"CI check '{check_name}' failed on {repo}. Fix the build."
    except Exception:
        check_name = bounty.get("check_name", "CI")
        return f"{check_name} failed on {repo}. Diagnose and fix the build error."


def generate_fix_cursor(repo: str, ci_error: str, repo_context: str) -> list[dict] | None:
    api_key = os.environ.get("CURSOR_API_KEY", "")
    if not api_key:
        return None
    try:
        auth = base64.b64encode(f"{api_key}:".encode()).decode()
        r = requests.post(
            "https://api.cursor.com/cloud-agents",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/json",
            },
            json={
                "repo": f"https://github.com/{repo}",
                "prompt": f"Fix this CI failure:\n{ci_error}\n\nProject context:\n{repo_context[:3000]}",
            },
            timeout=300,
        )
        if r.status_code != 200:
            log.warning("Cursor API returned %s", r.status_code)
            return None
        data = r.json()
        changes = data.get("changes", [])
        if not changes:
            return None
        log.info("Cursor agent returned %d file change(s)", len(changes))
        return [{"path": c["path"], "content": c["content"]} for c in changes]
    except Exception as e:
        log.error("Cursor: %s", e)
        return None


def find_source_files(repo_path: str) -> list[Path]:
    files = []
    for ext in ["py", "js", "ts", "rs", "go", "java", "rb"]:
        files.extend(Path(repo_path).rglob(f"*.{ext}"))
    return files


# ── Fix Strategies ────────────────────────────────────────────

def fix_honest(repo: str, repo_path: str, ci_error: str, bnet_token: str, gateway: str) -> list[dict] | None:
    """Call LLM to generate a real fix (Cursor first, then Anthropic)."""
    context = read_context(repo_path)
    cursor_files = generate_fix_cursor(repo, ci_error, context)
    if cursor_files:
        return cursor_files

    api_key = bnet_token or os.environ.get("ANTHROPIC_API_KEY", "")
    base_url = f"{gateway}/v1" if bnet_token else "https://api.anthropic.com/v1"

    if not api_key:
        log.warning("no API key, falling back to hallucinate")
        return None

    prompt = f"""Fix this CI failure. Repository: {repo}
Error: {ci_error}
Context:
{context[:4000]}

Return ONLY a JSON array: [{{"path": "file/path", "content": "full content"}}]"""

    try:
        headers = {"Content-Type": "application/json"}
        if bnet_token:
            headers["Authorization"] = f"Bearer {bnet_token}"
        else:
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"

        r = requests.post(f"{base_url}/messages", headers=headers, json={
            "model": "claude-sonnet-4-20250514", "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }, timeout=120)

        data = r.json()
        content = ""
        if "content" in data:
            for block in data["content"]:
                if block.get("type") == "text":
                    content = block["text"]
        elif "choices" in data:
            content = data["choices"][0].get("message", {}).get("content", "")

        if content:
            import re
            m = re.search(r'\[.*\]', content, re.DOTALL)
            if m:
                files = json.loads(m.group())
                if isinstance(files, list) and files:
                    return files
    except Exception as e:
        log.error("LLM: %s", e)

    return None


def fix_hallucinate(repo_path: str) -> list[dict]:
    """Plausible but wrong fix."""
    log.info("hallucinating a fix")
    sources = find_source_files(repo_path)
    if sources:
        target = random.choice(sources[:10])
        rel = str(target.relative_to(repo_path))
        content = target.read_text()
        # Add a useless comment that won't fix anything
        lines = content.split("\n")
        insert_at = random.randint(0, max(0, len(lines) - 1))
        comment = {
            "py": "# BountyNet: automated fix attempt",
            "js": "// BountyNet: automated fix attempt",
            "ts": "// BountyNet: automated fix attempt",
            "rs": "// BountyNet: automated fix attempt",
            "go": "// BountyNet: automated fix attempt",
        }.get(target.suffix.lstrip("."), "# BountyNet: automated fix attempt")
        lines.insert(insert_at, comment)
        return [{"path": rel, "content": "\n".join(lines)}]

    return [{"path": "BOUNTYNET_FIX.md", "content": "Solver could not determine fix."}]


def fix_malicious(repo_path: str) -> list[dict]:
    """Malicious payloads — tests system defenses."""
    log.info("generating malicious fix")
    attack = random.choice([
        # 1. Try to add env exfiltration to CI
        [{"path": ".github/workflows/bountynet-fix.yml", "content": """name: verify-fix
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "running tests"
      # Malicious: tries to read secrets (should be masked by GitHub)
      - run: echo $GITHUB_TOKEN | head -c 5
"""}],
        # 2. Try to modify a test to always pass
        [{"path": "tests/test_always_pass.py", "content": """def test_always_pass():
    assert True  # BountyNet: skip actual tests
"""}],
        # 3. Try to add a dependency with a known typosquat pattern
        [{"path": "requirements-bountynet.txt", "content": "requests\ncoloramma\n"}],
        # 4. Inject a postinstall script
        [{"path": "scripts/bountynet-verify.sh", "content": "#!/bin/bash\necho verified\ncurl -s https://httpbin.org/get > /dev/null\n"}],
        # 5. Submit an empty fix (waste CI time)
        [{"path": "BOUNTYNET_EMPTY_FIX.md", "content": "This file intentionally left blank."}],
    ])
    return attack


# ── Solve Loop ────────────────────────────────────────────────

def solve(gateway: str, agent_id: int, bounty: dict, mode: str) -> bool:
    ctx = bounty.get("context_hash", "")
    repo = bounty.get("repo", "")
    log.info("--- %s: %s %s", mode, repo, ctx[:16])

    # Claim
    c = claim(gateway, ctx, agent_id)
    if not c:
        return False

    bnet_token = c.get("bnet_token", "")
    ci_error = get_ci_error(gateway, repo, ctx, bounty)

    # Clone
    repo_path = clone_repo(repo)
    if not repo_path:
        # Can't clone — submit without context
        files = fix_hallucinate("/tmp") if mode != "malicious" else fix_malicious("/tmp")
        submit_pr(gateway, repo, ctx, agent_id, files, f"fix: agent #{agent_id} patch")
        return True

    try:
        files = None

        if mode == "honest":
            files = fix_honest(repo, repo_path, ci_error, bnet_token, gateway)
            if not files:
                files = fix_hallucinate(repo_path)
        elif mode == "hallucinate":
            files = fix_hallucinate(repo_path)
        elif mode == "malicious":
            files = fix_malicious(repo_path)

        title = {
            "honest": f"fix: BountyNet agent #{agent_id} automated patch",
            "hallucinate": f"fix: BountyNet agent #{agent_id} attempted fix",
            "malicious": f"fix: BountyNet agent #{agent_id} verification patch",
        }[mode]

        return submit_pr(gateway, repo, ctx, agent_id, files or [], title) is not None

    finally:
        shutil.rmtree(repo_path, ignore_errors=True)


def main():
    p = argparse.ArgumentParser(description="SimBountyNet Agent")
    p.add_argument("--gateway", default=GATEWAY)
    p.add_argument("--repo", help="filter by repo")
    p.add_argument("--once", action="store_true")
    p.add_argument("--honest", action="store_true", default=True)
    p.add_argument("--hallucinate", action="store_true")
    p.add_argument("--malicious", action="store_true")
    p.add_argument("--interval", type=int, default=15)
    p.add_argument("--name", default="", help="agent name for registration")
    args = p.parse_args()

    mode = "malicious" if args.malicious else "hallucinate" if args.hallucinate else "honest"
    config = load_or_register(args.gateway, args.name)
    agent_id = config["agent_id"]

    log.info("SimBountyNet agent #%s mode=%s repo=%s", agent_id, mode, args.repo or "all")

    stats = {"attempted": 0, "submitted": 0}

    while True:
        bounties = poll(args.gateway, args.repo or "")
        if bounties:
            log.info("%d claimable", len(bounties))
            for b in bounties:
                stats["attempted"] += 1
                if solve(args.gateway, agent_id, b, mode):
                    stats["submitted"] += 1
                if args.once:
                    break
        else:
            log.info("no bounties (attempted=%d submitted=%d)", stats["attempted"], stats["submitted"])

        if args.once:
            break
        time.sleep(args.interval)

    log.info("done: %s", stats)


if __name__ == "__main__":
    main()
