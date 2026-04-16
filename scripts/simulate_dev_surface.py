from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from starlette.testclient import TestClient


def _dev_factor_proof(secret: str, factor_type: str, challenge_id: str, nonce: str, identifier: str) -> str:
    payload = f"{secret}:{factor_type}:{challenge_id}:{nonce}:{identifier.lower()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _require(status: int, expected: int, label: str) -> None:
    if status != expected:
        raise RuntimeError(f"{label}: expected {expected}, got {status}")


class _MockRpcHandler(BaseHTTPRequestHandler):
    server_version = "BountyNetMockRPC/1.0"

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        req = json.loads(raw or "{}")
        method = req.get("method", "")
        req_id = req.get("id", 1)
        if method == "eth_blockNumber":
            result = "0x2a"
        elif method == "eth_call":
            # Return a single uint256 value = 1 for next_id(), so registered_agents becomes 0.
            result = "0x" + ("0" * 63) + "1"
        elif method == "eth_getBalance":
            result = "0xde0b6b3a7640000"  # 1 ETH in wei
        elif method == "eth_gasPrice":
            result = "0x3b9aca00"  # 1 gwei
        elif method == "eth_getTransactionCount":
            result = "0x0"
        else:
            result = "0x0"
        payload = {"jsonrpc": "2.0", "id": req_id, "result": result}
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args):  # noqa: A003
        return


def _start_mock_rpc() -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _MockRpcHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, thread, f"http://{host}:{port}"


def run() -> dict:
    workspace = Path(__file__).resolve().parents[1]
    if str(workspace) not in sys.path:
        sys.path.insert(0, str(workspace))

    runtime_dir = workspace / "projects" / "agent-market" / "demo"
    runtime_dir.mkdir(parents=True, exist_ok=True)

    db_path = runtime_dir / "dev-surface-smoke.db"
    if db_path.exists():
        db_path.unlink()

    repo = runtime_dir / "dev-surface-repo"
    if repo.exists():
        shutil.rmtree(repo)
    (repo / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
    (repo / ".github" / "workflows" / "ci.yml").write_text(
        "name: CI\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v3\n      - uses: actions/setup-node@v3\n",
        encoding="utf-8",
    )
    (repo / "tsconfig.json").write_text('{"compilerOptions":{"strict":true}}\n', encoding="utf-8")

    os.environ["BOUNTYNET_DB_PATH"] = str(db_path)
    os.environ["BOUNTYNET_DEV_SKIP_JWT_VERIFICATION"] = "1"
    os.environ["BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY"] = "1"
    os.environ["BOUNTYNET_AUTH_DEV_FACTOR_SECRET"] = "smoke-factor-secret"
    os.environ["BOUNTYNET_DEV_MAGIC_LINK_ECHO"] = "1"
    os.environ["MARKET_API_TOKEN"] = ""
    os.environ["TEMP"] = str(runtime_dir)
    os.environ["TMP"] = str(runtime_dir)
    os.environ["IDENTITY_REGISTRY"] = "0x0000000000000000000000000000000000000001"

    rpc_server, rpc_thread, rpc_url = _start_mock_rpc()
    os.environ["BOUNTYNET_EVM_RPC"] = rpc_url
    os.environ["BOUNTYNET_EVM_RPC_FALLBACK"] = rpc_url

    from gateway.factory import create_asgi_app
    try:
        from eth_account import Account  # type: ignore
        from eth_account.messages import encode_defunct  # type: ignore
    except Exception:  # pragma: no cover - local env may omit eth_account
        Account = None  # type: ignore[assignment]
        encode_defunct = None  # type: ignore[assignment]

    app = create_asgi_app()
    summary: dict[str, object] = {"mock_rpc_url": rpc_url}

    try:
        with TestClient(app) as client:
            # Core health/event surface
            health = client.get("/health")
            _require(health.status_code, 200, "health")
            summary["health"] = {"status_code": health.status_code, "body": health.json()}

            events = client.get("/events")
            _require(events.status_code, 200, "events")
            summary["events_count"] = len(events.json().get("events", []))

        # MCP route preflight
            mcp_preflight = client.options("/mcp")
            _require(mcp_preflight.status_code, 204, "mcp preflight")
            summary["mcp_preflight"] = mcp_preflight.status_code

        # Email magic link flow
            magic_req = client.post("/auth/magic-link/request", json={"email": "dev-admin@acme.test"})
            _require(magic_req.status_code, 202, "magic link request")
            magic_token = magic_req.json().get("dev_magic_link_token")
            if not magic_token:
                raise RuntimeError("magic link token missing in dev mode")
            magic_consume = client.post(
                "/auth/magic-link/consume",
                json={"token": magic_token, "device_fingerprint": "device-email"},
            )
            _require(magic_consume.status_code, 200, "magic link consume")
            summary["magic_link_session"] = {
                "aal": magic_consume.json().get("aal"),
                "roles": magic_consume.json().get("roles"),
            }

        # Multi-factor contracts in dev-secret mode
            generic_factors = [
            ("wallet_sol", "solana:local-dev-user"),
            ("wallet_btc", "btc:local-dev-user"),
            ("passkey", "passkey:local-dev-handle"),
            ("nfc_euid", "euid:de:city:112233"),
        ]
            factor_results: dict[str, object] = {}
            for factor_type, identifier in generic_factors:
                chal = client.post(
                    "/auth/challenge",
                    json={"factor_type": factor_type, "payload": {"identifier": identifier}},
                )
                _require(chal.status_code, 201, f"{factor_type} challenge")
                chal_body = chal.json()
                proof = _dev_factor_proof(
                    "smoke-factor-secret",
                    factor_type,
                    chal_body["challenge_id"],
                    chal_body["nonce"],
                    identifier,
                )
                verified = client.post(
                    "/auth/verify",
                    json={
                        "factor_type": factor_type,
                        "challenge_id": chal_body["challenge_id"],
                        "identifier": identifier,
                        "proof": proof,
                        "device_fingerprint": f"device-{factor_type}",
                    },
                )
                _require(verified.status_code, 200, f"{factor_type} verify")
                factor_results[factor_type] = {"aal": verified.json().get("aal")}
            summary["factor_results"] = factor_results

        # ETH flow + admin bootstrap
            if Account is not None and encode_defunct is not None:
                account = Account.create()
                address = account.address.lower()
            else:
                address = "0xdevadmin00000000000000000000000000000000"
            eth_chal = client.post(
                "/auth/challenge",
                json={"factor_type": "wallet_eth", "payload": {"address": address}},
            )
            _require(eth_chal.status_code, 201, "eth challenge")
            eth_chal_body = eth_chal.json()
            if Account is not None and encode_defunct is not None:
                msg = eth_chal_body["message_template"]
                sig = Account.sign_message(encode_defunct(text=msg), account.key).signature.hex()
                eth_verify_payload = {
                    "factor_type": "wallet_eth",
                    "challenge_id": eth_chal_body["challenge_id"],
                    "address": address,
                    "signature": sig,
                    "device_fingerprint": "device-admin",
                }
            else:
                eth_proof = _dev_factor_proof(
                    "smoke-factor-secret",
                    "wallet_eth",
                    eth_chal_body["challenge_id"],
                    eth_chal_body["nonce"],
                    address,
                )
                eth_verify_payload = {
                    "factor_type": "wallet_eth",
                    "challenge_id": eth_chal_body["challenge_id"],
                    "identifier": address,
                    "proof": eth_proof,
                    "device_fingerprint": "device-admin",
                }
            eth_verified = client.post("/auth/verify", json=eth_verify_payload)
            _require(eth_verified.status_code, 200, "eth verify")
            admin_token_before = eth_verified.json()["token"]

            blocked_ops = client.get(
                "/ops/serving/topology",
                headers={
                    "Authorization": f"Bearer {admin_token_before}",
                    "X-BN-Device-Fingerprint": "device-admin",
                },
            )
            _require(blocked_ops.status_code, 401, "ops blocked before admin grant")

            grant = client.post(
                "/auth/bootstrap/admin",
                json={"identifier_kind": "eth", "identifier_value": address},
            )
            _require(grant.status_code, 200, "bootstrap admin grant")

            eth_chal2 = client.post(
                "/auth/challenge",
                json={"factor_type": "wallet_eth", "payload": {"address": address}},
            )
            eth_chal2_body = eth_chal2.json()
            if Account is not None and encode_defunct is not None:
                msg2 = eth_chal2_body["message_template"]
                sig2 = Account.sign_message(encode_defunct(text=msg2), account.key).signature.hex()
                eth_verify_payload2 = {
                    "factor_type": "wallet_eth",
                    "challenge_id": eth_chal2_body["challenge_id"],
                    "address": address,
                    "signature": sig2,
                    "device_fingerprint": "device-admin",
                }
            else:
                eth_proof2 = _dev_factor_proof(
                    "smoke-factor-secret",
                    "wallet_eth",
                    eth_chal2_body["challenge_id"],
                    eth_chal2_body["nonce"],
                    address,
                )
                eth_verify_payload2 = {
                    "factor_type": "wallet_eth",
                    "challenge_id": eth_chal2_body["challenge_id"],
                    "identifier": address,
                    "proof": eth_proof2,
                    "device_fingerprint": "device-admin",
                }
            eth_verified2 = client.post("/auth/verify", json=eth_verify_payload2)
            _require(eth_verified2.status_code, 200, "eth verify after admin grant")
            admin_token = eth_verified2.json()["token"]

        # Ops surface
            ops_headers = {
                "Authorization": f"Bearer {admin_token}",
                "X-BN-Device-Fingerprint": "device-admin",
            }
            topology = client.get("/ops/serving/topology", headers=ops_headers)
            _require(topology.status_code, 200, "ops topology")
            traffic = client.post(
                "/ops/serving/traffic-shift",
                headers=ops_headers,
                json={"us_percent": 60, "eu_percent": 40, "changed_by": "smoke", "notes": "dev smoke"},
            )
            _require(traffic.status_code, 200, "ops traffic shift")
            rollout = client.post(
                "/ops/serving/model-rollout",
                headers=ops_headers,
                json={"target": "specialist", "revision": "adapter/smoke-v1", "strategy": "canary"},
            )
            _require(rollout.status_code, 200, "ops model rollout")
            langfuse = client.get("/ops/observability/langfuse", headers=ops_headers)
            _require(langfuse.status_code, 200, "ops langfuse")
            summary["ops"] = {
                "topology": topology.json().get("status"),
                "traffic": traffic.json().get("traffic"),
                "rollout": rollout.json().get("rollout"),
                "recent_rollouts": len(langfuse.json().get("recent_rollouts", [])),
            }

        # Marketplace surface (existing scaffold + execution)
            seeded = client.post("/market/agents/seed")
            _require(seeded.status_code, 200, "market agents seed")
            setup = client.post(
                "/market/repositories/setup",
                json={
                    "installation_id": 1700,
                    "repos": ["local/dev-surface-repo"],
                    "local_path": str(repo),
                },
            )
            _require(setup.status_code, 200, "market repo setup")
            job = client.post(
                "/market/jobs",
                json={
                    "repo_full_name": "local/dev-surface-repo",
                    "job_class": "ci_repair",
                    "title": "Repair workflow drift",
                    "metadata": {"pod": "typescript", "lane": "migration", "required_trust_tier": "trusted"},
                },
            )
            _require(job.status_code, 201, "market create job")
            job_id = job.json()["job"]["id"]
            rec = client.post(f"/market/jobs/{job_id}/recommendations")
            _require(rec.status_code, 200, "market recommendations")
            autopilot = client.post(f"/market/jobs/{job_id}/autopilot", json={})
            _require(autopilot.status_code, 200, "market autopilot")
            detail = client.get(f"/market/jobs/{job_id}")
            _require(detail.status_code, 200, "market job detail")
            summary["market"] = {
                "job_id": job_id,
                "job_status": detail.json()["job"]["status"],
                "runs": len(detail.json().get("runs", [])),
                "submissions": len(detail.json().get("submissions", [])),
            }
    finally:
        rpc_server.shutdown()
        rpc_server.server_close()
        rpc_thread.join(timeout=2)

    summary["ok"] = True
    return summary


if __name__ == "__main__":
    payload = run()
    out = Path(__file__).resolve().parents[1] / "projects" / "agent-market" / "demo" / "dev-surface-smoke.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(out)
