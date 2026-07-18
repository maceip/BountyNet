"""GitHub App JWT + webhook HMAC (no Flask)."""

from __future__ import annotations

import hashlib
import hmac
import os
import time

import jwt as pyjwt

from gateway.github.github_env import GITHUB_API_BASE

APP_ID = os.environ.get("GITHUB_APP_ID", "")


def _load_private_key() -> str:
    explicit_path = os.environ.get("GITHUB_APP_KEY_PATH", "").strip()
    if explicit_path:
        try:
            with open(explicit_path) as f:
                return f.read()
        except OSError:
            pass
    raw = os.environ.get("GITHUB_APP_PRIVATE_KEY", "")
    return raw.replace("\\n", "\n") if raw else ""


PRIVATE_KEY = _load_private_key()
WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")


def verify_webhook(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        truthy = ("1", "true", "yes")
        return os.environ.get("BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY", "").lower() in truthy
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_app_jwt() -> str:
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": APP_ID}
    return pyjwt.encode(payload, PRIVATE_KEY, algorithm="RS256")


def get_installation_token(installation_id: int) -> str:
    import requests

    try:
        resp = requests.post(
            f"{GITHUB_API_BASE}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {get_app_jwt()}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        return resp.json().get("token", "")
    except Exception:
        return ""
