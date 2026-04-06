"""
Identity routes — onboarding + status.

POST /identity/onboard   — create Dynamic identity, check EIP-8004 registration
POST /identity/android-attestation/bind — link verified leaf SPKI (bind_token from /attest/android-key/verify)
GET  /identity/<agent_id> — wallet, balances, ENS name, roles, android_attestations
"""
import os
import json
import subprocess
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse
from flask import Blueprint, request, jsonify, redirect
from eth_abi import encode as abi_encode
from eth_account import Account
from gateway.chain import get_agent_wallet, eurc_balance, get_next_agent_id, native_balance, ESCROW, send_tx, sig, IDENTITY
from gateway.events import emit
from gateway.auth import require_auth, verify_dynamic_jwt
from gateway.routes.android_key_attestation import (
    list_android_spki_bindings,
    record_android_spki_binding,
    verify_and_consume_bind_token,
)

DYNAMIC_ENV_ID = os.environ.get("DYNAMIC_ENV_ID", "")
APP_REDIRECT_DEFAULT = os.environ.get("APP_REDIRECT_URL", "https://bountynet.stare.network/")
GATEWAY_PUBLIC_URL = os.environ.get("GATEWAY_PUBLIC_URL", "https://gateway.stare.network")

identity_bp = Blueprint("identity", __name__)
RELAYER_ADDRESS = Account.from_key(os.environ.get("DEPLOYER_PRIVATE_KEY", "")).address if os.environ.get("DEPLOYER_PRIVATE_KEY") else None


def call_dynamic(cmd: str, arg: str) -> dict:
    bridge = os.path.join(os.path.dirname(__file__), "..", "..", "wallet", "dynamic_bridge.mjs")
    result = subprocess.run(
        ["node", bridge, cmd, arg],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        return {"error": result.stderr.strip()}
    return json.loads(result.stdout)


def derive_external_id(claims: dict, body: dict) -> str | None:
    """
    Derive a stable Dynamic anchor from verified claims.
    We only fall back to caller-provided external_id in local/dev mode.
    """
    sub = claims.get("sub")
    email = claims.get("email")

    if sub and sub != "dev":
        return f"dynamic:{sub}"
    if email:
        return f"email:{str(email).strip().lower()}"

    # Dev/test fallback only.
    external_id = body.get("external_id")
    if external_id:
        return str(external_id)
    return None


def find_agent_id_by_wallet(address: str) -> int | None:
    next_id = get_next_agent_id()
    for i in range(1, min(next_id, 500)):
        try:
            w = get_agent_wallet(i)
        except Exception:
            continue
        if w and w.lower() == address.lower():
            return i
    return None


def resolve_wallet_and_agent(claims: dict) -> tuple[str | None, int | None]:
    """
    EVM wallet + existing on-chain agent id for this Dynamic user.
    Does not create users, wallets, or mint agents (use POST /identity/onboard for that).
    """
    body: dict = {}
    external_id = derive_external_id(claims, body)
    if not external_id:
        return None, None
    user = call_dynamic("get-user", external_id)
    if "error" in user:
        return None, None
    wallets = user.get("wallets", [])
    evm = next((w for w in wallets if w.get("chain") == "EVM"), None)
    address = (evm or {}).get("address")
    if not address:
        return None, None
    agent_id = find_agent_id_by_wallet(str(address))
    return str(address), agent_id


def register_agent_for_wallet(wallet: str, agent_uri: str) -> tuple[int | None, list[dict]]:
    """
    Mint a new EIP-8004 agent from the relayer and transfer it to the user wallet.
    Because get_agent_wallet() defaults to ownerOf(agent_id), the transferred NFT
    immediately resolves to the user's wallet without an extra set_agent_wallet call.
    """
    if not IDENTITY:
        raise RuntimeError("identity registry not configured")
    if not RELAYER_ADDRESS:
        raise RuntimeError("relayer key not configured")

    txs: list[dict] = []
    start_id = get_next_agent_id()

    register_data = "0x" + (
        sig("register(string)")
        + abi_encode(["string"], [agent_uri])
    ).hex()
    txs.append(send_tx(IDENTITY, register_data))

    agent_id = start_id

    transfer_data = "0x" + (
        sig("transferFrom(address,address,uint256)")
        + abi_encode(["address", "address", "uint256"], [RELAYER_ADDRESS, wallet, agent_id])
    ).hex()
    txs.append(send_tx(IDENTITY, transfer_data))

    resolved_wallet = get_agent_wallet(agent_id)
    if resolved_wallet.lower() != wallet.lower():
        raise RuntimeError(f"agent transfer verification failed: expected {wallet}, got {resolved_wallet}")

    return agent_id, txs


def append_query(url: str, params: dict[str, str]) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update({k: v for k, v in params.items() if v is not None})
    return urlunparse(parsed._replace(query=urlencode(query)))


def onboard_identity(body: dict, claims: dict) -> dict:
    external_id = derive_external_id(claims, body)
    if not external_id:
        raise ValueError("could not derive external identity")

    user = call_dynamic("get-user", external_id)
    if "error" in user:
        user = call_dynamic("create-user", external_id)
    if "error" in user:
        raise RuntimeError(user["error"])

    wallets = user.get("wallets", [])
    evm = next((w for w in wallets if w.get("chain") == "EVM"), None)

    if not evm:
        call_dynamic("create-wallet", user["userId"])
        user = call_dynamic("get-user", external_id)
        wallets = user.get("wallets", [])
        evm = next((w for w in wallets if w.get("chain") == "EVM"), None)

    address = evm["address"] if evm else None

    agent_id = None
    ens_name = None
    txs: list[dict] = []
    if address:
        agent_id = find_agent_id_by_wallet(address)
        if agent_id is None:
            agent_uri = str(body.get("agent_uri") or "ipfs://bountynet-agent.json")
            agent_id, txs = register_agent_for_wallet(address, agent_uri)
        if agent_id is not None:
            ens_name = f"agent-{agent_id}.maceip.eth"

    emit("agent", f"Agent onboarded: {external_id} → {address[:10]}... (agent #{agent_id})" if address else f"Agent onboarded: {external_id}",
         agent_id=agent_id, data={"external_id": external_id, "wallet": address})

    return {
        "external_id": external_id,
        "identity_anchor": external_id,
        "claims_sub": claims.get("sub"),
        "dynamic_user_id": user.get("userId"),
        "agent_id": agent_id,
        "wallet": address,
        "ens": ens_name,
        "registered_on_chain": agent_id is not None,
        "identity_registry": IDENTITY,
        "txs": txs,
        "roles": ["staker", "solver"],
    }


@identity_bp.route("/identity/login")
def login():
    """
    Redirect to Dynamic auth. After login, Dynamic redirects back
    to the redirect_uri with a JWT token.
    Used by `be join` — opens browser to this URL.
    """
    redirect_uri = request.args.get("redirect_uri")
    app_redirect = request.args.get("app_redirect")
    if not redirect_uri and app_redirect:
        redirect_uri = f"{GATEWAY_PUBLIC_URL.rstrip('/')}/identity/complete?{urlencode({'app_redirect': app_redirect})}"
    if not redirect_uri:
        redirect_uri = "http://localhost:9876/callback"
    dynamic_url = f"https://app.dynamic.xyz/connect/{DYNAMIC_ENV_ID}?redirect_uri={redirect_uri}"
    return redirect(dynamic_url)


@identity_bp.route("/identity/complete")
def complete():
    token = request.args.get("token") or request.args.get("jwt")
    app_redirect = request.args.get("app_redirect") or APP_REDIRECT_DEFAULT
    if not token:
        return jsonify({"error": "missing token"}), 400

    claims = verify_dynamic_jwt(token)
    if not claims:
        return jsonify({"error": "invalid token"}), 401

    try:
        result = onboard_identity({}, claims)
    except Exception as e:
        return redirect(append_query(app_redirect, {"onboarding_error": str(e)}))

    return redirect(append_query(app_redirect, {
        "agent_id": str(result.get("agent_id") or ""),
        "ens": result.get("ens") or "",
        "wallet": result.get("wallet") or "",
    }))


@identity_bp.route("/identity/android-attestation/bind", methods=["POST"])
def bind_android_attestation():
    """
    Link a verified hardware attestation (leaf SPKI hash) to the signed-in agent.

    1) Complete POST /attest/android-key/challenge → …/verify (returns bind_token).
    2) Same client: Authorization: Bearer <Dynamic JWT>, body { "bind_token": "…" }.

    The Dynamic user must already have an on-chain agent (POST /identity/onboard first).
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth.startswith("Bearer bnet_"):
        return jsonify({"error": "Dynamic JWT required (Bearer token, not bnet_)"}), 401
    dynamic_jwt = auth[7:]
    claims = verify_dynamic_jwt(dynamic_jwt)
    if not claims:
        return jsonify({"error": "invalid token"}), 401

    body = request.json or {}
    bind_token = body.get("bind_token")
    if not bind_token or not isinstance(bind_token, str):
        return jsonify({"error": "bind_token required"}), 400

    spki_hex = verify_and_consume_bind_token(bind_token)
    if not spki_hex:
        return jsonify({"error": "invalid, expired, or reused bind_token"}), 400

    wallet, agent_id = resolve_wallet_and_agent(claims)
    if not agent_id:
        return jsonify(
            {
                "error": "no agent for this wallet — complete POST /identity/onboard first",
                "wallet": wallet,
            }
        ), 400

    record_android_spki_binding(agent_id, spki_hex)
    return jsonify(
        {
            "bound": True,
            "agent_id": agent_id,
            "leaf_spki_sha256_hex": spki_hex,
            "android_attestations": list_android_spki_bindings(agent_id),
        }
    )


@identity_bp.route("/identity/onboard", methods=["POST"])
@require_auth
def onboard():
    """
    Create or retrieve identity from a verified Dynamic JWT.
    The gateway derives the stable external_id from claims instead of trusting
    a caller-provided identifier.
    """
    body = request.json or {}
    claims = getattr(request, "auth_claims", {}) or {}
    try:
        return jsonify(onboard_identity(body, claims))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
    native = native_balance(wallet)

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
        "android_attestations": list_android_spki_bindings(agent_id),
    })
