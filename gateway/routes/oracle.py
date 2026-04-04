"""
CI Oracle — standalone endpoint for triggering validation + resolution.

POST /oracle  — receives check_run.completed(success) directly
               (alternative to the /github/webhook path)

This is a thin wrapper around the shared functions in github.py.
Both paths (webhook and direct oracle) use the same on-chain logic.
"""
from flask import Blueprint, request, jsonify
from gateway.routes.github import verify_webhook, submit_validation

oracle_bp = Blueprint("oracle", __name__)


@oracle_bp.route("/oracle", methods=["POST"])
def oracle():
    if not verify_webhook(request.data, request.headers.get("X-Hub-Signature-256", "")):
        return jsonify({"error": "bad signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    if event != "check_run":
        return jsonify({"status": "ignored"})

    payload = request.json
    check = payload.get("check_run", {})
    if payload.get("action") != "completed" or check.get("conclusion") != "success":
        return jsonify({"status": "ignored"})

    repo = payload["repository"]["full_name"]
    sha = check.get("head_sha", "")[:8]
    name = check.get("name", "build")

    result = submit_validation(repo, sha, name)
    if result:
        return jsonify({"status": "validated", **result})
    return jsonify({"error": "validation submission failed"}), 500
