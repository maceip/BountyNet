"""Pytest defaults for gateway auth / webhook gates."""

from __future__ import annotations

import os
import tempfile

import pytest


@pytest.fixture(scope="session", autouse=True)
def _gateway_test_env() -> None:
    os.environ.setdefault("BOUNTYNET_ALLOW_UNVERIFIED_JWT", "1")
    os.environ.setdefault("BOUNTYNET_ALLOW_UNSIGNED_GITHUB_WEBHOOKS", "1")
    fd, path = tempfile.mkstemp(suffix="-gateway-test.db")
    os.close(fd)
    os.environ["BOUNTYNET_DB_PATH"] = path
