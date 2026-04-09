"""GitHub REST base URL — override for integration tests / fake GitHub."""
from __future__ import annotations

import os

GITHUB_API_BASE: str = (os.environ.get("GITHUB_API_URL") or "https://api.github.com").rstrip("/")
