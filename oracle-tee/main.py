"""
BountyNet CI Oracle — Flare TEE Extension entry point.

Runs as a Flare TEE extension (receives actions from the on-chain relay)
and exposes a direct HTTP signing API for the gateway.

Env:
  EXTENSION_PORT  — Flare TEE framework port (default 8080)
  SIGN_PORT       — TEE node decrypt/sign port (default 9090)
  ORACLE_PORT     — Direct HTTP API port (default 8095)
  ORACLE_KEY      — Hex private key for testnet mode (optional)
"""
import logging
import os
import sys
import json
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from base.server import Server
from app.config import VERSION
from app.handlers import register, report_state, set_sign_port, set_key_from_env, sign_ci_proof_direct, init_identity


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [oracle-tee] %(message)s",
    )

    ext_port = os.environ.get("EXTENSION_PORT", "8080")
    sign_port = os.environ.get("SIGN_PORT", "9090")
    oracle_port = os.environ.get("ORACLE_PORT", "8095")

    set_sign_port(sign_port)
    init_identity()

    # Testnet mode: load key from env
    oracle_key = os.environ.get("ORACLE_KEY", "")
    if oracle_key:
        set_key_from_env(oracle_key)

    # Start the direct HTTP API in a background thread
    api_thread = threading.Thread(
        target=run_direct_api,
        args=(oracle_port,),
        daemon=True,
    )
    api_thread.start()

    # Start the Flare TEE framework server (blocking)
    logging.info("starting Flare TEE extension on :%s", ext_port)
    srv = Server(ext_port, sign_port, VERSION, register, report_state)
    srv.listen_and_serve()


def run_direct_api(port: str) -> None:
    """Direct HTTP API — gateway calls this to get TEE-signed proofs."""

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path == "/oracle/sign":
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))

                try:
                    proof = sign_ci_proof_direct(
                        repo=body.get("repo", ""),
                        sha=body.get("sha", ""),
                        check_name=body.get("check_name", "build"),
                        conclusion=body.get("conclusion", "success"),
                    )
                    self._json(200, proof)
                except Exception as e:
                    self._json(500, {"error": str(e)})
            else:
                self._json(404, {"error": "not found"})

        def do_GET(self):
            if self.path == "/oracle/health":
                state = report_state()
                self._json(200, {"status": "ok", **state})
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code, data):
            body = json.dumps(data).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    server = ThreadingHTTPServer(("", int(port)), Handler)
    logging.info("oracle direct API on :%s", port)
    server.serve_forever()


if __name__ == "__main__":
    main()
