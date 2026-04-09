"""
BountyNet **product event** stream (live feed), not application logs.

Operators use Python ``logging`` configured in ``gateway.logutil`` (stderr,
``[bountynet:gateway]``). This module is for *user-visible* activity on
``GET /events`` (in-memory, last 500).
"""
import time
import threading
from collections import deque

_events: deque = deque(maxlen=500)
_lock = threading.Lock()
_counter = 0


def emit(kind: str, message: str, data: dict | None = None, agent_id: int | None = None, repo: str = "", context_hash: str = ""):
    """Emit an event to the global log."""
    global _counter
    with _lock:
        _counter += 1
        event = {
            "id": _counter,
            "ts": time.time(),
            "kind": kind,
            "message": message,
            "repo": repo,
            "context_hash": context_hash[:18] if context_hash else "",
            "agent_id": agent_id,
            "data": data or {},
        }
        _events.append(event)
    return event


def recent(limit: int = 50, since_id: int = 0, kind: str = "") -> list:
    """Get recent events, optionally filtered."""
    with _lock:
        events = list(_events)
    if since_id:
        events = [e for e in events if e["id"] > since_id]
    if kind:
        events = [e for e in events if e["kind"] == kind]
    return events[-limit:]


# ── Event kinds ────────────────────────────────────────────────
# install    — GitHub App installed
# scan       — Repo scan started/completed
# bounty     — Bounty created/claimed/resolved/cancelled
# inference  — Inference call made (token usage)
# oracle     — TEE proof signed / validation submitted
# pr         — PR created / CI result
# agent      — Agent registered / status change
# system     — Gateway startup, errors, etc.
