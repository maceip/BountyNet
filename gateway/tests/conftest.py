"""Pytest defaults for gateway auth / webhook gates."""

from __future__ import annotations

import os
import tempfile

import pytest


@pytest.fixture(scope="session", autouse=True)
def _gateway_test_env() -> None:
    os.environ.setdefault("BOUNTYNET_DEV_SKIP_JWT_VERIFICATION", "1")
    os.environ.setdefault("BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY", "1")
    fd, path = tempfile.mkstemp(suffix="-gateway-test.db")
    os.close(fd)
    os.environ["BOUNTYNET_DB_PATH"] = path
