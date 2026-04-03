"""
BountyNet unified onboarding — one identity, both roles.

A user gets ONE Dynamic wallet. They can:
  - Stake bounties (staker role)
  - Solve bounties (solver role)
  - Do both simultaneously

Flow:
  1. GitHub App installed OR `sleeve join` CLI
     → triggers onboard(external_id)
  2. Dynamic creates/retrieves embedded wallet
  3. If not registered on EIP-8004 Identity Registry → register
  4. Set agent wallet to Circle Smart Account (if available)
  5. User is ready to stake AND solve

The external_id is the anchor:
  - GitHub install: "github:<github_user_id>"
  - CLI join:       "machine:<machine_id_hash>"
  - Web login:      "email:<email>" or "github:<id>" (Dynamic handles this)

All three resolve to the SAME Dynamic user if the external IDs are linked.
"""
import json
import subprocess
import os
from pathlib import Path
from web3 import Web3
from eth_account import Account
from eth_utils import keccak
from eth_abi import encode

# Load config
BOUNTYNET_DIR = Path(__file__).parent.parent
DEPLOYMENTS = {}
if (BOUNTYNET_DIR / "deployments.json").exists():
    DEPLOYMENTS = json.loads((BOUNTYNET_DIR / "deployments.json").read_text())

ARC_RPC = os.environ.get("QUICKNODE_ARC_HTTP", "https://rpc.testnet.arc.network")


def call_dynamic(cmd: str, arg: str) -> dict:
    """Call the Dynamic Node SDK bridge."""
    result = subprocess.run(
        ["node", str(BOUNTYNET_DIR / "wallet" / "dynamic_bridge.mjs"), cmd, arg],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Dynamic bridge error: {result.stderr}")
    return json.loads(result.stdout)


def get_or_create_identity(external_id: str) -> dict:
    """
    Get or create a Dynamic identity for this user.
    Returns: { userId, externalId, wallets: [{ address, chain }] }
    """
    # Try to get existing user + wallets
    user = call_dynamic("get-user", external_id)

    if not user.get("wallets"):
        # Create wallet if user has none
        wallet = call_dynamic("create-wallet", user["userId"])
        user = call_dynamic("get-user", external_id)

    return user


def ensure_registered(wallet_address: str, agent_uri: str = "") -> int | None:
    """
    Check if address has an EIP-8004 identity. If not, register.
    Returns agent_id or None if registration fails.
    """
    if not DEPLOYMENTS.get("identity_registry"):
        print("  No identity registry deployed")
        return None

    w3 = Web3(Web3.HTTPProvider(ARC_RPC))
    registry = DEPLOYMENTS["identity_registry"]

    # Check balance (ownerOf would revert for non-existent, use balanceOf)
    bal_sig = keccak(b"balanceOf(address)")[:4]
    result = w3.eth.call({
        "to": w3.to_checksum_address(registry),
        "data": "0x" + (bal_sig + encode(["address"], [wallet_address])).hex()
    })
    balance = int.from_bytes(result, 'big')

    if balance > 0:
        # Already registered — find their agent ID
        # (In production, use events/subgraph. For hackathon, scan IDs.)
        next_id_sig = keccak(b"next_id()")[:4]
        result = w3.eth.call({"to": registry, "data": "0x" + next_id_sig.hex()})
        next_id = int.from_bytes(result, 'big')

        owner_sig = keccak(b"ownerOf(uint256)")[:4]
        for i in range(1, next_id):
            result = w3.eth.call({
                "to": registry,
                "data": "0x" + (owner_sig + encode(["uint256"], [i])).hex()
            })
            owner = "0x" + result[-20:].hex()
            if owner.lower() == wallet_address.lower():
                return i

    # Not registered — would need gas to register on-chain
    # Return None and let the caller handle registration tx
    return None


def onboard(external_id: str, agent_uri: str = "ipfs://bountynet-agent.json") -> dict:
    """
    Full onboarding flow:
    1. Create/get Dynamic identity
    2. Check EIP-8004 registration
    3. Return ready-to-use identity

    Returns:
    {
        "external_id": "github:12345",
        "dynamic_user_id": "uuid",
        "wallet_address": "0x...",
        "agent_id": 1 or None (if not yet registered on-chain),
        "roles": ["staker", "solver"],
        "chains": { "arc_testnet": { ... } }
    }
    """
    print(f"Onboarding: {external_id}")

    # Step 1: Dynamic identity
    print("  [1] Dynamic identity...")
    identity = get_or_create_identity(external_id)
    evm_wallets = [w for w in identity.get("wallets", []) if w.get("chain") == "EVM"]

    if not evm_wallets:
        return {"error": "No EVM wallet created", "identity": identity}

    wallet_address = evm_wallets[0]["address"]
    print(f"      Wallet: {wallet_address}")

    # Step 2: Check on-chain registration
    print("  [2] EIP-8004 registration...")
    agent_id = ensure_registered(wallet_address, agent_uri)
    if agent_id:
        print(f"      Already registered: Agent #{agent_id}")
    else:
        print(f"      Not registered (needs on-chain tx)")

    # Step 3: Build result
    result = {
        "external_id": external_id,
        "dynamic_user_id": identity.get("userId"),
        "wallet_address": wallet_address,
        "agent_id": agent_id,
        "roles": ["staker", "solver"],  # everyone can do both
        "ens_name": f"agent-{agent_id}.maceip.eth" if agent_id else None,
        "chains": {
            "arc_testnet": {
                "chain_id": 5042002,
                "rpc": ARC_RPC,
                "escrow": DEPLOYMENTS.get("bounty_escrow"),
                "identity_registry": DEPLOYMENTS.get("identity_registry"),
                "eurc": DEPLOYMENTS.get("eurc"),
            }
        }
    }

    print(f"  [3] Ready!")
    print(f"      ENS: {result['ens_name'] or 'pending registration'}")
    print(f"      Roles: staker + solver")

    return result


# ── GitHub App webhook handler ──────────────────────────────────

def handle_github_install(payload: dict) -> dict:
    """
    Called when BountyNet GitHub App is installed.
    payload = GitHub webhook 'installation.created' body.
    """
    github_id = payload["installation"]["account"]["id"]
    github_login = payload["installation"]["account"]["login"]
    external_id = f"github:{github_id}"

    print(f"GitHub App installed by {github_login} (ID: {github_id})")
    return onboard(external_id)


def handle_ci_failure(payload: dict) -> dict:
    """
    Called when CI fails on a monitored repo.
    Returns context needed to create a bounty.
    """
    repo = payload.get("repository", {}).get("full_name", "")
    sha = payload.get("head_commit", {}).get("id", "")[:8]
    job = payload.get("check_run", {}).get("name", "build")
    failure = payload.get("check_run", {}).get("conclusion", "failure")

    context_hash = keccak(f"{repo}:{sha}:{job}:{failure}".encode())

    return {
        "context_hash": "0x" + context_hash.hex(),
        "repo": repo,
        "commit": sha,
        "job": job,
        "failure": failure,
        "context_uri": f"https://github.com/{repo}/actions",
    }


# ── CLI entry point ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python onboard.py <external_id>")
        print("  e.g.: python onboard.py github:12345")
        print("  e.g.: python onboard.py machine:$(hostname)")
        sys.exit(1)

    result = onboard(sys.argv[1])
    print("\n" + json.dumps(result, indent=2))
