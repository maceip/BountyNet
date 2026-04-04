#!/usr/bin/env python3
"""
Cursor Cloud Agents API — thin CLI (docs: Cloud Agents API, Basic auth with API key).

This API does **not** expose Cursor settings, MCP config, or plugins; only agents + models + repos.
The closest "settings-adjacent" flows here are:
  - `models`  → which model IDs you may pass when launching an agent
  - `me`      → API key identity from Cursor's side
  - `repos`   → GitHub repos visible to the key (strict rate limits)
  - `launch`  → run a cloud agent with a given model + repo (actual work happens in Cursor's cloud)

Usage:
  export CURSOR_API_KEY=...
  python3 cursor_cloud_agents.py me
  python3 cursor_cloud_agents.py overview
  python3 cursor_cloud_agents.py models
  python3 cursor_cloud_agents.py agents
  python3 cursor_cloud_agents.py launch --repository https://github.com/org/repo --text "Summarize README"

See: https://api.cursor.com — MCP is documented as not supported on this API.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

BASE = "https://api.cursor.com"


def _request(
    method: str,
    path: str,
    *,
    body: dict[str, Any] | None = None,
    api_key: str,
) -> tuple[int, Any]:
    url = f"{BASE}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    token = base64.b64encode(f"{api_key}:".encode("utf-8")).decode("ascii")
    req.add_header("Authorization", f"Basic {token}")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(err_body) if err_body else {"detail": err_body}
        except json.JSONDecodeError:
            parsed = {"raw": err_body}
        return e.code, parsed


def cmd_me(key: str) -> int:
    code, data = _request("GET", "/v0/me", api_key=key)
    print(json.dumps(data, indent=2))
    return 0 if code == 200 else 1


def cmd_overview(key: str) -> int:
    """Single JSON snapshot: key identity + launchable models (closest thing to 'settings' in this API)."""
    c1, me = _request("GET", "/v0/me", api_key=key)
    c2, models = _request("GET", "/v0/models", api_key=key)
    blob = {"http_me": c1, "me": me, "http_models": c2, "models": models}
    print(json.dumps(blob, indent=2))
    return 0 if c1 == 200 and c2 == 200 else 1


def cmd_models(key: str) -> int:
    code, data = _request("GET", "/v0/models", api_key=key)
    print(json.dumps(data, indent=2))
    return 0 if code == 200 else 1


def cmd_repos(key: str) -> int:
    print(
        "# Rate limits: ~1/min and ~30/hour per user — can be slow for large orgs.",
        file=sys.stderr,
    )
    code, data = _request("GET", "/v0/repositories", api_key=key)
    print(json.dumps(data, indent=2))
    return 0 if code == 200 else 1


def cmd_agents(key: str, limit: int | None, cursor: str | None) -> int:
    q: list[str] = []
    if limit is not None:
        q.append(f"limit={limit}")
    if cursor:
        q.append(f"cursor={cursor}")
    path = "/v0/agents" + ("?" + "&".join(q) if q else "")
    code, data = _request("GET", path, api_key=key)
    print(json.dumps(data, indent=2))
    return 0 if code == 200 else 1


def cmd_status(key: str, agent_id: str) -> int:
    code, data = _request("GET", f"/v0/agents/{agent_id}", api_key=key)
    print(json.dumps(data, indent=2))
    return 0 if code == 200 else 1


def cmd_launch(
    key: str,
    *,
    repository: str | None,
    ref: str | None,
    pr_url: str | None,
    text: str,
    model: str | None,
    auto_pr: bool,
) -> int:
    payload: dict[str, Any] = {
        "prompt": {"text": text},
        "source": {},
    }
    if model:
        payload["model"] = model
    if pr_url:
        payload["source"]["prUrl"] = pr_url
    else:
        if not repository:
            print("Need --repository or --pr-url", file=sys.stderr)
            return 1
        payload["source"]["repository"] = repository
        if ref:
            payload["source"]["ref"] = ref
    if auto_pr:
        payload.setdefault("target", {})["autoCreatePr"] = True

    code, data = _request("POST", "/v0/agents", body=payload, api_key=key)
    print(json.dumps(data, indent=2))
    return 0 if code in (200, 201) else 1


def main() -> int:
    p = argparse.ArgumentParser(description="Cursor Cloud Agents API helper (no settings/MCP endpoints).")
    p.add_argument(
        "--api-key",
        default=os.environ.get("CURSOR_API_KEY", ""),
        help="Or set CURSOR_API_KEY",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("me", help="GET /v0/me — API key metadata")
    sub.add_parser(
        "overview",
        help="me + models in one object (no Cursor IDE settings; API capability snapshot)",
    )
    sub.add_parser("models", help="GET /v0/models — launchable model IDs")
    sub.add_parser("repos", help="GET /v0/repositories — visible GitHub repos (rate limited)")
    ag = sub.add_parser("agents", help="GET /v0/agents")
    ag.add_argument("--limit", type=int, default=None)
    ag.add_argument("--cursor", default=None, help="Pagination cursor")

    st = sub.add_parser("status", help="GET /v0/agents/{id}")
    st.add_argument("agent_id")

    lf = sub.add_parser("launch", help="POST /v0/agents")
    lf.add_argument("--repository", default=None, help="GitHub repo URL")
    lf.add_argument("--ref", default=None, help="Branch / tag / commit")
    lf.add_argument("--pr-url", dest="pr_url", default=None)
    lf.add_argument("--text", required=True, help="Agent prompt")
    lf.add_argument("--model", default=None, help='Model id, or omit for Cursor default')
    lf.add_argument("--auto-pr", action="store_true", help="autoCreatePr on completion")

    args = p.parse_args()
    key = args.api_key.strip()
    if not key:
        print("Set CURSOR_API_KEY or pass --api-key", file=sys.stderr)
        return 1

    if args.cmd == "me":
        return cmd_me(key)
    if args.cmd == "overview":
        return cmd_overview(key)
    if args.cmd == "models":
        return cmd_models(key)
    if args.cmd == "repos":
        return cmd_repos(key)
    if args.cmd == "agents":
        return cmd_agents(key, args.limit, args.cursor)
    if args.cmd == "status":
        return cmd_status(key, args.agent_id)
    if args.cmd == "launch":
        return cmd_launch(
            key,
            repository=args.repository,
            ref=args.ref,
            pr_url=args.pr_url,
            text=args.text,
            model=args.model,
            auto_pr=args.auto_pr,
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())