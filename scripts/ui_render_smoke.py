#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import urllib.error
import urllib.request


def fetch_text(url: str, timeout: int = 10) -> tuple[int, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "bountynet-ui-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        status = resp.status
        content_type = resp.headers.get("Content-Type", "")
        body = resp.read().decode("utf-8", errors="replace")
    return status, content_type, body


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def check_marketplace(url: str) -> None:
    status, content_type, body = fetch_text(url)
    ensure(status == 200, f"marketplace status must be 200, got {status}")
    ensure("text/html" in content_type.lower(), f"marketplace content-type must be text/html, got {content_type}")
    ensure("<html" in body.lower(), "marketplace response is not HTML")
    ensure(("Agent Market" in body) or ("agent marketplace" in body.lower()), "marketplace title/header missing")
    ensure('id="jobs-list"' in body, "marketplace jobs list mount missing")
    ensure(("style" in body.lower()) or ("stylesheet" in body.lower()), "marketplace style block missing")

    # "Looks broken" guardrails for obvious regressions.
    bad_markers = [
        "market_ui.html missing",
        "Internal Server Error",
        "Traceback (most recent call last)",
        "Cannot GET /marketplace",
    ]
    for marker in bad_markers:
        ensure(marker not in body, f"marketplace contains broken marker: {marker}")

    # This can be inline CSS or bundled stylesheet references.
    if "<style" in body.lower():
        css_match = re.search(r"<style[^>]*>(.*?)</style>", body, flags=re.IGNORECASE | re.DOTALL)
        ensure(css_match is not None, "marketplace css block not parseable")
        css_text = css_match.group(1)
        ensure(len(css_text.strip()) > 120, "marketplace CSS unexpectedly tiny; possible style regression")


def check_required_page(url: str, *, page_name: str) -> None:
    status, content_type, body = fetch_text(url)
    ensure(status == 200, f"landing status must be 200 when reachable, got {status}")
    ensure("text/html" in content_type.lower(), f"landing content-type must be text/html, got {content_type}")
    ensure("<html" in body.lower(), f"{page_name} response is not HTML")
    # Minimal style/render checks to catch "unstyled blank shell" regressions.
    ensure(
        ("<style" in body.lower()) or ("stylesheet" in body.lower()),
        f"{page_name} has no stylesheet reference or inline style",
    )
    bad_markers = ["Internal Server Error", "Cannot GET /", "Traceback (most recent call last)"]
    for marker in bad_markers:
        ensure(marker not in body, f"{page_name} contains broken marker: {marker}")
    if "onboarding" in page_name:
        ensure("onboarding" in body.lower() or "persona" in body.lower(), f"{page_name} copy missing")

def check_required_json(url: str, *, marker: str) -> None:
    status, content_type, body = fetch_text(url)
    ensure(status == 200, f"{marker} status must be 200, got {status}")
    ensure("json" in content_type.lower(), f"{marker} content-type must be json, got {content_type}")
    ensure(marker in body, f"{marker} missing from payload")


def main() -> int:
    marketplace_url = os.getenv("MARKETPLACE_UI_URL", "http://127.0.0.1:5173/marketplace")
    landing_url = os.getenv("LANDING_UI_URL", "http://127.0.0.1:5173/")
    dashboard_url = os.getenv("DASHBOARD_UI_URL", "http://127.0.0.1:5173/dashboard")
    repo_owner_onboarding_url = os.getenv("REPO_OWNER_ONBOARDING_UI_URL", "http://127.0.0.1:5173/onboarding/repo-owner")
    agent_operator_onboarding_url = os.getenv("AGENT_OPERATOR_ONBOARDING_UI_URL", "http://127.0.0.1:5173/onboarding/agent-operator")
    repo_owner_settings_url = os.getenv("REPO_OWNER_SETTINGS_UI_URL", "http://127.0.0.1:5173/settings/repo-owner")
    agent_operator_settings_url = os.getenv("AGENT_OPERATOR_SETTINGS_UI_URL", "http://127.0.0.1:5173/settings/agent-operator")
    inventory_url = os.getenv("INVENTORY_UI_URL", "http://127.0.0.1:5173/inventory")
    diagnostics_url = os.getenv("WEBMCP_DIAGNOSTICS_UI_URL", "http://127.0.0.1:5173/diagnostics/webmcp")
    control_plane_url = os.getenv("CONTROL_PLANE_UI_URL", "http://127.0.0.1:5173/ops/control-plane")
    simulator_url = os.getenv("SIMULATOR_UI_URL", "http://127.0.0.1:5173/ops/simulator")
    reputation_url = os.getenv("REPUTATION_UI_URL", "http://127.0.0.1:5173/marketplace/reputation")
    settlements_url = os.getenv("SETTLEMENTS_UI_URL", "http://127.0.0.1:5173/marketplace/settlements")
    disputes_url = os.getenv("DISPUTES_UI_URL", "http://127.0.0.1:5173/marketplace/disputes")

    check_marketplace(marketplace_url)
    check_required_page(landing_url, page_name="landing")
    check_required_page(dashboard_url, page_name="dashboard")
    check_required_page(repo_owner_onboarding_url, page_name="repo owner onboarding")
    check_required_page(agent_operator_onboarding_url, page_name="agent operator onboarding")
    check_required_page(repo_owner_settings_url, page_name="repo owner settings")
    check_required_page(agent_operator_settings_url, page_name="agent operator settings")
    check_required_page(inventory_url, page_name="inventory")
    check_required_page(diagnostics_url, page_name="webmcp diagnostics")
    check_required_page(control_plane_url, page_name="control plane")
    check_required_page(simulator_url, page_name="simulator")
    check_required_page(reputation_url, page_name="reputation")
    check_required_page(settlements_url, page_name="settlements")
    check_required_page(disputes_url, page_name="disputes")
    # WebMCP manifests must exist for both personas.
    check_required_json(
        os.getenv("WEBMCP_MANIFEST_URL", "http://127.0.0.1:5173/api/bountynet/webmcp/journeys"),
        marker="webmcp_journey_manifest",
    )
    check_required_json(
        os.getenv("WEBMCP_REPO_OWNER_URL", "http://127.0.0.1:5173/api/bountynet/webmcp/journeys/repo_owner"),
        marker="\"persona\":\"repo_owner\"",
    )
    check_required_json(
        os.getenv("WEBMCP_AGENT_OPERATOR_URL", "http://127.0.0.1:5173/api/bountynet/webmcp/journeys/agent_operator"),
        marker="\"persona\":\"agent_operator\"",
    )
    print(
        "UI smoke passed: "
        f"marketplace={marketplace_url}; landing={landing_url}; dashboard={dashboard_url}; "
        f"repo_owner_onboarding={repo_owner_onboarding_url}; agent_operator_onboarding={agent_operator_onboarding_url}; "
        f"repo_owner_settings={repo_owner_settings_url}; agent_operator_settings={agent_operator_settings_url}; "
        f"inventory={inventory_url}; diagnostics={diagnostics_url}; control_plane={control_plane_url}; simulator={simulator_url}; "
        f"reputation={reputation_url}; settlements={settlements_url}; disputes={disputes_url}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
