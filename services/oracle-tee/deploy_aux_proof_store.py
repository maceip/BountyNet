"""Deploy OracleProofStore to an auxiliary EVM network (operator script).

Requires ORACLE_AUX_CHAIN_RPC and ORACLE_KEY. Optional: ORACLE_AUX_CHAIN_ID (default 114).
"""
import os
import json
from web3 import Web3
from eth_account import Account
from solcx import compile_source, install_solc

AUX_RPC = os.environ.get("ORACLE_AUX_CHAIN_RPC", os.environ.get("COSTON2_RPC", ""))
ORACLE_AUX_CHAIN_ID = int(os.environ.get("ORACLE_AUX_CHAIN_ID", "114"))
ORACLE_KEY = os.environ.get("ORACLE_KEY", "")
if not AUX_RPC or not ORACLE_KEY:
    raise SystemExit("Set ORACLE_AUX_CHAIN_RPC and ORACLE_KEY")

SOURCE = """
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OracleProofStore {
    struct Proof {
        address signer;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 timestamp;
        string repo;
        string checkName;
    }

    mapping(bytes32 => Proof) public proofs;
    bytes32[] public proofHashes;
    address public owner;
    address public teeSigner;

    event ProofStored(bytes32 indexed validationHash, address signer, string repo, uint256 timestamp);
    event TeeSignerUpdated(address newSigner);

    constructor(address _teeSigner) {
        owner = msg.sender;
        teeSigner = _teeSigner;
    }

    function setTeeSigner(address _signer) external {
        require(msg.sender == owner, "not owner");
        teeSigner = _signer;
        emit TeeSignerUpdated(_signer);
    }

    function storeProof(
        bytes32 validationHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string calldata repo,
        string calldata checkName
    ) external {
        bytes32 ethHash = keccak256(abi.encodePacked("\\x19Ethereum Signed Message:\\n32", validationHash));
        address recovered = ecrecover(ethHash, v, r, s);
        proofs[validationHash] = Proof(recovered, v, r, s, block.timestamp, repo, checkName);
        proofHashes.push(validationHash);
        emit ProofStored(validationHash, recovered, repo, block.timestamp);
    }

    function verifyProof(bytes32 validationHash) external view returns (bool valid, address signer) {
        Proof memory p = proofs[validationHash];
        if (p.timestamp == 0) return (false, address(0));
        return (p.signer == teeSigner, p.signer);
    }

    function proofCount() external view returns (uint256) {
        return proofHashes.length;
    }
}
"""


def main():
    w3 = Web3(Web3.HTTPProvider(AUX_RPC))
    acct = Account.from_key(ORACLE_KEY)
    print(f"Deployer: {acct.address}")
    print(f"Balance: {w3.eth.get_balance(acct.address) / 1e18} (native)")

    install_solc("0.8.20")
    compiled = compile_source(SOURCE, output_values=["abi", "bin"], solc_version="0.8.20")
    _, interface = compiled.popitem()
    abi = interface["abi"]
    bytecode = interface["bin"]

    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = Contract.constructor(acct.address).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 2_000_000,
        "gasPrice": max(w3.eth.gas_price, 25_000_000_000),
        "chainId": ORACLE_AUX_CHAIN_ID,
    })
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Tx: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    print(f"Contract: {receipt.contractAddress}")
    print(f"Block: {receipt.blockNumber}")
    print(f"Gas: {receipt.gasUsed}")

    deploy = {
        "address": receipt.contractAddress,
        "abi": abi,
        "network": "aux_proof_store",
        "chainId": ORACLE_AUX_CHAIN_ID,
        "deployer": acct.address,
        "tx": tx_hash.hex(),
        "block": receipt.blockNumber,
    }
    out_path = os.environ.get("ORACLE_AUX_DEPLOYMENT_JSON", "aux_proof_store_deployment.json")
    with open(out_path, "w") as f:
        json.dump(deploy, f, indent=2)
    print(f"Saved to {out_path}")

    print("\nTesting storeProof...")
    contract = w3.eth.contract(address=receipt.contractAddress, abi=abi)

    from eth_utils import keccak
    from eth_account.messages import encode_defunct

    msg_hash = keccak(b"test:example/repo:abc12345:build:success")
    message = encode_defunct(msg_hash)
    sig = w3.eth.account.sign_message(message, private_key=ORACLE_KEY)

    store_tx = contract.functions.storeProof(
        msg_hash, sig.v, sig.r.to_bytes(32, "big"), sig.s.to_bytes(32, "big"),
        "example/repo", "build"
    ).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 300_000,
        "gasPrice": max(w3.eth.gas_price, 25_000_000_000),
        "chainId": ORACLE_AUX_CHAIN_ID,
    })
    signed2 = acct.sign_transaction(store_tx)
    tx2 = w3.eth.send_raw_transaction(signed2.raw_transaction)
    r2 = w3.eth.wait_for_transaction_receipt(tx2, timeout=60)
    print(f"storeProof tx: {tx2.hex()}, gas: {r2.gasUsed}")

    valid, signer = contract.functions.verifyProof(msg_hash).call()
    count = contract.functions.proofCount().call()
    print(f"verifyProof: valid={valid}, signer={signer}")
    print(f"proofCount: {count}")


if __name__ == "__main__":
    main()
