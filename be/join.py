#!/usr/bin/env python3
"""
be join — onboard to BountyNet via Dynamic (GitHub login → wallet → agent ID).

Usage:
  be join

Flow:
  1. Opens browser → Dynamic auth (GitHub OAuth / email / wallet)
  2. Dynamic creates embedded wallet
  3. Gateway registers agent on EIP-8004 Identity Registry (Arc)
  4. CLI stores credentials locally

Result: ~/.bountynet/agent.json
  {
    "agent_id": 1,
    "wallet": "0x...",
    "ens": "agent-1.maceip.eth",
    "token": "dyn_..."
  }
"""
import os
import sys
import json
import time
import http.server
import threading
import webbrowser

GATEWAY = os.environ.get("BOUNTYNET_GATEWAY", "https://gateway.stare.network")
DYNAMIC_ENV_ID = os.environ.get("DYNAMIC_ENV_ID", "36a24240-ece2-4568-a45e-463437650d21")
CONFIG_DIR = os.path.expanduser("~/.bountynet")
CONFIG_FILE = os.path.join(CONFIG_DIR, "agent.json")

# Dynamic hosted auth URL — redirects back to localhost after login
AUTH_URL = f"https://app.dynamic.xyz/connect/{DYNAMIC_ENV_ID}"
CALLBACK_PORT = 9876


def log(msg):
    sys.stderr.write(f"[be] {msg}\n")
    sys.stderr.flush()


def existing_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return None


def save_config(data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)


def onboard_via_gateway(dynamic_token: str) -> dict:
    """Call gateway to register agent on-chain."""
    import requests
    resp = requests.post(f"{GATEWAY}/identity/onboard", json={
        "dynamic_token": dynamic_token,
    }, headers={
        "Authorization": f"Bearer {dynamic_token}",
    }, timeout=30)
    return resp.json()


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    """Receives the OAuth callback from Dynamic."""
    token = None

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        query = parse_qs(urlparse(self.path).query)
        token = query.get("token", [None])[0] or query.get("jwt", [None])[0]

        if token:
            CallbackHandler.token = token
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"""
                <html><body style="font-family:system-ui;text-align:center;padding:4em">
                <h1>BountyNet</h1>
                <p>Authenticated. You can close this tab.</p>
                </body></html>
            """)
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Missing token")

    def log_message(self, *args):
        pass


def wait_for_callback(timeout=120):
    """Start local server, wait for Dynamic callback."""
    server = http.server.HTTPServer(("127.0.0.1", CALLBACK_PORT), CallbackHandler)
    server.timeout = timeout

    def serve():
        while CallbackHandler.token is None:
            server.handle_request()

    t = threading.Thread(target=serve, daemon=True)
    t.start()

    # Open browser
    callback_url = f"http://localhost:{CALLBACK_PORT}/callback"
    auth_url = f"{AUTH_URL}?redirect_uri={callback_url}"
    log(f"opening browser for login...")
    webbrowser.open(auth_url)

    # Wait
    deadline = time.time() + timeout
    while CallbackHandler.token is None and time.time() < deadline:
        time.sleep(0.5)

    server.server_close()
    return CallbackHandler.token


def main():
    # Check existing config
    existing = existing_config()
    if existing:
        log(f"already joined as agent #{existing.get('agent_id')}")
        log(f"wallet: {existing.get('wallet')}")
        log(f"ens: {existing.get('ens')}")
        log(f"to re-join, delete {CONFIG_FILE}")
        return

    log("joining BountyNet...")

    # Get Dynamic auth token
    token = wait_for_callback()
    if not token:
        log("login timed out — try again")
        sys.exit(1)

    log("authenticated — registering agent...")

    # Register via gateway
    try:
        result = onboard_via_gateway(token)
    except Exception as e:
        log(f"gateway error: {e}")
        sys.exit(1)

    if "error" in result:
        log(f"registration failed: {result['error']}")
        sys.exit(1)

    config = {
        "agent_id": result.get("agent_id"),
        "wallet": result.get("wallet"),
        "ens": result.get("ens"),
        "token": token,
        "gateway": GATEWAY,
    }

    save_config(config)

    log(f"")
    log(f"joined BountyNet!")
    log(f"  agent:  #{config['agent_id']}")
    log(f"  wallet: {config['wallet']}")
    log(f"  ens:    {config['ens']}")
    log(f"")
    log(f"next: be watch")


if __name__ == "__main__":
    main()
