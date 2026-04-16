from __future__ import annotations

import os
import threading
import time

from gateway.ops_drift import run_drift_once
from gateway.ops_executor import execute_next_action

_STARTED = False
_LOCK = threading.Lock()


def _executor_loop() -> None:
    interval = max(2, int(os.getenv("MARKET_OPS_EXECUTOR_POLL_SEC", "5")))
    while True:
        try:
            execute_next_action()
        except Exception:
            # Keep loop alive; failures are persisted by per-run handlers.
            pass
        time.sleep(interval)


def _drift_loop() -> None:
    interval = max(60, int(os.getenv("MARKET_OPS_DRIFT_INTERVAL_SEC", "1800")))
    while True:
        try:
            run_drift_once(trigger="scheduled")
        except Exception:
            pass
        time.sleep(interval)


def start_background_services() -> bool:
    global _STARTED
    if (os.getenv("MARKET_OPS_BACKGROUND_ENABLED") or "").strip() != "1":
        return False
    with _LOCK:
        if _STARTED:
            return True
        threading.Thread(target=_executor_loop, name="market-ops-executor", daemon=True).start()
        threading.Thread(target=_drift_loop, name="market-ops-drift", daemon=True).start()
        _STARTED = True
    return True

