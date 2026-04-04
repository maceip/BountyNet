"""
SimBountyNet — Automated Vishy (solver agent).

Exercises the full BountyNet pipeline:
  1. Register as agent (or load existing config)
  2. Poll for claimable bounties
  3. Clone the failing repo, read CI error logs
  4. Call LLM to generate a fix
  5. Submit fix via POST /github/submit-pr
  6. Wait for CI result → payout or retry

Supports multiple LLM backends:
  - Cursor Cloud Agents API (preferred, 60k credits)
  - Anthropic API (via gateway inference proxy, dogfood mode)
  - OpenAI API (fallback)

Usage:
  python sim/vishy.py --gateway https://gateway.stare.network
  python sim/vishy.py --once  # single bounty, then exit
  python sim/vishy.py --repo maceip/freehold-relay  # target specific repo
"""
import os
import sys
import json
import time
import argparse
import logging
import requests
import subprocess
import tempfile
import shutil
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [vishy] %(message)s",
)
log = logging.getLogger("vishy")

GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
AGENT_CONFIG = Path.home() / ".bountynet" / "agent.json"


# ── Agent Config ───────────────────────────────────────────────

def load_or_register(gateway: str) -> dict:
    """Load existing agent config or register a new one."""
    if AGENT_CONFIG.exists():
        config = json.loads(AGENT_CONFIG.read_text())
        log.info("loaded agent #%s (wallet: %s)", config["agent_id"], config["wallet"])
        return config

    log.info("no agent config found, registering via gateway...")
    resp = requests.post(
        f"{gateway}/identity/onboard",
        json={"external_id": f"sim:vishy-{int(time.time())}"},
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


# ── Bounty Discovery ──────────────────────────────────────────

def find_bounties(gateway: str, repo_filter: str | None = None) -> list:
    """Poll gateway for claimable bounties."""
    try:
        resp = requests.get(f"{gateway}/bounties?status=all&limit=20", timeout=10)
        data = resp.json()
        bounties = data.get("bounties", [])

        claimable = [b for b in bounties if b.get("claimable")]

        if repo_filter:
            claimable = [b for b in claimable if repo_filter in b.get("repo", "")]

        return claimable
    except Exception as e:
        log.error("poll failed: %s", e)
        return []


def claim_bounty(gateway: str, context_hash: str, agent_id: int) -> dict | None:
    """Claim a bounty, get bnet_token."""
    try:
        resp = requests.post(
            f"{gateway}/bounties/{context_hash}/claim",
            json={"agent_id": agent_id},
            timeout=15,
        )
        data = resp.json()
        if data.get("error"):
            log.warning("claim failed: %s", data["error"])
            return None
        log.info("claimed! token=%s", data.get("bnet_token", "?")[:30])
        return data
    except Exception as e:
        log.error("claim error: %s", e)
        return None


# ── Repo Analysis ─────────────────────────────────────────────

def clone_repo(repo: str, sha: str = "") -> str | None:
    """Clone a repo to a temp dir. Returns path or None."""
    tmpdir = tempfile.mkdtemp(prefix="vishy-")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", f"https://github.com/{repo}.git", tmpdir],
            capture_output=True, timeout=60,
        )
        log.info("cloned %s to %s", repo, tmpdir)
        return tmpdir
    except Exception as e:
        log.error("clone failed: %s", e)
        shutil.rmtree(tmpdir, ignore_errors=True)
        return None


def get_ci_error(gateway: str, repo: str, context_hash: str) -> str:
    """Try to get CI error context. Falls back to generic."""
    # Try the bounty detail for metadata
    try:
        resp = requests.get(f"{gateway}/bounties/{context_hash}", timeout=10)
        data = resp.json()
        check_name = data.get("check_name", "CI")
        return f"CI check '{check_name}' failed on {repo}. Fix the build."
    except Exception:
        return f"CI failed on {repo}. Diagnose and fix the build error."


def analyze_repo(repo_path: str) -> str:
    """Read key files to build context for the LLM."""
    context_parts = []

    # Read CI config
    for wf_dir in [".github/workflows", ".circleci", ".gitlab-ci.yml"]:
        wf_path = Path(repo_path) / wf_dir
        if wf_path.exists():
            if wf_path.is_dir():
                for f in wf_path.glob("*.yml"):
                    context_parts.append(f"=== {f.name} ===\n{f.read_text()[:2000]}")
                for f in wf_path.glob("*.yaml"):
                    context_parts.append(f"=== {f.name} ===\n{f.read_text()[:2000]}")
            else:
                context_parts.append(f"=== {wf_dir} ===\n{wf_path.read_text()[:2000]}")

    # Read package.json, Cargo.toml, pyproject.toml, etc.
    for config in ["package.json", "Cargo.toml", "pyproject.toml", "requirements.txt", "Makefile"]:
        p = Path(repo_path) / config
        if p.exists():
            context_parts.append(f"=== {config} ===\n{p.read_text()[:1500]}")

    # Read README for context
    for readme in ["README.md", "readme.md", "README"]:
        p = Path(repo_path) / readme
        if p.exists():
            context_parts.append(f"=== README ===\n{p.read_text()[:1500]}")
            break

    return "\n\n".join(context_parts) if context_parts else "No project files found."


# ── LLM Fix Generation ───────────────────────────────────────

def generate_fix_anthropic(repo: str, ci_error: str, repo_context: str, bnet_token: str = "", gateway: str = "") -> list[dict] | None:
    """Generate a fix using Anthropic API (via gateway or direct)."""
    api_key = bnet_token or os.environ.get("ANTHROPIC_API_KEY", "")
    base_url = f"{gateway}/v1" if bnet_token else "https://api.anthropic.com/v1"

    if not api_key:
        return None

    prompt = f"""You are a solver agent fixing a CI failure.

Repository: {repo}
Error: {ci_error}

Project context:
{repo_context[:4000]}

Generate a fix. Return ONLY a JSON array of file changes:
[{{"path": "relative/path/to/file", "content": "full file content"}}]

If you can't determine the fix, make your best guess. Return valid JSON only."""

    try:
        headers = {"Content-Type": "application/json"}
        if bnet_token:
            headers["Authorization"] = f"Bearer {bnet_token}"
        else:
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"

        resp = requests.post(
            f"{base_url}/messages",
            headers=headers,
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=120,
        )

        data = resp.json()

        # Extract content
        content = ""
        if "content" in data:
            for block in data["content"]:
                if block.get("type") == "text":
                    content = block["text"]
        elif "choices" in data:
            content = data["choices"][0].get("message", {}).get("content", "")

        # Parse JSON from response
        if content:
            # Try to extract JSON array from the response
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                files = json.loads(json_match.group())
                if isinstance(files, list) and all("path" in f and "content" in f for f in files):
                    log.info("LLM generated %d file changes", len(files))
                    return files

        log.warning("LLM response didn't contain valid file changes")
        return None

    except Exception as e:
        log.error("LLM call failed: %s", e)
        return None


def generate_fix_cursor(repo: str, ci_error: str, repo_context: str) -> list[dict] | None:
    """Generate a fix using Cursor Cloud Agents API."""
    api_key = os.environ.get("CURSOR_API_KEY", "")
    if not api_key:
        return None

    try:
        import base64
        auth = base64.b64encode(f"{api_key}:".encode()).decode()

        resp = requests.post(
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

        if resp.status_code == 200:
            data = resp.json()
            # Cursor returns changes in its own format — adapt
            log.info("Cursor agent completed")
            # Extract file changes from Cursor response
            changes = data.get("changes", [])
            return [{"path": c["path"], "content": c["content"]} for c in changes] if changes else None

        log.warning("Cursor API returned %d", resp.status_code)
        return None

    except Exception as e:
        log.error("Cursor call failed: %s", e)
        return None


def generate_hallucinated_fix(repo: str, repo_path: str) -> list[dict]:
    """Generate a plausible but wrong fix — tests the failure path."""
    log.info("generating hallucinated fix (intentional)")

    # Find a random source file and make a trivial change
    for ext in ["*.py", "*.js", "*.ts", "*.rs", "*.go"]:
        files = list(Path(repo_path).rglob(ext))
        if files:
            target = files[0]
            rel = str(target.relative_to(repo_path))
            content = target.read_text()
            # Add a comment that won't fix anything
            hallucinated = f"# BountyNet solver attempted fix (hallucinated)\n{content}"
            return [{"path": rel, "content": hallucinated}]

    return [{"path": "BOUNTYNET_ATTEMPTED_FIX.md", "content": "Solver attempted a fix but couldn't determine the root cause."}]


# ── PR Submission ─────────────────────────────────────────────

def submit_fix(gateway: str, repo: str, context_hash: str, agent_id: int, files: list, title: str = "") -> dict | None:
    """Submit a fix via the gateway."""
    try:
        resp = requests.post(
            f"{gateway}/github/submit-pr",
            json={
                "repo": repo,
                "context_hash": context_hash,
                "agent_id": agent_id,
                "title": title or f"fix: BountyNet solver #{agent_id} automated patch",
                "body": f"Automated fix by SimBountyNet solver agent #{agent_id}.\n\nThis PR was generated by an AI solver agent in response to a CI failure bounty.",
                "files": files,
            },
            timeout=30,
        )
        data = resp.json()
        if data.get("error"):
            log.error("submit failed: %s", data["error"])
            return None
        log.info("PR created: %s", data.get("pr_url", "?"))
        return data
    except Exception as e:
        log.error("submit error: %s", e)
        return None


# ── Main Loop ─────────────────────────────────────────────────

def solve_one(gateway: str, agent_id: int, bounty: dict, hallucinate: bool = False) -> bool:
    """Attempt to solve a single bounty. Returns True if PR submitted."""
    ctx = bounty.get("context_hash", "")
    repo = bounty.get("repo", "")
    log.info("--- solving: %s (%s)", repo, ctx[:16])

    # Claim
    claim = claim_bounty(gateway, ctx, agent_id)
    if not claim:
        return False

    bnet_token = claim.get("bnet_token", "")

    # Clone + analyze
    repo_path = clone_repo(repo)
    if not repo_path:
        return False

    try:
        ci_error = get_ci_error(gateway, repo, ctx)
        repo_context = analyze_repo(repo_path)

        # Generate fix
        files = None

        if hallucinate:
            files = generate_hallucinated_fix(repo, repo_path)
        else:
            # Try Cursor first, then Anthropic via gateway (dogfood), then direct
            files = generate_fix_cursor(repo, ci_error, repo_context)
            if not files:
                files = generate_fix_anthropic(repo, ci_error, repo_context, bnet_token, gateway)
            if not files:
                files = generate_fix_anthropic(repo, ci_error, repo_context)

        if not files:
            log.warning("no fix generated, submitting hallucinated fix")
            files = generate_hallucinated_fix(repo, repo_path)

        # Submit
        result = submit_fix(gateway, repo, ctx, agent_id, files)
        return result is not None

    finally:
        shutil.rmtree(repo_path, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="SimBountyNet — automated solver agent")
    parser.add_argument("--gateway", default=GATEWAY, help="Gateway URL")
    parser.add_argument("--repo", help="Only solve bounties for this repo")
    parser.add_argument("--once", action="store_true", help="Solve one bounty and exit")
    parser.add_argument("--hallucinate", action="store_true", help="Intentionally generate wrong fixes")
    parser.add_argument("--interval", type=int, default=15, help="Poll interval in seconds")
    args = parser.parse_args()

    config = load_or_register(args.gateway)
    agent_id = config["agent_id"]

    log.info("SimBountyNet Vishy starting")
    log.info("  agent: #%s", agent_id)
    log.info("  gateway: %s", args.gateway)
    log.info("  repo filter: %s", args.repo or "all")
    log.info("  hallucinate: %s", args.hallucinate)

    solved = 0
    attempted = 0

    while True:
        bounties = find_bounties(args.gateway, args.repo)

        if bounties:
            log.info("found %d claimable bounties", len(bounties))
            for bounty in bounties:
                attempted += 1
                if solve_one(args.gateway, agent_id, bounty, args.hallucinate):
                    solved += 1

                if args.once:
                    log.info("done. attempted=%d solved=%d", attempted, solved)
                    return
        else:
            log.info("no claimable bounties (attempted=%d solved=%d)", attempted, solved)

        if args.once:
            log.info("no bounties to solve")
            return

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
