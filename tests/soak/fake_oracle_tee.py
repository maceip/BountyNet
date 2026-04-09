"""In-process HTTP stand-in for `services/oracle-tee` — same /oracle/sign JSON as production."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from coincurve import PrivateKey
from eth_utils import keccak


def _raw_key(hex_key: str) -> bytes:
    b = bytes.fromhex(hex_key.removeprefix("0x"))
    if len(b) < 32:
        b = b.rjust(32, b"\x00")
    return b[-32:]


def sign_ci_proof_local(
    hex_key: str,
    repo: str,
    sha: str,
    check_name: str,
    conclusion: str,
    source_hash: str = "",
) -> dict:
    """Match `services/oracle-tee/app/crypto.py::sign_ci_proof` packing + EIP-191."""
    packed = (
        repo.encode()
        + sha.encode()
        + check_name.encode()
        + conclusion.encode()
        + (source_hash or "").encode()
    )
    msg_hash = keccak(packed)
    prefixed = keccak(b"\x19Ethereum Signed Message:\n32" + msg_hash)
    key = PrivateKey(_raw_key(hex_key))
    sig = key.sign_recoverable(prefixed, hasher=None)
    r = sig[:32]
    s = sig[32:64]
    v = sig[64] + 27
    pub = key.public_key.format(compressed=False)[1:]
    addr = keccak(pub)[-20:]
    return {
        "message_hash": "0x" + msg_hash.hex(),
        "v": v,
        "r": "0x" + r.hex(),
        "s": "0x" + s.hex(),
        "signer": "0x" + addr.hex(),
        "source_hash": source_hash,
        "image_digest": "",
    }


class _Handler(BaseHTTPRequestHandler):
    server_version = "FakeOracleTee/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        pass

    def do_GET(self) -> None:
        if self.path.rstrip("/") in ("/oracle/health", "/health"):
            body = json.dumps(
                {
                    "status": "ok",
                    "version": "soak-fake",
                    "type": "bountynet-ci-oracle",
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/oracle/sign":
            self.send_error(404)
            return
        ln = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(ln).decode() or "{}")
        key = getattr(self.server, "tee_key", "")
        proof = sign_ci_proof_local(
            key,
            str(payload.get("repo", "")),
            str(payload.get("sha", "")),
            str(payload.get("check_name", "")),
            str(payload.get("conclusion", "success")),
        )
        raw = json.dumps(proof).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class FakeOracleTeeServer:
    def __init__(self, tee_private_key_hex: str) -> None:
        self._tee_key = tee_private_key_hex
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.port: int = 0

    def start(self) -> str:
        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._httpd.tee_key = self._tee_key  # type: ignore[attr-defined]
        self.port = self._httpd.server_address[1]
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return f"http://127.0.0.1:{self.port}"

    def shutdown(self) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
