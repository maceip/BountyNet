#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from functools import lru_cache
from typing import Any

from flask import Flask, Response, jsonify, request


app = Flask(__name__)

UPSTREAM_BASE = (os.getenv("VLLM_UPSTREAM_BASE") or "http://vllm:8000").rstrip("/")
AGENT_ID_HEADER = (os.getenv("VLLM_AGENT_ID_HEADER") or "X-Agent-ID").strip()
ADAPTER_MANIFEST_PATH = os.getenv("ADAPTER_MANIFEST_PATH") or "/etc/bountynet/adapter-manifest.json"
ADAPTER_BUCKET = (os.getenv("ADAPTER_BUCKET") or os.getenv("VLLM_ADAPTER_BUCKET") or "").strip()
ADAPTER_DEFAULT_REVISION = (os.getenv("ADAPTER_DEFAULT_REVISION") or "latest").strip()


@lru_cache(maxsize=1)
def _load_manifest() -> dict[str, Any]:
    if not ADAPTER_MANIFEST_PATH or not os.path.isfile(ADAPTER_MANIFEST_PATH):
        return {}
    try:
        with open(ADAPTER_MANIFEST_PATH, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _resolve_adapter(agent_id: str) -> dict[str, str]:
    agent_id = (agent_id or "").strip()
    if not agent_id:
        return {"agent_id": "", "adapter_id": "", "adapter_s3_uri": "", "revision": ""}

    manifest = _load_manifest()
    item = manifest.get(agent_id) if isinstance(manifest, dict) else None
    if isinstance(item, dict):
        adapter_id = str(item.get("adapter_id") or agent_id).strip()
        adapter_s3_uri = str(item.get("adapter_s3_uri") or "").strip()
        revision = str(item.get("revision") or ADAPTER_DEFAULT_REVISION).strip()
        if not adapter_s3_uri and ADAPTER_BUCKET:
            adapter_s3_uri = f"{ADAPTER_BUCKET.rstrip('/')}/{adapter_id}/{revision}/"
        return {
            "agent_id": agent_id,
            "adapter_id": adapter_id,
            "adapter_s3_uri": adapter_s3_uri,
            "revision": revision,
        }

    adapter_id = agent_id
    adapter_s3_uri = f"{ADAPTER_BUCKET.rstrip('/')}/{adapter_id}/{ADAPTER_DEFAULT_REVISION}/" if ADAPTER_BUCKET else ""
    return {
        "agent_id": agent_id,
        "adapter_id": adapter_id,
        "adapter_s3_uri": adapter_s3_uri,
        "revision": ADAPTER_DEFAULT_REVISION,
    }


def _forward(path: str) -> Response:
    upstream_url = f"{UPSTREAM_BASE}{path}"
    body_bytes = request.get_data() or b""
    incoming_headers = dict(request.headers)
    agent_id = (incoming_headers.get(AGENT_ID_HEADER) or incoming_headers.get("X-Agent-ID") or "").strip()
    adapter = _resolve_adapter(agent_id)

    headers: dict[str, str] = {}
    for key, value in incoming_headers.items():
        k = key.lower()
        if k in {"host", "content-length"}:
            continue
        headers[key] = value
    if AGENT_ID_HEADER and agent_id:
        headers[AGENT_ID_HEADER] = agent_id
    if adapter["adapter_id"]:
        headers["X-BN-Adapter-ID"] = adapter["adapter_id"]
    if adapter["adapter_s3_uri"]:
        headers["X-BN-Adapter-S3-URI"] = adapter["adapter_s3_uri"]
    if adapter["revision"]:
        headers["X-BN-Adapter-Revision"] = adapter["revision"]

    req = urllib.request.Request(upstream_url, data=body_bytes, headers=headers, method=request.method)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            status = resp.status
            payload = resp.read()
            content_type = resp.headers.get("Content-Type", "application/json")
    except urllib.error.HTTPError as e:
        status = e.code
        payload = e.read()
        content_type = e.headers.get("Content-Type", "application/json")

    out = Response(payload, status=status, content_type=content_type)
    if agent_id:
        out.headers["X-BN-Agent-ID"] = agent_id
    if adapter["adapter_id"]:
        out.headers["X-BN-Adapter-ID"] = adapter["adapter_id"]
    if adapter["adapter_s3_uri"]:
        out.headers["X-BN-Adapter-S3-URI"] = adapter["adapter_s3_uri"]
    if adapter["revision"]:
        out.headers["X-BN-Adapter-Revision"] = adapter["revision"]
    return out


@app.get("/health")
def health() -> Response:
    return jsonify({"status": "ok", "service": "adapter-router", "upstream": UPSTREAM_BASE})


@app.get("/ops/adapters/resolve")
def resolve_adapter() -> Response:
    agent_id = (request.args.get("agent_id") or request.headers.get(AGENT_ID_HEADER) or "").strip()
    return jsonify({"status": "ok", "resolution": _resolve_adapter(agent_id)})


@app.route("/v1/chat/completions", methods=["POST"])
def route_chat_completions() -> Response:
    return _forward("/v1/chat/completions")


@app.route("/v1/completions", methods=["POST"])
def route_completions() -> Response:
    return _forward("/v1/completions")


@app.route("/v1/models", methods=["GET"])
def route_models() -> Response:
    return _forward("/v1/models")


if __name__ == "__main__":
    port = int(os.getenv("ADAPTER_ROUTER_PORT") or "8010")
    app.run(host="0.0.0.0", port=port)
