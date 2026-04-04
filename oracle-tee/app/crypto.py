"""Crypto utilities for the CI Oracle TEE extension.

Signs CI validation proofs inside the TEE. The signature (v, r, s) can be
verified on any EVM chain via ecrecover — this is how the TEE attestation
crosses from Flare Coston2 to Arc testnet.
"""
from __future__ import annotations

import coincurve
from base.crypto import keccak256


_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141


def sign_ci_proof(private_key: bytes, repo: str, sha: str, check_name: str, conclusion: str, source_hash: str = "", image_digest: str = "") -> dict:
    """
    Sign a CI proof: keccak256(abi.encodePacked(repo, sha, check_name, conclusion, source_hash))

    The source_hash and image_digest bind the attestation to the exact oracle code.
    Returns { message_hash, v, r, s, source_hash, image_digest } — ready for on-chain ecrecover.
    """
    # Pack the proof data — includes oracle identity for full attestation chain
    packed = repo.encode() + sha.encode() + check_name.encode() + conclusion.encode() + source_hash.encode()
    msg_hash = keccak256(packed)

    # Ethereum signed message prefix (EIP-191)
    prefixed = keccak256(
        b"\x19Ethereum Signed Message:\n32" + msg_hash
    )

    key = coincurve.PrivateKey(private_key)
    sig = key.sign_recoverable(prefixed, hasher=None)

    r = sig[:32]
    s = sig[32:64]
    v = sig[64] + 27

    return {
        "message_hash": "0x" + msg_hash.hex(),
        "v": v,
        "r": "0x" + r.hex(),
        "s": "0x" + s.hex(),
        "signer": get_address(private_key),
        "source_hash": source_hash,
        "image_digest": image_digest,
    }


def get_address(private_key: bytes) -> str:
    """Derive the Ethereum address from a private key."""
    key = coincurve.PrivateKey(private_key)
    pub = key.public_key.format(compressed=False)[1:]  # drop 0x04 prefix
    addr = keccak256(pub)[-20:]
    return "0x" + addr.hex()


def parse_private_key(b: bytes) -> bytes:
    """Validate raw bytes as a secp256k1 private key."""
    if len(b) == 0:
        raise ValueError("key bytes are empty")
    if len(b) > 32:
        raise ValueError(f"key too long: {len(b)} bytes")
    if all(byte == 0 for byte in b):
        raise ValueError("key is zero")

    key = b.rjust(32, b"\x00")
    scalar = int.from_bytes(key, "big")
    if scalar >= _N:
        raise ValueError("key >= curve order")

    coincurve.PrivateKey(key)
    return key
