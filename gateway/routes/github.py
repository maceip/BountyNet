"""
GitHub App webhook — CI failure detection.

POST /github  — receives check_run + installation events
"""
import os
import hmac
import hashlib
from flask import Blueprint, request, jsonify
from eth_utils import keccak

github_bp = Blueprint("github", __name__)
SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")


def verify(payload: bytes, sig: str) -> bool:
    if not SECRET:
        return True
    expected = "sha256=" + hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


@github_bp.route("/github", methods=["POST"])
def webhook():
    if not verify(request.data, request.headers.get("X-Hub-Signature-256", "")):
        return jsonify({"error": "bad signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.json

    if event == "installation" and payload.get("action") == "created":
        login = payload["installation"]["account"]["login"]
        gid = payload["installation"]["account"]["id"]
        return jsonify({"status": "installed", "login": login, "external_id": f"github:{gid}"})

    if event == "check_run" and payload.get("action") == "completed":
        check = payload["check_run"]
        if check.get("conclusion") != "failure":
            return jsonify({"status": "ignored"})

        repo = payload["repository"]["full_name"]
        sha = check.get("head_sha", "")[:8]
        name = check.get("name", "build")
        ctx = keccak(f"{repo}:{sha}:{name}:failure".encode())

        return jsonify({
            "status": "bounty_candidate",
            "repo": repo,
            "commit": sha,
            "check": name,
            "context_hash": "0x" + ctx.hex(),
        })

    return jsonify({"status": "ignored", "event": event})
