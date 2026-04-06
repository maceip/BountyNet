"""Shared Web3 connection + contract helpers for all routes."""
import os
from web3 import Web3
from eth_account import Account
from eth_utils import keccak
from eth_abi import encode
from flask import jsonify

ARC_RPC = os.environ.get("QUICKNODE_ARC_HTTP", "https://rpc.testnet.arc.network")
ARC_RPC_FALLBACK = os.environ.get("ARC_RPC_FALLBACK", "https://rpc.testnet.arc.network")
w3 = Web3(Web3.HTTPProvider(ARC_RPC))
w3_fallback = Web3(Web3.HTTPProvider(ARC_RPC_FALLBACK))

ESCROW = os.environ.get("BOUNTY_ESCROW", "")
IDENTITY = os.environ.get("IDENTITY_REGISTRY", "")
VALIDATION = os.environ.get("VALIDATION_REGISTRY", "")
EURC = os.environ.get("EURC_ADDRESS", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a")
ORACLE_KEY = os.environ.get("DEPLOYER_PRIVATE_KEY", "")


def sig(s: str) -> bytes:
    return keccak(s.encode())[:4]


def call(to: str, data: str):
    checksum = w3.to_checksum_address(to)
    errors: list[str] = []
    for client in (w3, w3_fallback):
        try:
            return client.eth.call({"to": checksum, "data": data})
        except Exception as e:
            errors.append(str(e))
    raise RuntimeError(" | ".join(errors))


def current_block() -> tuple[int, str]:
    errors: list[str] = []
    for label, client in (("primary", w3), ("fallback", w3_fallback)):
        try:
            return client.eth.block_number, label
        except Exception as e:
            errors.append(str(e))
    raise RuntimeError(" | ".join(errors))


def native_balance(addr: str) -> float:
    checksum = w3.to_checksum_address(addr)
    errors: list[str] = []
    for client in (w3, w3_fallback):
        try:
            return client.eth.get_balance(checksum) / 1e18
        except Exception as e:
            errors.append(str(e))
    raise RuntimeError(" | ".join(errors))


def send_tx(to: str, data: str, key: str = ORACLE_KEY) -> dict:
    acct = Account.from_key(key)
    nonce = w3.eth.get_transaction_count(acct.address)
    tx = {
        "from": acct.address,
        "to": w3.to_checksum_address(to),
        "data": data,
        "nonce": nonce,
        "gasPrice": w3.eth.gas_price,
        "gas": 300000,
        "chainId": 5042002,
    }
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return {"tx": tx_hash.hex(), "status": receipt.status, "block": receipt.blockNumber}


def get_bounty(context_hash: bytes) -> dict | None:
    try:
        result = call(ESCROW, "0x" + (sig("get_bounty(bytes32)") + encode(["bytes32"], [context_hash])).hex())
        amount = int.from_bytes(result[32:64], 'big')
        if amount == 0:
            return None
        return {
            "creator": "0x" + result[12:32].hex(),
            "amount": amount,
            "deadline": int.from_bytes(result[64:96], 'big'),
            "solver_agent_id": int.from_bytes(result[96:128], 'big'),
            "resolved": int.from_bytes(result[128:160], 'big') != 0,
            "cancelled": int.from_bytes(result[160:192], 'big') != 0,
        }
    except Exception:
        return None


def get_agent_wallet(agent_id: int) -> str:
    result = call(IDENTITY, "0x" + (sig("get_agent_wallet(uint256)") + encode(["uint256"], [agent_id])).hex())
    return w3.to_checksum_address("0x" + result[-20:].hex())


def get_next_agent_id() -> int:
    result = call(IDENTITY, "0x" + sig("next_id()").hex())
    return int.from_bytes(result, 'big')


def eurc_balance(addr: str) -> float:
    result = call(EURC, "0x" + (sig("balanceOf(address)") + encode(["address"], [addr])).hex())
    return int.from_bytes(result, 'big') / 1e6


def get_health():
    try:
        block, source = current_block()
        agents = get_next_agent_id() - 1
        from gateway.store import db_path

        return jsonify({
            "status": "ok",
            "arc_block": block,
            "arc_rpc_source": source,
            "registered_agents": agents,
            "escrow": ESCROW,
            "identity": IDENTITY,
            "storage_db": db_path(),
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
