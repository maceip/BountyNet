"""
Identity routes — onboarding + status.

POST /identity/onboard   — create Dynamic identity, check EIP-8004 registration
GET  /identity/<agent_id> — wallet, balances, ENS name, roles
"""
import os
import json
import subprocess
from flask import Blueprint, request, jsonify, redirect
from gateway.chain import get_agent_wallet, eurc_balance, get_next_agent_id, w3, ESCROW, send_tx, sig, IDENTITY
from gateway.events import emit

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

    # Look up on-chain agent ID for this wallet
    agent_id = None
    ens_name = None
    if address:
        try:
            from eth_abi import encode as abi_encode
            next_id = get_next_agent_id()
            for i in range(1, min(next_id, 200)):
                w = get_agent_wallet(i)
                if w and w.lower() == address.lower():
                    agent_id = i
                    ens_name = f"agent-{i}.maceip.eth"
                    break
        except Exception:
            pass

    emit("agent", f"Agent onboarded: {external_id} → {address[:10]}... (agent #{agent_id})" if address else f"Agent onboarded: {external_id}",
         agent_id=agent_id, data={"external_id": external_id, "wallet": address})

    return jsonify({
        "external_id": external_id,
        "dynamic_user_id": user.get("userId"),
        "agent_id": agent_id,
        "wallet": address,
        "ens": ens_name,
        "roles": ["staker", "solver"],
    })


@identity_bp.route("/identity/<int:agent_id>/wallet", methods=["POST"])
def link_wallet(agent_id: int):
    """
    Link a Circle Smart Account (or any wallet) to an agent.
    After linking, bounty payouts go to this address instead of the Dynamic EOA.
    The linked wallet gets gasless EURC transfers via Circle's paymaster.

    Body: { "wallet": "0x..." }
    """
    body = request.json or {}
    wallet = body.get("wallet")
    if not wallet:
        return jsonify({"error": "wallet address required"}), 400

    if not IDENTITY:
        return jsonify({"error": "identity registry not configured"}), 500

    try:
        from eth_abi import encode as abi_encode
        data = "0x" + (
            sig("set_agent_wallet(uint256,address)")
            + abi_encode(["uint256", "address"], [agent_id, wallet])
        ).hex()
        result = send_tx(IDENTITY, data)

        emit("agent", f"Agent #{agent_id} wallet linked to Circle Smart Account {wallet[:10]}...",
             agent_id=agent_id, data={"wallet": wallet, "type": "circle_msca"})

        return jsonify({
            "status": "linked",
            "agent_id": agent_id,
            "wallet": wallet,
            "gasless": True,
            **result,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
