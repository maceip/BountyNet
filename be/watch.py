#!/usr/bin/env python3
"""
be watch — local proxy that seamlessly injects BountyNet credits.

Usage:
  be watch                # starts local proxy on :8100

Then in another terminal:
  ANTHROPIC_BASE_URL=http://localhost:8100 claude

How it works:
  1. Vishy sets ANTHROPIC_BASE_URL once, starts claude, never restarts
  2. Local proxy normally passes through to Anthropic using Vishy's key
  3. be watch polls for bounties in the background
  4. When a bounty is claimed: proxy switches to BountyNet gateway
     (staker pays — Vishy's key untouched)
  5. When bounty resolves: proxy switches back to Vishy's key
  6. Claude never knows. No restart. No interruption.
"""
import os
import sys
import json
import time
import threading
import argparse
import requests as http_client
from http.server import HTTPServer, BaseHTTPRequestHandler

GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
ANTHROPIC_URL = "https://api.anthropic.com"
AGENT_ID = os.environ.get("BOUNTYNET_AGENT_ID", "")

# Shared state — bounty watcher thread writes, proxy reads
state = {
    "active_bounty": None,     # context_hash when active
    "mode": "passthrough",     # "passthrough" or "bountynet"
    "seen": set(),
    "claimed": 0,
    "resolved": 0,
}


def log(msg):
    sys.stderr.write(f"[be] {msg}\n")
    sys.stderr.flush()


def get_agent_id():
    if AGENT_ID:
        return AGENT_ID
    config = os.path.expanduser("~/.bountynet/agent.json")
    if os.path.exists(config):
        with open(config) as f:
            return json.load(f).get("agent_id", "")
    return ""


# ── Bounty watcher (background thread) ─────────────────────────

def bounty_watcher(agent_id, interval):
    while True:
        try:
            if not state["active_bounty"]:
                # Look for work
                resp = http_client.get(f"{GATEWAY}/bounties", timeout=10)
                bounties = resp.json().get("bounties", [])
                for b in bounties:
                    ctx = b.get("context_hash", "")
                    if ctx in state["seen"] or not b.get("claimable"):
                        continue
                    state["seen"].add(ctx)
                    # Claim it
                    claim = http_client.post(f"{GATEWAY}/claim", json={
                        "context_hash": ctx, "agent_id": agent_id,
                    }, timeout=10).json()
                    if claim.get("status") != "error":
                        state["active_bounty"] = ctx
                        state["mode"] = "bountynet"
                        state["claimed"] += 1
                        log(f"CLAIMED {ctx[:18]}... — routing through staker's key")
                        break
            else:
                # Check if active bounty resolved
                resp = http_client.get(
                    f"{GATEWAY}/bounties/{state['active_bounty']}", timeout=5
                )
                data = resp.json()
                if data.get("resolved") or data.get("cancelled") or data.get("error"):
                    log(f"bounty resolved — back to your key")
                    state["active_bounty"] = None
                    state["mode"] = "passthrough"
                    state["resolved"] += 1
        except Exception as e:
            pass  # silent — don't spam stderr during normal coding

        time.sleep(interval)


# ── Local proxy ─────────────────────────────────────────────────

class ProxyHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        if state["mode"] == "bountynet" and state["active_bounty"]:
            # Route through BountyNet gateway — staker pays
            agent_id = get_agent_id()
            url = f"{GATEWAY}{self.path}"
            headers = {
                "x-api-key": f"bnet_{agent_id}:{state['active_bounty']}",
                "anthropic-version": self.headers.get("anthropic-version", "2023-06-01"),
                "content-type": "application/json",
            }
        else:
            # Passthrough to Anthropic — Vishy's key
            url = f"{ANTHROPIC_URL}{self.path}"
            headers = {
                "x-api-key": self.headers.get("x-api-key", ""),
                "anthropic-version": self.headers.get("anthropic-version", "2023-06-01"),
                "content-type": "application/json",
            }
            # Forward authorization header too
            auth = self.headers.get("Authorization")
            if auth:
                headers["Authorization"] = auth

        try:
            resp = http_client.post(url, headers=headers, data=body, timeout=120)
            self.send_response(resp.status_code)
            for k, v in resp.headers.items():
                if k.lower() in ("content-type", "content-length"):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(resp.content)
        except Exception as e:
            self.send_error(502, str(e))

    def do_GET(self):
        # Status endpoint
        if self.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "mode": state["mode"],
                "active_bounty": state["active_bounty"],
                "claimed": state["claimed"],
                "resolved": state["resolved"],
            }).encode())
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        pass  # silent — don't pollute terminal


# ── Main ────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Local proxy that injects BountyNet credits into your coding agent.",
        usage="be watch [--port 8100] [--interval 5]",
    )
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--interval", type=int, default=5)
    parser.add_argument("--gateway", type=str, default=None)
    args = parser.parse_args()

    if args.gateway:
        global GATEWAY
        GATEWAY = args.gateway

    agent_id = get_agent_id()
    if not agent_id:
        log("no agent ID — run 'be join' first")
        sys.exit(1)

    log(f"agent #{agent_id}")
    log(f"proxy on http://localhost:{args.port}")
    log(f"set ANTHROPIC_BASE_URL=http://localhost:{args.port}")
    log(f"then start claude normally — be handles the rest")
    log(f"")
    log(f"mode: passthrough (your key)")

    # Start bounty watcher thread
    t = threading.Thread(target=bounty_watcher, args=(agent_id, args.interval), daemon=True)
    t.start()

    # Start proxy
    server = HTTPServer(("127.0.0.1", args.port), ProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log(f"shutting down. claimed={state['claimed']} resolved={state['resolved']}")


if __name__ == "__main__":
    main()
