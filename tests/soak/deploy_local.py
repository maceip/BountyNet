"""Deploy MockEURC + BountyNet registries to a live JSON-RPC node (Anvil) using compiled artifacts."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from eth_account import Account
from web3 import Web3


def _load_artifact(root: Path, name: str) -> tuple[list, str]:
    path = root / "contracts" / "out" / f"{name}.json"
    if not path.is_file():
        raise FileNotFoundError(
            f"Missing {path} — run: cd contracts && mox compile",
        )
    data = json.loads(path.read_text())
    return data["abi"], data["bytecode"]


def _deploy(
    w3: Web3,
    acct: Account,
    abi: list,
    bytecode: str,
    *ctor_args: Any,
) -> str:
    c = w3.eth.contract(abi=abi, bytecode=bytecode)
    chain_id = w3.eth.chain_id
    gas_price = w3.eth.gas_price
    tx = c.constructor(*ctor_args).build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gas": 5_000_000,
            "gasPrice": gas_price,
            "chainId": chain_id,
        }
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt["status"] != 1:
        raise RuntimeError(f"deploy failed tx={tx_hash.hex()}")
    addr = receipt["contractAddress"]
    if not addr:
        raise RuntimeError("missing contractAddress")
    return Web3.to_checksum_address(addr)


def _send_fn(
    w3: Web3,
    acct: Account,
    contract: Any,
    fn_name: str,
    *args: Any,
    gas: int = 500_000,
) -> None:
    chain_id = w3.eth.chain_id
    fn = getattr(contract.functions, fn_name)
    tx = fn(*args).build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gas": gas,
            "gasPrice": w3.eth.gas_price,
            "chainId": chain_id,
        }
    )
    signed = acct.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h)
    if r["status"] != 1:
        raise RuntimeError(f"{fn_name} failed tx={h.hex()}")


def deploy_soak_stack(repo_root: Path, rpc_url: str, private_key: str) -> dict[str, str]:
    """
    Deploy MockEURC, IdentityRegistry, ValidationRegistry, BountyEscrow.
    Mints EURC to deployer and approves escrow for create_bounty.
    """
    subprocess.run(
        [sys.executable, "-m", "moccasin", "compile", "-q"],
        cwd=repo_root / "contracts",
        check=True,
    )

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    acct = Account.from_key(private_key)

    abis: dict[str, list] = {}
    bc: dict[str, str] = {}
    for name in ("MockEURC", "IdentityRegistry", "ValidationRegistry", "BountyEscrow"):
        a, b = _load_artifact(repo_root, name)
        abis[name] = a
        bc[name] = b

    eurc = _deploy(w3, acct, abis["MockEURC"], bc["MockEURC"])
    identity = _deploy(w3, acct, abis["IdentityRegistry"], bc["IdentityRegistry"])
    validation = _deploy(
        w3,
        acct,
        abis["ValidationRegistry"],
        bc["ValidationRegistry"],
        identity,
    )
    treasury = acct.address
    escrow = _deploy(
        w3,
        acct,
        abis["BountyEscrow"],
        bc["BountyEscrow"],
        identity,
        validation,
        eurc,
        treasury,
        7_000,
        3_000,
    )

    eurc_c = w3.eth.contract(address=eurc, abi=abis["MockEURC"])
    mint_amt = 10**12 * 10**6  # 1M tokens * 6 decimals scale upper bound
    _send_fn(w3, acct, eurc_c, "mint", acct.address, mint_amt, gas=300_000)
    max_u256 = 2**256 - 1
    _send_fn(w3, acct, eurc_c, "approve", escrow, max_u256, gas=300_000)

    return {
        "eurc": eurc,
        "identity_registry": identity,
        "validation_registry": validation,
        "bounty_escrow": escrow,
        "deployer": acct.address,
        "chain_id": str(w3.eth.chain_id),
    }
