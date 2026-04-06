"""GitHub App JWT + webhook HMAC (no Flask)."""

from __future__ import annotations

import hashlib
import hmac
import os
import time

import jwt as pyjwt

APP_ID = os.environ.get("GITHUB_APP_ID", "")


def _load_private_key() -> str:
    for path in ["github_app_key.pem"]:
        try:
            with open(path) as f:
                return f.read()
        except OSError:
            pass
    raw = os.environ.get("GITHUB_APP_PRIVATE_KEY", "") or os.environ.get("GITHUB_SIGNING_KEY", "")
    return raw.replace("\\n", "\n") if raw else ""


PRIVATE_KEY = _load_private_key()
WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")


def verify_webhook(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
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
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {get_app_jwt()}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        return resp.json().get("token", "")
    except Exception:
        return ""
