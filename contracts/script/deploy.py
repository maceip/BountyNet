"""Deploy BountyNet to Arc Testnet.

Usage:
  mox run deploy --network arc-testnet-public
"""
import boa
import os
import json
from eth_account import Account

EURC_ARC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"


def deploy():
    pk = os.environ.get("DEPLOYER_PRIVATE_KEY")
    if not pk:
        raise ValueError("Set DEPLOYER_PRIVATE_KEY in .env")

    deployer = Account.from_key(pk)
    treasury = os.environ.get("TREASURY_ADDRESS", deployer.address)

    print(f"Deployer:  {deployer.address}")
    print(f"Treasury:  {treasury}")
    print(f"EURC:      {EURC_ARC}")

    boa.env.add_account(deployer)

    print("\n[1/3] Deploying IdentityRegistry...")
    identity = boa.load("src/IdentityRegistry.vy")
    print(f"  IdentityRegistry: {identity.address}")

    print("[2/3] Deploying ValidationRegistry...")
    validation = boa.load("src/ValidationRegistry.vy", identity.address)
    print(f"  ValidationRegistry: {validation.address}")

    print("[3/3] Deploying BountyEscrow...")
    escrow = boa.load(
        "src/BountyEscrow.vy",
        identity.address,
        validation.address,
        EURC_ARC,
        treasury,
        7000,
        3000,
    )
    print(f"  BountyEscrow: {escrow.address}")

    addresses = {
        "network": "arc-testnet",
        "chain_id": 5042002,
        "deployer": deployer.address,
        "identity_registry": identity.address,
        "validation_registry": validation.address,
        "bounty_escrow": escrow.address,
        "eurc": EURC_ARC,
        "treasury": treasury,
    }

    print("\n=== DEPLOYMENT COMPLETE ===")
    for k, v in addresses.items():
        print(f"  {k}: {v}")

    with open("deployments.json", "w") as f:
        json.dump(addresses, f, indent=2)
    print("\nSaved to deployments.json")

    return addresses


def moccasin_main():
    return deploy()
