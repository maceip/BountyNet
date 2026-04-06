"""
Gateway auth — validates Dynamic JWTs on protected routes.

Uses Dynamic's JWKS endpoint to verify JWT signatures.
Public routes (ENS, bounties list, health) skip auth.
Protected routes (onboard, inference, oracle) require valid JWT.

DYNAMIC_JWKS_ENDPOINT from .env:
  https://app.dynamic.xyz/api/v0/sdk/<env_id>/.well-known/jwks
"""
import os
import json
import functools
from flask import request, jsonify

JWKS_URL = os.environ.get("DYNAMIC_JWKS_ENDPOINT", "")
DYNAMIC_ENV_ID = os.environ.get("DYNAMIC_ENV_ID", "")


def _allow_unverified_jwt() -> bool:
    """Local/tests only — never enable in production."""
    return os.environ.get("BOUNTYNET_ALLOW_UNVERIFIED_JWT", "").lower() in (
        "1",
        "true",
        "yes",
    )

# Lazy-loaded JWKS client
_jwks_client = None


def get_jwks_client():
    global _jwks_client
    if _jwks_client is None and JWKS_URL:
        try:
            import jwt as pyjwt
            from jwt import PyJWKClient
            _jwks_client = PyJWKClient(JWKS_URL)
        except ImportError:
            pass
    return _jwks_client


def verify_dynamic_jwt(token: str) -> dict | None:
    """
    Verify a Dynamic JWT and return the claims.
    Returns None if invalid.
    """
    client = get_jwks_client()
    if not client:
        if _allow_unverified_jwt():
            return {"sub": "dev", "email": "dev@localhost"}
        print("[auth] set DYNAMIC_JWKS_ENDPOINT or BOUNTYNET_ALLOW_UNVERIFIED_JWT=1 (local only)")
        return None

    try:
        import jwt as pyjwt
        signing_key = client.get_signing_key_from_jwt(token)
        claims = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=DYNAMIC_ENV_ID or None,
        )
        return claims
    except Exception as e:
        print(f"[auth] JWT verification failed: {e}")
        return None


def extract_token() -> str | None:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and not auth.startswith("Bearer bnet_"):
        return auth[7:]
    return None


def require_auth(f):
    """Decorator for routes that require Dynamic JWT auth."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        token = extract_token()
        if not token:
            # Also accept bnet_ tokens (inference proxy handles those)
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer bnet_"):
                return f(*args, **kwargs)
            return jsonify({"error": "authentication required"}), 401

        claims = verify_dynamic_jwt(token)
        if not claims:
            return jsonify({"error": "invalid token"}), 401

        # Attach claims to request context
        request.auth_claims = claims
        return f(*args, **kwargs)

    return wrapper


def optional_auth(f):
    """Decorator for routes where auth is optional but enriches the response."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        token = extract_token()
        if token:
            claims = verify_dynamic_jwt(token)
            request.auth_claims = claims
        else:
            request.auth_claims = None
        return f(*args, **kwargs)

    return wrapper
