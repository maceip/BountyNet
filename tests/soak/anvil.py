"""Start/stop a local Anvil (Foundry) process for soak tests."""

from __future__ import annotations

import socket
import subprocess
import time

from web3 import Web3


def pick_free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return int(port)


class AnvilProcess:
    def __init__(self, rpc_port: int) -> None:
        self.rpc_port = rpc_port
        self._proc: subprocess.Popen[bytes] | None = None

    @property
    def rpc_url(self) -> str:
        return f"http://127.0.0.1:{self.rpc_port}"

    def start(self) -> None:
        self._proc = subprocess.Popen(
            ["anvil", "--host", "127.0.0.1", "--port", str(self.rpc_port)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self._wait_rpc(self.rpc_url, timeout=30.0)

    @staticmethod
    def _wait_rpc(url: str, timeout: float) -> None:
        w3 = Web3(Web3.HTTPProvider(url))
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                _ = w3.eth.block_number
                return
            except Exception:
                time.sleep(0.1)
        raise TimeoutError(f"anvil RPC not reachable at {url} within {timeout}s")

    def stop(self) -> None:
        if self._proc:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
            self._proc = None
