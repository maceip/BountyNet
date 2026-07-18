"""
Client log batch ingestion — same JSON shape as Android [ShippedLogBatch].

POST /logs/android  (optional bearer token)

Env:
  BOUNTYNET_CLIENT_LOG_TOKEN — if unset, endpoint returns 503 (collector disabled).
"""
from __future__ import annotations

import logging
import os

from flask import Blueprint, jsonify, request

log_ingest_bp = Blueprint("log_ingest", __name__)
_logger = logging.getLogger(__name__)


def _auth_ok() -> bool:
    import hmac as _hmac

    token = (os.environ.get("BOUNTYNET_CLIENT_LOG_TOKEN") or "").strip()
    if not token:
        return False
    auth = request.headers.get("Authorization", "")
    return _hmac.compare_digest(auth, f"Bearer {token}")


@log_ingest_bp.route("/logs/android", methods=["POST"])
def ingest_android_logs():
    """Accept batched Timber / device logs; validate loosely to tolerate partial clients."""
    if not (os.environ.get("BOUNTYNET_CLIENT_LOG_TOKEN") or "").strip():
        return jsonify({"error": "client log ingest disabled (set BOUNTYNET_CLIENT_LOG_TOKEN)"}), 503
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "expected JSON object"}), 400

    entries = body.get("entries")
    if not isinstance(entries, list):
        return jsonify({"error": "entries must be a list"}), 400

    app_id = body.get("appId", "?")
    app_ver = body.get("appVersion", "?")
    source = body.get("source", "android")
    _logger.info(
        "client log batch source=%s app=%s ver=%s entries=%d device=%s sdk=%s",
        source,
        app_id,
        app_ver,
        len(entries),
        body.get("deviceModel", "?"),
        body.get("androidSdk", "?"),
    )
    for i, ent in enumerate(entries[:50]):
        if not isinstance(ent, dict):
            continue
        msg = str(ent.get("message", ""))[:500]
        level = str(ent.get("level", "INFO"))
        tag = ent.get("tag")
        _logger.debug("  [%d] %s/%s %s", i, level, tag, msg)

    return jsonify({"ok": True, "received": len(entries)})
