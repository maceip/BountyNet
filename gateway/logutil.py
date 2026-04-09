"""Central logging configuration for BountyNet server-side Python code.

Format (stderr): ``LEVEL [bountynet:<service>] logger.name: message``

Env:
  ``BOUNTYNET_LOG_LEVEL`` — DEBUG, INFO, WARNING, ERROR (default INFO).

``gateway.events.emit`` is separate: product event stream for ``GET /events``, not
application logs.
"""
from __future__ import annotations

import logging
import os
import sys


def _parse_level(name: str) -> int:
    return getattr(logging, name.upper(), logging.INFO)


def configure_logging(service: str, level: str | None = None) -> None:
    """Idempotent enough for tests: ``force=True`` resets handlers on the root logger."""
    lv = _parse_level(level or os.environ.get("BOUNTYNET_LOG_LEVEL", "INFO"))
    fmt = f"%(levelname)s [bountynet:{service}] %(name)s: %(message)s"
    logging.basicConfig(level=lv, format=fmt, stream=sys.stderr, force=True)
