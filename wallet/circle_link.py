"""
Circle Smart Account linking — gasless EURC for both stakers and solvers.

After Dynamic creates the identity (EOA), Circle provides the settlement layer:
  - Smart Account (MSCA) on Arc for gasless tx
  - Paymaster sponsors gas for bounty operations
  - EURC transfers without users needing native tokens

Architecture:
  Dynamic EOA (owns EIP-8004 NFT)
       ↓ setAgentWallet()
  Circle Smart Account (receives EURC payouts)
       ↓ paymaster: true
  Gasless bounty operations on Arc

Two common integration modes:
  1. Frontend (browser): Circle Modular Wallet + passkey
  2. Backend (headless): Direct EOA with relayer-sponsored gas
"""
import os
import json
from web3 import Web3
from eth_account import Account
from eth_utils import keccak
from eth_abi import encode
from pathlib import Path

BOUNTYNET_DIR = Path(__file__).parent.parent
DEPLOYMENTS = {}
if (BOUNTYNET_DIR / "deployments.json").exists():
    DEPLOYMENTS = json.loads((BOUNTYNET_DIR / "deployments.json").read_text())

ARC_RPC = os.environ.get("QUICKNODE_ARC_HTTP", "https://rpc.testnet.arc.network")

# Arc Testnet contract addresses
EURC = DEPLOYMENTS.get("eurc", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a")
USDC = "0x3600000000000000000000000000000000000000"  # Arc native USDC


def link_circle_wallet(
    agent_id: int,
    circle_smart_account: str,
    owner_key: str,
) -> str:
    """
    Set the Circle Smart Account as the agent's payment wallet.

    This means bounty payouts go to the gasless Circle wallet,
    not the Dynamic EOA.

    Args:
        agent_id: EIP-8004 identity token ID
        circle_smart_account: Circle MSCA address on Arc
        owner_key: Private key of the identity NFT owner

    Returns: tx hash
    """
    w3 = Web3(Web3.HTTPProvider(ARC_RPC))
    owner = Account.from_key(owner_key)
    registry = DEPLOYMENTS["identity_registry"]

    sig = keccak(b"set_agent_wallet(uint256,address)")[:4]
    data = "0x" + (sig + encode(
        ["uint256", "address"],
        [agent_id, circle_smart_account]
    )).hex()

    nonce = w3.eth.get_transaction_count(owner.address)
    tx = {
        "from": owner.address,
        "to": w3.to_checksum_address(registry),
        "data": data,
        "nonce": nonce,
        "gasPrice": w3.eth.gas_price,
        "gas": 100000,
        "chainId": 5042002,
    }
    signed = owner.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    print(f"Agent #{agent_id} wallet → {circle_smart_account}")
    print(f"  tx: {tx_hash.hex()}")
    return tx_hash.hex()


def get_agent_wallet(agent_id: int) -> str:
    """Get the current payment wallet for an agent."""
    w3 = Web3(Web3.HTTPProvider(ARC_RPC))
    registry = DEPLOYMENTS["identity_registry"]

    sig = keccak(b"get_agent_wallet(uint256)")[:4]
    result = w3.eth.call({
        "to": w3.to_checksum_address(registry),
        "data": "0x" + (sig + encode(["uint256"], [agent_id])).hex()
    })
    return w3.to_checksum_address("0x" + result[-20:].hex())


def check_eurc_balance(address: str) -> float:
    """Check EURC balance on Arc Testnet."""
    w3 = Web3(Web3.HTTPProvider(ARC_RPC))
    sig = keccak(b"balanceOf(address)")[:4]
    result = w3.eth.call({
        "to": w3.to_checksum_address(EURC),
        "data": "0x" + (sig + encode(["address"], [address])).hex()
    })
    return int.from_bytes(result, 'big') / 1e6


def approve_eurc(spender: str, amount: int, signer_key: str) -> str:
    """Approve EURC spend (for stakers creating bounties)."""
    w3 = Web3(Web3.HTTPProvider(ARC_RPC))
    signer = Account.from_key(signer_key)

    sig = keccak(b"approve(address,uint256)")[:4]
    data = "0x" + (sig + encode(["address", "uint256"], [spender, amount])).hex()

    nonce = w3.eth.get_transaction_count(signer.address)
    tx = {
        "from": signer.address,
        "to": w3.to_checksum_address(EURC),
        "data": data,
        "nonce": nonce,
        "gasPrice": w3.eth.gas_price,
        "gas": 100000,
        "chainId": 5042002,
    }
    signed = signer.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex()


# ── Wallet status dashboard ─────────────────────────────────────

def wallet_status(agent_id: int) -> dict:
    """
    Full wallet status for an agent — both Dynamic (identity) and Circle (settlement).
    """
    wallet = get_agent_wallet(agent_id)
    eurc_bal = check_eurc_balance(wallet)

    w3 = Web3(Web3.HTTPProvider(ARC_RPC))
    native_bal = w3.eth.get_balance(w3.to_checksum_address(wallet)) / 1e18

    return {
        "agent_id": agent_id,
        "ens": f"agent-{agent_id}.maceip.eth",
        "wallet": wallet,
        "balances": {
            "eurc": f"{eurc_bal:.2f}",
            "usdc_native": f"{native_bal:.4f}",
        },
        "escrow": DEPLOYMENTS.get("bounty_escrow"),
        "can_stake": eurc_bal > 0,
        "can_solve": True,  # anyone can solve
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python circle_link.py status <agent_id>")
        print("  python circle_link.py link <agent_id> <circle_address> <owner_key>")
        print("  python circle_link.py balance <address>")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "status":
        print(json.dumps(wallet_status(int(sys.argv[2])), indent=2))
    elif cmd == "balance":
        print(f"{check_eurc_balance(sys.argv[2]):.2f} EURC")
    elif cmd == "link":
        link_circle_wallet(int(sys.argv[2]), sys.argv[3], sys.argv[4])
