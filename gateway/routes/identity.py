"""
Identity routes — canonical onboarding + status.

Canonical flow:
  verified Dynamic auth -> POST /identity/onboard -> Dynamic EVM wallet ->
  Arc EIP-8004 agent mint/transfer -> return agent_id + wallet + ENS.

POST /identity/onboard                  — canonical onboarding operation
POST /identity/android-attestation/bind — link verified leaf SPKI to an existing agent
GET  /identity/<agent_id>               — wallet, balances, ENS name, roles, android_attestations
"""
import os
import json
import hashlib
import secrets
import subprocess
import time
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse
from flask import Blueprint, request, jsonify
from eth_abi import encode as abi_encode
from eth_account import Account
from gateway.chain import (
    agent_fqdn,
    get_agent_wallet,
    eurc_balance,
    get_next_agent_id,
    native_balance,
    ESCROW,
    send_tx,
    sig,
    IDENTITY,
)
from gateway.events import emit
from gateway.auth import require_auth, verify_dynamic_jwt
from gateway.routes.android_key_attestation import (
    list_android_spki_bindings,
    record_android_spki_binding,
    verify_and_consume_bind_token,
)

APP_REDIRECT_DEFAULT = os.environ.get("APP_REDIRECT_URL", "https://bountynet.stare.network/")
GATEWAY_PUBLIC_URL = os.environ.get("GATEWAY_PUBLIC_URL", "https://gateway.stare.network")

identity_bp = Blueprint("identity", __name__)
RELAYER_ADDRESS = Account.from_key(os.environ.get("DEPLOYER_PRIVATE_KEY", "")).address if os.environ.get("DEPLOYER_PRIVATE_KEY") else None

# identity_anchor -> {"created": bool, "wallets": list, "uid": str} — soak Dynamic stub only
_soak_dynamic_users: dict[str, dict] = {}
# create-wallet is called with Dynamic userId, not identity_anchor — map back
_soak_uid_to_anchor: dict[str, str] = {}
_cli_sessions: dict[str, dict] = {}
CLI_SESSION_TTL_SECONDS = int(os.environ.get("BOUNTYNET_CLI_SESSION_TTL_SECONDS", "600"))


def reset_soak_dynamic_state() -> None:
    """Test harness only — clears in-process Dynamic stub state."""
    _soak_dynamic_users.clear()
    _soak_uid_to_anchor.clear()


def _prune_cli_sessions() -> None:
    now = time.time()
    expired = [sid for sid, session in _cli_sessions.items() if session.get("expires_at", 0) <= now]
    for sid in expired:
        _cli_sessions.pop(sid, None)


def _cli_auth_url(app_url: str, session_id: str) -> str:
    base = app_url.rstrip("/") or APP_REDIRECT_DEFAULT.rstrip("/")
    return append_query(
        f"{base}/auth/cli",
        {
            "session_id": session_id,
        },
    )


def call_dynamic(cmd: str, arg: str) -> dict:
    if os.environ.get("BOUNTYNET_SOAK_MODE", "").lower() in ("1", "true", "yes"):
        return _soak_dynamic_stub(cmd, arg)
    bridge = os.path.join(os.path.dirname(__file__), "..", "..", "services", "wallet", "dynamic_bridge.mjs")
    result = subprocess.run(
        ["node", bridge, cmd, arg],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        return {"error": result.stderr.strip()}
    return json.loads(result.stdout)


def _soak_dynamic_stub(cmd: str, arg: str) -> dict:
    """Minimal Dynamic-shaped responses for end-to-end soak tests (no Node SDK)."""
    addr = os.environ.get(
        "BOUNTYNET_SOAK_WALLET",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    )

    def _uid_for_anchor(anchor: str) -> str:
        h = int(hashlib.sha256(anchor.encode()).hexdigest(), 16)
        return f"soak-{h % 1_000_000_000}"

    if cmd == "get-user":
        bucket = _soak_dynamic_users.setdefault(arg, {"created": False, "wallets": [], "uid": ""})
        if not bucket["created"]:
            return {"error": "not_found"}
        uid = bucket.get("uid") or _uid_for_anchor(arg)
        return {"userId": uid, "wallets": bucket["wallets"]}

    if cmd == "create-user":
        bucket = _soak_dynamic_users.setdefault(arg, {"created": False, "wallets": [], "uid": ""})
        uid = _uid_for_anchor(arg)
        bucket["uid"] = uid
        _soak_uid_to_anchor[uid] = arg
        bucket["created"] = True
        bucket["wallets"] = []
        return {"userId": uid, "wallets": []}

    if cmd == "create-wallet":
        anchor = _soak_uid_to_anchor.get(arg)
        if not anchor:
            return {"error": "unknown_user"}
        bucket = _soak_dynamic_users.setdefault(anchor, {"created": False, "wallets": [], "uid": arg})
        bucket["wallets"] = [{"address": addr, "chain": "EVM"}]
        return {"wallet": bucket["wallets"][0]}

    return {"error": f"unknown soak dynamic cmd: {cmd}"}


def derive_identity_anchor(claims: dict) -> str | None:
    """
    Derive a stable Dynamic anchor from verified claims.
    """
    sub = claims.get("sub")
    email = claims.get("email")

    if sub and sub != "dev":
        if str(sub).startswith("dynamic:"):
            return str(sub)
        return f"dynamic:{sub}"
    if email:
        return f"email:{str(email).strip().lower()}"
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
    identity_anchor = derive_identity_anchor(claims)
    if not identity_anchor:
        return None, None
    user = call_dynamic("get-user", identity_anchor)
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
    identity_anchor = derive_identity_anchor(claims)
    if not identity_anchor:
        raise ValueError("could not derive identity anchor")

    user = call_dynamic("get-user", identity_anchor)
    if "error" in user:
        user = call_dynamic("create-user", identity_anchor)
    if "error" in user:
        raise RuntimeError(user["error"])

    wallets = user.get("wallets", [])
    evm = next((w for w in wallets if w.get("chain") == "EVM"), None)

    if not evm:
        call_dynamic("create-wallet", user["userId"])
        user = call_dynamic("get-user", identity_anchor)
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
            ens_name = agent_fqdn(agent_id)

    emit(
        "agent",
        f"Agent onboarded: {identity_anchor} → {address[:10]}... (agent #{agent_id})"
        if address
        else f"Agent onboarded: {identity_anchor}",
        agent_id=agent_id,
        data={"identity_anchor": identity_anchor, "wallet": address},
    )

    return {
        "identity_anchor": identity_anchor,
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


@identity_bp.route("/identity/cli/sessions", methods=["POST"])
def create_cli_session():
    """
    Canonical CLI auth adapter.
    Creates a short-lived browser auth session that `be join` can poll.
    """
    _prune_cli_sessions()
    body = request.json or {}
    app_url = str(body.get("app_url") or APP_REDIRECT_DEFAULT).strip()
    session_id = secrets.token_urlsafe(24)
    expires_at = int(time.time() + CLI_SESSION_TTL_SECONDS)
    _cli_sessions[session_id] = {
        "status": "pending",
        "created_at": int(time.time()),
        "expires_at": expires_at,
    }
    return jsonify(
        {
            "session_id": session_id,
            "status": "pending",
            "auth_url": _cli_auth_url(app_url, session_id),
            "poll_url": f"{GATEWAY_PUBLIC_URL.rstrip('/')}/identity/cli/sessions/{session_id}",
            "expires_at": expires_at,
        }
    ), 201


@identity_bp.route("/identity/cli/sessions/<session_id>")
def get_cli_session(session_id: str):
    """
    Poll the canonical CLI auth adapter session.
    Completed sessions are one-shot and removed after first successful read.
    """
    _prune_cli_sessions()
    session = _cli_sessions.get(session_id)
    if not session:
        return jsonify({"error": "session not found or expired"}), 404

    if session.get("status") != "complete":
        return jsonify(
            {
                "session_id": session_id,
                "status": session.get("status", "pending"),
                "expires_at": session.get("expires_at"),
            }
        )

    payload = dict(session)
    payload["session_id"] = session_id
    _cli_sessions.pop(session_id, None)
    return jsonify(payload)


@identity_bp.route("/identity/cli/sessions/<session_id>/complete", methods=["POST"])
@require_auth
def complete_cli_session(session_id: str):
    """
    Browser-side completion for the canonical CLI auth adapter.
    The caller must already hold a verified Dynamic JWT and must supply the
    result returned by POST /identity/onboard.
    """
    _prune_cli_sessions()
    session = _cli_sessions.get(session_id)
    if not session:
        return jsonify({"error": "session not found or expired"}), 404

    token = request.headers.get("Authorization", "")
    if not token.startswith("Bearer "):
        return jsonify({"error": "authorization bearer token required"}), 401

    body = request.json or {}
    agent_id = body.get("agent_id")
    if not agent_id:
        return jsonify({"error": "agent_id required"}), 400

    session.update(
        {
            "status": "complete",
            "completed_at": int(time.time()),
            "token": token[7:],
            "agent_id": agent_id,
            "wallet": body.get("wallet") or "",
            "ens": body.get("ens") or "",
            "identity_anchor": body.get("identity_anchor") or "",
        }
    )
    return jsonify({"status": "complete", "session_id": session_id, "agent_id": agent_id})


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
    The gateway derives the stable identity anchor from verified claims.
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
    The linked wallet can receive gasless token transfers via Circle's paymaster when enabled.

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
        "ens": agent_fqdn(agent_id),
        "balances": {
            "eurc": f"{bal:.2f}",
            "native": f"{native:.4f}",
        },
        "escrow": ESCROW,
        "can_stake": bal > 0,
        "can_solve": True,
        "android_attestations": list_android_spki_bindings(agent_id),
    })
