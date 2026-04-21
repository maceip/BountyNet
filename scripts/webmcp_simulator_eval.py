#!/usr/bin/env python3
"""Deterministic WebMCP simulator evals for repo_owner/agent_operator journeys."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from http.client import RemoteDisconnected
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

VAR_PATTERN = re.compile(r"\{\{([a-zA-Z0-9_]+)\}\}")


def render_template(value: Any, context: dict[str, Any]) -> Any:
    if isinstance(value, str):
        def replace(match: re.Match[str]) -> str:
            key = match.group(1)
            if key not in context:
                raise KeyError(f"template variable '{key}' missing in context")
            return str(context[key])

        rendered = VAR_PATTERN.sub(replace, value)
        if rendered.isdigit():
            return int(rendered)
        return rendered
    if isinstance(value, list):
        return [render_template(item, context) for item in value]
    if isinstance(value, dict):
        return {k: render_template(v, context) for k, v in value.items()}
    return value


def get_path(payload: dict[str, Any], dotted_path: str) -> Any:
    current: Any = payload
    for segment in dotted_path.split("."):
        if not isinstance(current, dict) or segment not in current:
            raise KeyError(f"missing '{dotted_path}' in payload")
        current = current[segment]
    return current


def do_http(
    base_url: str,
    method: str,
    path: str,
    body: Any | None,
    retries: int = 3,
    retry_sleep_s: float = 1.0,
) -> tuple[int, str]:
    url = urljoin(base_url, path)
    raw_body = None
    headers = {"accept": "application/json"}
    if body is not None:
        raw_body = json.dumps(body).encode("utf-8")
        headers["content-type"] = "application/json"
    req = Request(url=url, method=method, data=raw_body, headers=headers)
    for attempt in range(1, retries + 1):
        try:
            with urlopen(req, timeout=30) as response:
                return response.status, response.read().decode("utf-8", errors="replace")
        except HTTPError as error:
            return error.code, error.read().decode("utf-8", errors="replace")
        except (URLError, RemoteDisconnected) as error:
            if attempt == retries:
                raise RuntimeError(f"request failed for {method} {path}: {error}") from error
            time.sleep(retry_sleep_s)
    raise RuntimeError(f"request failed for {method} {path}: retry budget exhausted")


def wait_ready(base_url: str, attempts: int = 60, sleep_s: float = 1.0) -> None:
    for _ in range(attempts):
        try:
            status, _ = do_http(base_url, "GET", "/api/bountynet/webmcp/journeys", None, retries=1)
            if status == 200:
                return
        except RuntimeError:
            pass
        time.sleep(sleep_s)
    raise RuntimeError("web app not ready for WebMCP evals")


def expect_step(expectation: dict[str, Any], status: int, body_text: str) -> None:
    wanted_status = expectation.get("status")
    if wanted_status is not None and status != int(wanted_status):
        raise AssertionError(f"expected status {wanted_status}, got {status}")

    contains_terms = expectation.get("json_contains", [])
    for term in contains_terms:
        if term not in body_text:
            raise AssertionError(f"expected response to contain '{term}'")


def run_case(case: dict[str, Any], base_url: str, context: dict[str, Any]) -> dict[str, Any]:
    steps = case.get("steps", [])
    if not steps:
        raise ValueError(f"case {case.get('id')} has no steps")

    case_result = {"id": case.get("id", "unknown"), "ok": True, "steps": []}
    for step in steps:
        name = step["name"]
        method = step["method"]
        path = render_template(step["path"], context)
        json_body = render_template(step.get("json_body"), context)
        status, body_text = do_http(base_url=base_url, method=method, path=path, body=json_body)
        expectation = render_template(step.get("expect", {}), context)

        step_info = {"name": name, "method": method, "path": path, "status": status}
        try:
            expect_step(expectation, status, body_text)
            payload = json.loads(body_text) if body_text else {}
            for context_key, json_path in (step.get("save") or {}).items():
                context[context_key] = get_path(payload, json_path)
            step_info["ok"] = True
        except Exception as error:  # noqa: BLE001
            step_info["ok"] = False
            step_info["error"] = str(error)
            case_result["ok"] = False
            case_result["steps"].append(step_info)
            break

        case_result["steps"].append(step_info)

    return case_result


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deterministic WebMCP simulator evals.")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:5173",
        help="Base URL for the web app (default: %(default)s)",
    )
    parser.add_argument(
        "--eval-file",
        default=str(Path(__file__).with_name("webmcp_sim_evals.json")),
        help="Path to eval definition JSON",
    )
    args = parser.parse_args()

    eval_path = Path(args.eval_file)
    if not eval_path.exists():
        print(f"Eval file not found: {eval_path}", file=sys.stderr)
        return 2

    data = json.loads(eval_path.read_text(encoding="utf-8"))
    cases = data.get("cases", [])
    if not cases:
        print("No cases found in eval file.", file=sys.stderr)
        return 2

    context: dict[str, Any] = {"run_id": int(time.time())}
    wait_ready(args.base_url)
    results = []
    for case in cases:
        results.append(run_case(case=case, base_url=args.base_url, context=context))

    passed = sum(1 for case in results if case["ok"])
    summary = {
        "ok": passed == len(results),
        "passed_cases": passed,
        "total_cases": len(results),
        "results": results,
    }
    print(json.dumps(summary, indent=2))
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
