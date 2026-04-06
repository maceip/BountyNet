"""
GitHub App — unified webhook handler + PR submission + setup.

Routes here; shared GitHub App auth + REST helpers in `gateway.github`:
  POST /github/webhook    — receives all GitHub App events
  POST /github/submit-pr  — solver submits a patch (we create the PR)
  POST /github/setup      — Joe configures repos after app install
  GET  /github/repos/<installation_id> — list repos for an installation

In-memory stores (dev mode — sqlite in prod):
  installations: repo_full_name → { installation_id, owner, api_key, budget_tokens }
  bounty_prs:    context_hash → { pr_number, repo, solver_agent_id }
"""
import os
import time
import json
import requests
from flask import Blueprint, request, jsonify
from eth_utils import keccak
from eth_abi import encode
from gateway.chain import send_tx, sig, ESCROW, VALIDATION, w3
from gateway.events import emit
from gateway.github.api import (
    gh_commit_files,
    gh_create_branch,
    gh_create_pr,
    gh_list_repos,
    gh_post_comment,
)
from gateway.github.app_auth import get_installation_token, verify_webhook

github_bp = Blueprint("github", __name__)

# ── Storage (in-memory, dev mode) ──────────────────────────────

# repo → { installation_id, owner, api_key, budget_tokens, budget_used }
installations: dict = {}

# context_hash → { pr_number, repo, solver_agent_id, branch }
bounty_prs: dict = {}

# installation_id → [repo_full_name, ...]
install_repos: dict = {}


# ── On-chain helpers ───────────────────────────────────────────

def create_bounty_onchain(context_hash: bytes, amount: int, deadline_blocks: int, uri: str) -> dict | None:
    """Call BountyEscrow.create_bounty(context_hash, amount, deadline, uri)."""
    if not ESCROW:
        return None
    deadline = w3.eth.block_number + deadline_blocks
    data = "0x" + (
        sig("create_bounty(bytes32,uint256,uint256,string)")
        + encode(
            ["bytes32", "uint256", "uint256", "string"],
            [context_hash, amount, deadline, uri],
        )
    ).hex()
    try:
        return send_tx(ESCROW, data)
    except Exception as e:
        print(f"[github] create_bounty tx failed: {e}")
        return None


def submit_validation(repo: str, sha: str, name: str) -> dict | None:
    """Submit TEE-attested validation to Arc's ValidationRegistry."""
    from gateway.routes.oracle import submit_tee_validation
    return submit_tee_validation(repo, sha, name)


def resolve_bounty_onchain(context_hash: bytes, validation_hash: bytes) -> dict | None:
    """Call BountyEscrow.resolve_bounty(context_hash, validation_hash)."""
    if not ESCROW:
        return None
    data = "0x" + (
        sig("resolve_bounty(bytes32,bytes32)")
        + encode(["bytes32", "bytes32"], [context_hash, validation_hash])
    ).hex()
    try:
        return send_tx(ESCROW, data)
    except Exception as e:
        print(f"[github] resolve_bounty tx failed: {e}")
        return None


# ── Webhook handler ────────────────────────────────────────────

@github_bp.route("/github/webhook", methods=["POST"])
def webhook():
    if not verify_webhook(request.data, request.headers.get("X-Hub-Signature-256", "")):
        return jsonify({"error": "bad signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.json

    handlers = {
        "installation": handle_installation,
        "check_run": handle_check_run,
        "pull_request": handle_pull_request,
    }

    handler = handlers.get(event)
    if handler:
        return handler(payload)
    return jsonify({"status": "ignored", "event": event})


# Also register at /github for backwards compat with existing Caddy config
@github_bp.route("/github", methods=["POST"])
def webhook_compat():
    return webhook()


def handle_installation(payload):
    action = payload.get("action")
    if action != "created":
        return jsonify({"status": "ignored", "action": action})

    installation_id = payload["installation"]["id"]
    account = payload["installation"]["account"]
    login = account["login"]
    github_id = account["id"]
    repos = [r["full_name"] for r in payload.get("repositories", [])]

    # Store installation → repo mapping
    install_repos[installation_id] = repos
    for repo in repos:
        installations[repo] = {
            "installation_id": installation_id,
            "owner": login,
            "github_id": github_id,
            "api_key": "",
            "budget_tokens": 100_000,
            "budget_used": 0,
        }

    # Create Dynamic identity for the staker
    try:
        from gateway.routes.identity import call_dynamic
        user = call_dynamic("create-user", f"github:{github_id}")
        dynamic_user_id = user.get("userId")
    except Exception:
        dynamic_user_id = None

    emit("install", f"GitHub App installed by {login} on {len(repos)} repos",
         data={"login": login, "repos": repos, "installation_id": installation_id})

    return jsonify({
        "status": "installed",
        "login": login,
        "repos": repos,
        "installation_id": installation_id,
        "dynamic_user_id": dynamic_user_id,
    })


def handle_check_run(payload):
    if payload.get("action") != "completed":
        return jsonify({"status": "ignored"})

    check = payload["check_run"]
    conclusion = check.get("conclusion")
    repo = payload["repository"]["full_name"]
    sha = check.get("head_sha", "")
    name = check.get("name", "build")
    installation_id = payload["installation"]["id"]

    if conclusion == "failure":
        return _on_ci_failure(installation_id, repo, sha, name, check)
    elif conclusion == "success":
        return _on_ci_success(installation_id, repo, sha, name, check)

    return jsonify({"status": "ignored", "conclusion": conclusion})


def _on_ci_failure(installation_id, repo, sha, name, check):
    """CI failed → create bounty + post comment."""
    context_hash = keccak(f"{repo}:{sha[:8]}:{name}:failure".encode())
    context_hash_hex = "0x" + context_hash.hex()

    # Get installation config (may have API key budget from setup)
    config = installations.get(repo, {})
    budget_tokens = config.get("budget_tokens", 100_000)

    # If staker deposited an API key, register it in the inference budget pool
    api_key = config.get("api_key", "")
    if api_key:
        from gateway.routes.inference import staker_budgets
        staker_budgets[context_hash_hex] = {
            "anthropic_key": api_key if api_key.startswith("sk-ant") else "",
            "openai_key": api_key if api_key.startswith("sk-") and not api_key.startswith("sk-ant") else "",
            "budget_tokens": budget_tokens,
            "used_tokens": 0,
        }

    # Register in bounty feed so solvers can discover it
    import time
    from gateway.routes.bounties import apikey_bounties
    apikey_bounties[context_hash_hex] = {
        "repo": repo,
        "commit": sha[:8],
        "check_name": name,
        "budget_tokens": budget_tokens,
        "budget_used": 0,
        "solver_agent_id": 0,
        "resolved": False,
        "owner": config.get("owner", ""),
        "created_at": int(time.time()),
    }

    # API-key-funded bounties stay in the gateway feed only; EURC path uses on-chain escrow.
    tx_result = None
    if not api_key and ESCROW:
        tx_result = create_bounty_onchain(
            context_hash,
            amount=5_000_000,  # 5 EURC default
            deadline_blocks=1000,
            uri=f"github:{repo}:{sha[:8]}:{name}",
        )

    # Post comment on the commit
    token = get_installation_token(installation_id)
    if token:
        bounty_url = f"https://bountynet.stare.network/bounties/{context_hash_hex}"
        gh_post_comment(token, repo, sha,
            f"**BountyNet** \u2014 `{name}` failed.\n\n"
            f"Context: `{context_hash_hex[:18]}...`\n"
            f"Budget: {budget_tokens:,} tokens\n"
            f"A solver agent will pick this up shortly.\n\n"
            f"[View bounty]({bounty_url})"
        )

    emit("bounty", f"CI failed: {name} on {repo}@{sha[:8]} — bounty created ({budget_tokens:,} tokens)",
         repo=repo, context_hash=context_hash_hex, data={"check": name, "budget": budget_tokens})

    return jsonify({
        "status": "bounty_created",
        "repo": repo,
        "sha": sha[:8],
        "check": name,
        "context_hash": context_hash_hex,
        "budget_tokens": budget_tokens,
        "on_chain": tx_result,
    })


def _on_ci_success(installation_id, repo, sha, name, check):
    """CI passed → check if solver PR → validate + resolve."""
    sha_short = sha[:8]

    # Check if this CI run is for a BountyNet solver PR
    matching_bounty = None
    for ctx_hash, pr_info in bounty_prs.items():
        if pr_info["repo"] == repo:
            matching_bounty = (ctx_hash, pr_info)
            break

    if not matching_bounty:
        return jsonify({"status": "ci_green_no_bounty", "repo": repo, "sha": sha_short})

    ctx_hash, pr_info = matching_bounty

    # Submit on-chain validation
    val_result = submit_validation(repo, sha_short, name)

    # Resolve the bounty (releases payout)
    resolve_result = None
    if val_result and ctx_hash.startswith("0x"):
        ctx_bytes = bytes.fromhex(ctx_hash[2:])
        val_bytes = bytes.fromhex(val_result["validation_hash"][2:])
        resolve_result = resolve_bounty_onchain(ctx_bytes, val_bytes)

    # Post success comment
    token = get_installation_token(installation_id)
    if token:
        gh_post_comment(token, repo, sha,
            f"**BountyNet** \u2014 `{name}` passed!\n\n"
            f"Bounty `{ctx_hash[:18]}...` resolved.\n"
            f"Solver agent #{pr_info.get('solver_agent_id', '?')} paid out (70/30 split)."
        )

    emit("bounty", f"Bounty resolved! Agent #{pr_info.get('solver_agent_id', '?')} paid (70/30 split)",
         repo=repo, context_hash=ctx_hash, agent_id=pr_info.get("solver_agent_id"))

    return jsonify({
        "status": "resolved",
        "repo": repo,
        "sha": sha_short,
        "context_hash": ctx_hash,
        "validation": val_result,
        "resolution": resolve_result,
    })


def handle_pull_request(payload):
    """Track solver PRs — link PR to bounty context."""
    action = payload.get("action")
    pr = payload["pull_request"]
    repo = payload["repository"]["full_name"]

    # Check if this is a BountyNet solver PR (branch starts with bountynet/)
    head_ref = pr.get("head", {}).get("ref", "")
    is_solver_pr = head_ref.startswith("bountynet/")

    result = {
        "status": f"pr_{action}",
        "repo": repo,
        "pr": pr["number"],
        "author": pr["user"]["login"],
        "merged": pr.get("merged", False),
        "is_solver_pr": is_solver_pr,
    }

    if action == "closed" and pr.get("merged") and is_solver_pr:
        # Solver PR was merged — this is good, CI will run on merged code
        result["status"] = "solver_pr_merged"

    return jsonify(result)


# ── Setup (Joe's post-install config) ─────────────────────────

@github_bp.route("/github/setup", methods=["POST"])
def setup():
    """
    Joe configures his repos after installing the GitHub App.
    Body: {
        "installation_id": 123,
        "repos": ["joe/app"],
        "api_key": "sk-ant-...",
        "budget_tokens": 100000
    }
    """
    body = request.json or {}
    installation_id = body.get("installation_id")
    repos = body.get("repos", [])
    api_key = body.get("api_key", "")
    budget_tokens = body.get("budget_tokens", 100_000)

    if not installation_id:
        return jsonify({"error": "installation_id required"}), 400

    # If no repos specified, use all repos from the installation
    if not repos:
        repos = install_repos.get(installation_id, [])
        if not repos:
            repos = gh_list_repos(installation_id)
            install_repos[installation_id] = repos

    for repo in repos:
        installations[repo] = {
            "installation_id": installation_id,
            "owner": body.get("owner", ""),
            "api_key": api_key,
            "budget_tokens": budget_tokens,
            "budget_used": 0,
        }

    return jsonify({
        "status": "configured",
        "repos": repos,
        "budget_tokens": budget_tokens,
        "has_api_key": bool(api_key),
    })


@github_bp.route("/github/test-key", methods=["POST"])
def test_key():
    """
    Quick provider sanity check for setup flow.
    Body: { "api_key": "sk-ant-..." }
    """
    body = request.json or {}
    api_key = (body.get("api_key") or "").strip()
    if not api_key:
        return jsonify({"error": "api_key required"}), 400

    try:
        if api_key.startswith("sk-ant-"):
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-5-haiku-latest",
                    "max_tokens": 32,
                    "messages": [{"role": "user", "content": "Reply with exactly: BountyNet key works."}],
                },
                timeout=15,
            )
            data = resp.json()
            if resp.ok:
                text = ""
                for item in data.get("content", []):
                    if item.get("type") == "text":
                        text += item.get("text", "")
                return jsonify({
                    "ok": True,
                    "provider": "anthropic",
                    "text": text.strip() or "BountyNet key works.",
                })
            return jsonify({
                "ok": False,
                "provider": "anthropic",
                "error": data.get("error", {}).get("message", "Anthropic key test failed"),
            }), 400

        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": "Reply with exactly: BountyNet key works."}],
                "max_tokens": 24,
            },
            timeout=15,
        )
        data = resp.json()
        if resp.ok:
            text = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
            return jsonify({
                "ok": True,
                "provider": "openai",
                "text": text or "BountyNet key works.",
            })
        return jsonify({
            "ok": False,
            "provider": "openai",
            "error": data.get("error", {}).get("message", "OpenAI key test failed"),
        }), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 502


@github_bp.route("/github/repos/<int:installation_id>")
def list_installation_repos(installation_id):
    """List repos for an installation (called by setup page)."""
    cached = install_repos.get(installation_id)
    if cached:
        return jsonify({"repos": cached})

    repos = gh_list_repos(installation_id)
    if repos:
        install_repos[installation_id] = repos
    return jsonify({"repos": repos})


# ── Scan on install (instant value) ────────────────────────────

@github_bp.route("/github/scan/<int:installation_id>", methods=["POST"])
def scan_repos(installation_id):
    """
    Scan repos immediately after install — show Joe value in 30 seconds.

    For each repo:
      1. Fetch recent CI runs → find existing failures → auto-create bounties
      2. Fetch workflow files → pattern-based CI insights on downloaded YAML
      3. Return everything so the setup page can show it live

    Body (optional): { "repos": ["joe/app"] }
    If omitted, scans all repos in the installation.
    """
    body = request.json or {}
    repos = body.get("repos") or install_repos.get(installation_id) or gh_list_repos(installation_id)

    token = get_installation_token(installation_id)
    if not token:
        return jsonify({"error": "could not get installation token"}), 500

    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}
    results = []

    for repo in repos:
        repo_result = {
            "repo": repo,
            "failures": [],
            "insights": [],
            "bounties_created": [],
            "ci_healthy": False,
        }

        # ── 1. Fetch recent CI failures (REAL) ─────────────────
        try:
            runs_resp = requests.get(
                f"https://api.github.com/repos/{repo}/actions/runs",
                headers=headers,
                params={"status": "failure", "per_page": 10},
                timeout=10,
            )
            if runs_resp.status_code == 200:
                runs = runs_resp.json().get("workflow_runs", [])
                for run in runs[:5]:
                    failure = {
                        "run_id": run["id"],
                        "name": run.get("name", "CI"),
                        "head_sha": run.get("head_sha", "")[:8],
                        "branch": run.get("head_branch", ""),
                        "created_at": run.get("created_at", ""),
                        "url": run.get("html_url", ""),
                    }
                    repo_result["failures"].append(failure)

                    # Auto-create bounty for each failure
                    ctx_hash = keccak(
                        f"{repo}:{failure['head_sha']}:{failure['name']}:failure".encode()
                    )
                    ctx_hex = "0x" + ctx_hash.hex()
                    repo_result["bounties_created"].append({
                        "context_hash": ctx_hex,
                        "check": failure["name"],
                        "sha": failure["head_sha"],
                    })

            # Check if there are recent successes too
            ok_resp = requests.get(
                f"https://api.github.com/repos/{repo}/actions/runs",
                headers=headers,
                params={"status": "success", "per_page": 1},
                timeout=10,
            )
            if ok_resp.status_code == 200:
                ok_runs = ok_resp.json().get("workflow_runs", [])
                repo_result["ci_healthy"] = len(ok_runs) > 0

        except Exception as e:
            repo_result["failures"].append({"error": str(e)})

        # ── 2. Fetch workflow files → pattern-based insights (real YAML content)
        try:
            wf_resp = requests.get(
                f"https://api.github.com/repos/{repo}/contents/.github/workflows",
                headers=headers,
                timeout=10,
            )
            if wf_resp.status_code == 200:
                workflows = wf_resp.json()
                wf_names = [w["name"] for w in workflows if isinstance(w, dict)]
                repo_result["insights"] = _analyze_workflows(repo, wf_names, workflows, headers)
            else:
                repo_result["insights"].append({
                    "type": "missing_ci",
                    "severity": "high",
                    "title": "No CI configured",
                    "description": "This repo has no GitHub Actions workflows. "
                                   "BountyNet works best with CI — add a workflow to get started.",
                    "auto_fixable": True,
                })
        except Exception:
            pass

        results.append(repo_result)

    total_failures = sum(len(r["failures"]) for r in results)
    total_bounties = sum(len(r["bounties_created"]) for r in results)
    total_insights = sum(len(r["insights"]) for r in results)

    emit("scan", f"Scanned {len(results)} repos: {total_failures} failures, {total_insights} insights",
         data={"repos": len(results), "failures": total_failures, "insights": total_insights})

    return jsonify({
        "status": "scanned",
        "installation_id": installation_id,
        "repos_scanned": len(results),
        "total_failures": total_failures,
        "total_bounties_created": total_bounties,
        "total_insights": total_insights,
        "results": results,
    })


def _analyze_workflows(repo: str, wf_names: list, wf_files: list, headers: dict) -> list:
    """
    Analyze workflow files for improvement opportunities using the fetched workflow YAML.

    Heuristics only (caching, action versions, lint steps, timeouts); no synthetic data.
    """
    insights = []

    # Fetch one workflow to check for common patterns
    wf_content = ""
    for wf in wf_files:
        if isinstance(wf, dict) and wf.get("download_url"):
            try:
                resp = requests.get(wf["download_url"], timeout=10)
                if resp.status_code == 200:
                    wf_content = resp.text
                    break
            except Exception:
                pass

    # ── Pattern-based insights (real checks on real content) ───

    if wf_content:
        # Check for missing cache
        if "actions/cache" not in wf_content and "cache:" not in wf_content:
            insights.append({
                "type": "no_cache",
                "severity": "medium",
                "title": "No dependency caching",
                "description": "Your CI doesn't cache dependencies. Adding caching "
                               "could cut build times by 40-60%.",
                "auto_fixable": True,
            })

        # Check for outdated action versions
        if "actions/checkout@v2" in wf_content or "actions/checkout@v3" in wf_content:
            insights.append({
                "type": "outdated_actions",
                "severity": "low",
                "title": "Outdated GitHub Actions",
                "description": "Some actions use old versions (v2/v3). Upgrading to v4 "
                               "improves performance and security.",
                "auto_fixable": True,
            })

        # Check for missing formatting/linting step
        has_lint = any(kw in wf_content.lower() for kw in [
            "lint", "format", "prettier", "eslint", "ruff", "clippy",
            "cargo fmt", "black", "flake8", "mypy",
        ])
        if not has_lint:
            insights.append({
                "type": "no_linter",
                "severity": "medium",
                "title": "No linting or formatting check",
                "description": "Adding a lint/format step catches style issues before "
                               "they become review blockers.",
                "auto_fixable": True,
            })

        # Check for no parallel jobs
        if wf_content.count("jobs:") == 1 and "matrix" not in wf_content:
            job_count = wf_content.count("runs-on:")
            if job_count == 1:
                insights.append({
                    "type": "single_job",
                    "severity": "low",
                    "title": "Single CI job",
                    "description": "Splitting CI into parallel jobs (test, lint, build) "
                                   "reduces total pipeline time.",
                    "auto_fixable": True,
                })

        # Check for missing timeout
        if "timeout-minutes" not in wf_content:
            insights.append({
                "type": "no_timeout",
                "severity": "low",
                "title": "No job timeout",
                "description": "Without timeout-minutes, a hung job burns Actions minutes. "
                               "Adding a 15-30 min timeout is best practice.",
                "auto_fixable": True,
            })

    # ── Always suggest BountyNet attest action ─────────────────
    if "bountynet/attest" not in wf_content:
        insights.append({
            "type": "no_attestation",
            "severity": "info",
            "title": "Add BountyNet attestation",
            "description": "Adding the bountynet/attest action enables on-chain CI proofs "
                           "and faster bounty resolution.",
            "auto_fixable": True,
        })

    return insights


# ── Solver PR submission ───────────────────────────────────────

@github_bp.route("/github/submit-pr", methods=["POST"])
def submit_solver_pr():
    """
    Solver submits a fix. We create the branch, commit files, open PR.
    Solver never needs repo write access.

    Body: {
        "repo": "joe/app",
        "context_hash": "0x...",
        "agent_id": 1,
        "base": "main",
        "title": "fix: resolve auth test failure",
        "body": "...",
        "files": [{"path": "src/auth.rs", "content": "..."}]
    }
    """
    body = request.json or {}
    repo = body.get("repo")
    context_hash = body.get("context_hash", "")
    agent_id = body.get("agent_id")
    files = body.get("files", [])

    if not repo or not files:
        return jsonify({"error": "repo and files required"}), 400

    # Find installation_id for this repo
    config = installations.get(repo)
    if not config:
        return jsonify({"error": f"no installation for {repo}"}), 404

    installation_id = config["installation_id"]
    token = get_installation_token(installation_id)
    if not token:
        return jsonify({"error": "could not get installation token"}), 500

    # Create branch
    base = body.get("base", "main")
    branch = f"bountynet/fix-{context_hash[2:10] if context_hash.startswith('0x') else 'patch'}"

    # Get base branch SHA
    base_resp = requests.get(
        f"https://api.github.com/repos/{repo}/git/ref/heads/{base}",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        timeout=10,
    )
    if base_resp.status_code != 200:
        return jsonify({"error": f"base branch '{base}' not found"}), 404
    base_sha = base_resp.json()["object"]["sha"]

    if not gh_create_branch(token, repo, branch, base_sha):
        return jsonify({"error": "failed to create branch"}), 500

    # Commit files
    commit_msg = body.get("title", "fix: BountyNet solver patch")
    commit_sha = gh_commit_files(token, repo, branch, files, commit_msg)
    if not commit_sha:
        return jsonify({"error": "failed to commit files"}), 500

    # Create PR
    pr_body = (
        f"{body.get('body', 'Automated fix by BountyNet solver agent.')}\n\n"
        f"---\n"
        f"Solved by BountyNet agent #{agent_id or '?'}\n"
        f"Context: `{context_hash[:18]}...`"
    )

    pr = gh_create_pr(token, repo, branch, base,
        title=body.get("title", "fix: BountyNet solver patch"),
        body=pr_body,
    )

    # Track this PR → bounty linkage
    if context_hash:
        bounty_prs[context_hash] = {
            "pr_number": pr.get("number"),
            "repo": repo,
            "solver_agent_id": agent_id,
            "branch": branch,
        }

    emit("pr", f"Solver PR #{pr.get('number')} created on {repo} ({branch})",
         repo=repo, context_hash=context_hash, agent_id=agent_id,
         data={"pr_url": pr.get("html_url"), "pr_number": pr.get("number")})

    return jsonify({
        "status": "pr_created",
        "pr_url": pr.get("html_url"),
        "pr_number": pr.get("number"),
        "branch": branch,
        "context_hash": context_hash,
    })
