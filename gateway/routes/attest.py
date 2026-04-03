"""
Attestation route — receives OIDC-backed CI attestations.

POST /attest  — from bountynet/attest GitHub Action
GET  /attest/<context_hash>  — lookup attestation

The OIDC token is a JWT signed by GitHub's OIDC provider.
We verify it, extract the claims (repo, actor, sha), and store
the attestation. This serves two purposes:

1. Bounty resolution — provable CI outcome
2. Principal binding — GitHub actor → agent band
"""
import os
import json
import time
import jwt as pyjwt
from flask import Blueprint, request, jsonify

attest_bp = Blueprint("attest", __name__)

GITHUB_OIDC_JWKS = "https://token.actions.githubusercontent.com/.well-known/jwks"
_jwks_client = None

# In-memory attestation store (production: on-chain or DB)
attestations: dict = {}


def get_github_jwks():
    global _jwks_client
    if _jwks_client is None:
        try:
            _jwks_client = pyjwt.PyJWKClient(GITHUB_OIDC_JWKS)
        except Exception:
            pass
    return _jwks_client


def verify_oidc(token: str) -> dict | None:
    """Verify GitHub Actions OIDC token, return claims."""
    client = get_github_jwks()
    if not client:
        return None
    try:
        key = client.get_signing_key_from_jwt(token)
        return pyjwt.decode(token, key.key, algorithms=["RS256"], audience="bountynet")
    except Exception as e:
        print(f"[attest] OIDC verification failed: {e}")
        return None


@attest_bp.route("/attest", methods=["POST"])
def receive_attestation():
    body = request.json or {}
    oidc_token = body.get("oidc_token")
    context = body.get("context", {})
    context_hash = body.get("context_hash", "")

    if not context_hash:
        return jsonify({"error": "context_hash required"}), 400

    # Verify OIDC token if present
    claims = None
    if oidc_token:
        claims = verify_oidc(oidc_token)

    # Store attestation
    attestation = {
        "context_hash": context_hash,
        "repository": context.get("repository"),
        "sha": context.get("sha"),
        "actor": context.get("actor"),
        "ref": context.get("ref"),
        "run_id": context.get("run_id"),
        "workflow": context.get("workflow"),
        "runner": context.get("runner"),
        "oidc_verified": claims is not None,
        "oidc_claims": claims,
        "timestamp": int(time.time()),
    }

    attestations[context_hash] = attestation
    attestation_id = f"att_{context_hash[-8:]}"

    print(f"[attest] {context.get('repository')}@{context.get('sha', '')[:8]} by {context.get('actor')} oidc={'verified' if claims else 'unverified'}")

    return jsonify({
        "attestation_id": attestation_id,
        "context_hash": context_hash,
        "principal": context.get("actor"),
        "oidc_verified": claims is not None,
    })


@attest_bp.route("/attest/<context_hash>")
def get_attestation(context_hash: str):
    att = attestations.get(context_hash)
    if not att:
        return jsonify({"error": "not found"}), 404
    # Strip OIDC claims from public response
    safe = {k: v for k, v in att.items() if k != "oidc_claims"}
    return jsonify(safe)
