"""
MCP resource subscriptions for the unified gateway watch feed.

When ``BOUNTYNET_MCP_SUBSCRIBE=1``, clients can ``resources/subscribe`` to
``bountynet://watch/feed``. A lightweight poller notices new rows in
``gateway.events`` (same source as GET /events) and sends
``notifications/resources/updated`` to registered sessions.

Requires stateful Streamable HTTP (``stateless_http=False``), enabled alongside
subscribe in ``gateway.mcp_server``.
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
from typing import Any

from pydantic import AnyUrl

from gateway.events import recent
from gateway.routes.bounties import bounty_feed_snapshot

WATCH_FEED_URI = "bountynet://watch/feed"

_lock = threading.Lock()
_sessions: list[Any] = []
_last_event_id: int = 0
_poll_thread: threading.Thread | None = None
_stop = threading.Event()
_main_loop: asyncio.AbstractEventLoop | None = None


def watch_snapshot_dict() -> dict[str, Any]:
    snap = bounty_feed_snapshot()
    events = recent(limit=40, since_id=0, kind="")
    return {
        "events": events,
        "bounties": snap.get("bounties") or [],
        "bounty_count": int(snap.get("count") or 0),
        "bounty_error": snap.get("error"),
        "ts": time.time(),
    }


def watch_snapshot_json() -> str:
    return json.dumps(watch_snapshot_dict(), indent=2)


def register(session: Any, uri: str) -> None:
    if uri != WATCH_FEED_URI:
        return
    with _lock:
        if session not in _sessions:
            _sessions.append(session)


def unregister(session: Any, uri: str) -> None:
    if uri != WATCH_FEED_URI:
        return
    with _lock:
        try:
            _sessions.remove(session)
        except ValueError:
            pass


async def _notify_subscribers() -> None:
    uri = AnyUrl(WATCH_FEED_URI)
    with _lock:
        targets = list(_sessions)
    dead: list[Any] = []
    for sess in targets:
        try:
            await sess.send_resource_updated(uri)
        except Exception:
            dead.append(sess)
    for sess in dead:
        unregister(sess, WATCH_FEED_URI)


def _poll_loop() -> None:
    global _last_event_id
    loop = _main_loop
    if loop is None:
        return
    while not _stop.wait(timeout=1.25):
        try:
            evs = recent(limit=1, since_id=0, kind="")
            cur = int(evs[-1]["id"]) if evs else 0
        except (IndexError, KeyError, TypeError):
            continue
        with _lock:
            prev = _last_event_id
        if cur > prev:
            _last_event_id = cur
            fut = asyncio.run_coroutine_threadsafe(_notify_subscribers(), loop)
            try:
                fut.result(timeout=30)
            except Exception:
                pass


def start(loop: asyncio.AbstractEventLoop) -> None:
    """Attach to the ASGI event loop and start the poller (subscribe mode only)."""
    global _main_loop, _poll_thread, _last_event_id
    if _poll_thread is not None and _poll_thread.is_alive():
        return
    _main_loop = loop
    evs = recent(limit=1, since_id=0, kind="")
    if evs:
        try:
            _last_event_id = int(evs[-1]["id"])
        except (KeyError, TypeError, ValueError):
            _last_event_id = 0
    _stop.clear()
    _poll_thread = threading.Thread(target=_poll_loop, name="mcp-watch-poll", daemon=True)
    _poll_thread.start()


def stop() -> None:
    _stop.set()
    global _poll_thread
    if _poll_thread is not None:
        _poll_thread.join(timeout=3.0)
        _poll_thread = None
    with _lock:
        _sessions.clear()
