"""
BountyNet GitHub App — the staker onramp.

When installed on a repo:
1. Creates a Dynamic identity for the repo owner
2. Injects bountynet/attest action into the repo's CI
3. Monitors CI outcomes
4. Posts status comments on failures with bounty info
5. Creates PRs from solver patches using the app's installation token

Env:
  GITHUB_APP_ID
  GITHUB_APP_PRIVATE_KEY (PEM)
  GITHUB_WEBHOOK_SECRET
"""
import os
import hmac
import hashlib
import time
import json
import jwt as pyjwt
import requests
from flask import Blueprint, request, jsonify

app_bp = Blueprint("github_app", __name__)

APP_ID = os.environ.get("GITHUB_APP_ID", "")
PRIVATE_KEY = os.environ.get("GITHUB_APP_PRIVATE_KEY", "")
WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")


def verify_webhook(payload: bytes, sig: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
    expected = "sha256=" + hmac.new(WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def get_app_jwt() -> str:
    """Generate a JWT for GitHub App authentication."""
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": APP_ID}
    return pyjwt.encode(payload, PRIVATE_KEY, algorithm="RS256")


def get_installation_token(installation_id: int) -> str:
    """Exchange app JWT for an installation access token."""
    resp = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers={
            "Authorization": f"Bearer {get_app_jwt()}",
            "Accept": "application/vnd.github+json",
        },
    )
    return resp.json().get("token", "")


def post_comment(token: str, repo: str, sha: str, body: str):
    """Post a commit comment."""
    requests.post(
        f"https://api.github.com/repos/{repo}/commits/{sha}/comments",
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
        },
        json={"body": body},
    )


def create_pr(token: str, repo: str, head: str, base: str, title: str, body: str):
    """Create a pull request from solver's patch."""
    return requests.post(
        f"https://api.github.com/repos/{repo}/pulls",
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
        },
        json={"title": title, "body": body, "head": head, "base": base},
    ).json()


# ── Webhook handlers ────────────────────────────────────────────

@app_bp.route("/github/webhook", methods=["POST"])
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


def handle_installation(payload):
    action = payload.get("action")
    if action != "created":
        return jsonify({"status": "ignored"})

    installation_id = payload["installation"]["id"]
    account = payload["installation"]["account"]
    login = account["login"]
    github_id = account["id"]
    repos = payload.get("repositories", [])

    # Onboard: create Dynamic identity
    from gateway.routes.identity import call_dynamic
    user = call_dynamic("create-user", f"github:{github_id}")

    # For each repo, we could inject the attest action
    # For now, just log and acknowledge
    repo_names = [r["full_name"] for r in repos]

    return jsonify({
        "status": "installed",
        "login": login,
        "repos": repo_names,
        "dynamic_user": user.get("userId"),
    })


def handle_check_run(payload):
    if payload.get("action") != "completed":
        return jsonify({"status": "ignored"})

    check = payload["check_run"]
    conclusion = check.get("conclusion")
    repo = payload["repository"]["full_name"]
    sha = check.get("head_sha", "")
    name = check.get("name", "")
    installation_id = payload["installation"]["id"]

    if conclusion == "failure":
        return handle_ci_failure(installation_id, repo, sha, name, check)
    elif conclusion == "success":
        return handle_ci_success(installation_id, repo, sha, name, check)

    return jsonify({"status": "ignored"})


def handle_ci_failure(installation_id, repo, sha, name, check):
    """CI failed — create bounty candidate and notify."""
    from eth_utils import keccak
    context_hash = "0x" + keccak(f"{repo}:{sha[:8]}:{name}:failure".encode()).hex()

    token = get_installation_token(installation_id)
    if token:
        post_comment(token, repo, sha,
            f"**BountyNet** — `{name}` failed.\n\n"
            f"Context: `{context_hash[:18]}...`\n"
            f"A solver agent will pick this up shortly.\n\n"
            f"[View bounty](https://gateway.stare.network/bounties/{context_hash})"
        )

    return jsonify({
        "status": "bounty_created",
        "repo": repo,
        "sha": sha[:8],
        "check": name,
        "context_hash": context_hash,
    })


def handle_ci_success(installation_id, repo, sha, name, check):
    """CI passed — if this was a solver's PR, trigger oracle validation."""
    from eth_utils import keccak
    val_hash = "0x" + keccak(f"ci-proof:{repo}:{sha[:8]}:{name}".encode()).hex()

    # Check if this was a BountyNet solver PR
    # (In production, check the PR author against registered solver bots)

    return jsonify({
        "status": "ci_green",
        "repo": repo,
        "sha": sha[:8],
        "validation_hash": val_hash,
    })


def handle_pull_request(payload):
    """Track solver PRs."""
    action = payload.get("action")
    if action not in ("opened", "closed"):
        return jsonify({"status": "ignored"})

    pr = payload["pull_request"]
    return jsonify({
        "status": f"pr_{action}",
        "repo": payload["repository"]["full_name"],
        "pr": pr["number"],
        "author": pr["user"]["login"],
        "merged": pr.get("merged", False),
    })


# ── Solver PR submission ────────────────────────────────────────

@app_bp.route("/github/submit-pr", methods=["POST"])
def submit_solver_pr():
    """
    Solver submits a patch. We create the PR using the app's installation token.
    Solver never needs repo access.

    Body: {
        "installation_id": 123,
        "repo": "joe/app",
        "base": "main",
        "branch": "bountynet/fix-42",
        "title": "fix: resolve auth test failure",
        "body": "...",
        "context_hash": "0x...",
        "agent_id": 1,
        "patch": "diff content or commit ref"
    }
    """
    body = request.json or {}
    installation_id = body.get("installation_id")
    repo = body.get("repo")

    if not installation_id or not repo:
        return jsonify({"error": "installation_id and repo required"}), 400

    token = get_installation_token(installation_id)
    if not token:
        return jsonify({"error": "could not get installation token"}), 500

    pr = create_pr(
        token, repo,
        head=body.get("branch", "bountynet/fix"),
        base=body.get("base", "main"),
        title=body.get("title", "fix: BountyNet solver patch"),
        body=(
            f"{body.get('body', '')}\n\n"
            f"---\n"
            f"Solved by BountyNet agent #{body.get('agent_id', '?')}\n"
            f"Context: `{body.get('context_hash', '?')[:18]}...`"
        ),
    )

    return jsonify({"status": "pr_created", "pr_url": pr.get("html_url"), "pr_number": pr.get("number")})
