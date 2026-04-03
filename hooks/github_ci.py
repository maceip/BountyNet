"""
GitHub App webhook handler — CI failure triggers bounty creation.

Receives:
  - check_run.completed (conclusion: failure)
  - installation.created (new repo onboarded)

Flow:
  CI fails → webhook fires → onboard staker via Dynamic → create bounty on escrow
"""
import os
import json
import hmac
import hashlib
from flask import Flask, request, jsonify
from eth_utils import keccak

app = Flask(__name__)

WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
ESCROW_ADDRESS = os.environ.get("BOUNTY_ESCROW", "")


def verify_signature(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        return True  # dev mode
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.route("/github", methods=["POST"])
def github_webhook():
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not verify_signature(request.data, sig):
        return jsonify({"error": "bad signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.json

    if event == "installation":
        return handle_installation(payload)
    elif event == "check_run":
        return handle_check_run(payload)
    else:
        return jsonify({"status": "ignored", "event": event})


def handle_installation(payload):
    action = payload.get("action")
    if action != "created":
        return jsonify({"status": "ignored"})

    account = payload["installation"]["account"]
    github_id = account["id"]
    login = account["login"]

    # TODO: call onboard.py to create Dynamic identity
    print(f"[github] app installed by {login} (id:{github_id})")
    return jsonify({"status": "onboarded", "login": login})


def handle_check_run(payload):
    action = payload.get("action")
    check = payload.get("check_run", {})
    conclusion = check.get("conclusion")

    if action != "completed" or conclusion != "failure":
        return jsonify({"status": "ignored"})

    repo = payload["repository"]["full_name"]
    sha = check.get("head_sha", "")[:8]
    name = check.get("name", "build")

    context_hash = keccak(f"{repo}:{sha}:{name}:failure".encode())

    print(f"[github] CI failed: {repo} @ {sha} ({name})")
    print(f"[github] context_hash: 0x{context_hash.hex()[:16]}...")

    # TODO: auto-create bounty or notify staker
    return jsonify({
        "status": "bounty_candidate",
        "repo": repo,
        "commit": sha,
        "check": name,
        "context_hash": "0x" + context_hash.hex(),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8091)
