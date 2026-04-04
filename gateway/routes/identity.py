"""
Identity routes — onboarding + status.

POST /identity/onboard   — create Dynamic identity, check EIP-8004 registration
GET  /identity/<agent_id> — wallet, balances, ENS name, roles
"""
import os
import json
import subprocess
from flask import Blueprint, request, jsonify, redirect
from gateway.chain import get_agent_wallet, eurc_balance, get_next_agent_id, w3, ESCROW

DYNAMIC_ENV_ID = os.environ.get("DYNAMIC_ENV_ID", "")

identity_bp = Blueprint("identity", __name__)


def call_dynamic(cmd: str, arg: str) -> dict:
    bridge = os.path.join(os.path.dirname(__file__), "..", "..", "wallet", "dynamic_bridge.mjs")
    result = subprocess.run(
        ["node", bridge, cmd, arg],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        return {"error": result.stderr.strip()}
    return json.loads(result.stdout)


@identity_bp.route("/identity/login")
def login():
    """
    Redirect to Dynamic auth. After login, Dynamic redirects back
    to the redirect_uri with a JWT token.
    Used by `be join` — opens browser to this URL.
    """
    redirect_uri = request.args.get("redirect_uri", "http://localhost:9876/callback")
    dynamic_url = f"https://app.dynamic.xyz/connect/{DYNAMIC_ENV_ID}?redirect_uri={redirect_uri}"
    return redirect(dynamic_url)


@identity_bp.route("/identity/onboard", methods=["POST"])
def onboard():
    """
    Create or retrieve identity.
    Body: { "external_id": "github:12345" } or { "external_id": "machine:abc" }
    """
    body = request.json or {}
    external_id = body.get("external_id")
    if not external_id:
        return jsonify({"error": "external_id required"}), 400

    # Get/create Dynamic identity
    user = call_dynamic("get-user", external_id)
    if "error" in user:
        user = call_dynamic("create-user", external_id)
    if "error" in user:
        return jsonify(user), 500

    wallets = user.get("wallets", [])
    evm = next((w for w in wallets if w.get("chain") == "EVM"), None)

    if not evm:
        # Create wallet
        call_dynamic("create-wallet", user["userId"])
        user = call_dynamic("get-user", external_id)
        wallets = user.get("wallets", [])
        evm = next((w for w in wallets if w.get("chain") == "EVM"), None)

    address = evm["address"] if evm else None

    return jsonify({
        "external_id": external_id,
        "dynamic_user_id": user.get("userId"),
        "wallet": address,
        "ens": None,  # assigned after on-chain registration
        "roles": ["staker", "solver"],
    })


@identity_bp.route("/identity/<int:agent_id>")
def agent_status(agent_id: int):
    """Full agent status — wallet, balances, ENS, roles."""
    try:
        wallet = get_agent_wallet(agent_id)
    except Exception:
        return jsonify({"error": "agent not found"}), 404

    zero = "0x0000000000000000000000000000000000000000"
    if wallet == zero:
        return jsonify({"error": "agent not found"}), 404

    bal = eurc_balance(wallet)
    native = w3.eth.get_balance(w3.to_checksum_address(wallet)) / 1e18

    return jsonify({
        "agent_id": agent_id,
        "wallet": wallet,
        "ens": f"agent-{agent_id}.maceip.eth",
        "balances": {
            "eurc": f"{bal:.2f}",
            "native": f"{native:.4f}",
        },
        "escrow": ESCROW,
        "can_stake": bal > 0,
        "can_solve": True,
    })
