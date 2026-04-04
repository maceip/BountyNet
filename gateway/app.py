"""
BountyNet Gateway — Flask `app` is mounted by `gateway.factory.create_asgi_app()` (the only
supported full-stack surface). Serve and test that ASGI app; see `gateway/tests/test_contract.py`.

Run: `python -m gateway.app` (uvicorn + factory). Loaders may also use
`uvicorn gateway.factory:combined_app` or `gateway.asgi:combined_app` (re-export).

Routes include POST|GET|DELETE `/mcp`, `/health`, `/bounties`, `/github`, …

Auth: GitHub X-Hub-Signature-256; inference Bearer bnet_*; optional MCP OAuth per Apps SDK.
"""
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Route modules ───────────────────────────────────────────────

from gateway.routes.ens import ens_bp
from gateway.routes.github import github_bp
from gateway.routes.oracle import oracle_bp
from gateway.routes.inference import inference_bp
from gateway.routes.identity import identity_bp
from gateway.routes.bounties import bounties_bp
from gateway.routes.attest import attest_bp
from gateway.routes.chatgpt_connect import chatgpt_bp
from gateway.routes.resources import resources_bp

app.register_blueprint(ens_bp)
app.register_blueprint(github_bp)
app.register_blueprint(oracle_bp)
app.register_blueprint(inference_bp)
app.register_blueprint(identity_bp)
app.register_blueprint(bounties_bp)
app.register_blueprint(attest_bp)
app.register_blueprint(chatgpt_bp)
app.register_blueprint(resources_bp)


# Emit startup event
from gateway.events import emit
emit("system", "BountyNet Gateway started", data={"version": "0.1.0"})


@app.route("/health")
def health():
    from gateway.chain import get_health
    return get_health()


@app.route("/events")
def events():
    from flask import request, jsonify
    from gateway.events import recent
    since = int(request.args.get("since", 0))
    kind = request.args.get("kind", "")
    limit = int(request.args.get("limit", 50))
    return jsonify({"events": recent(limit, since, kind)})


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("GATEWAY_PORT", "8090"))
    uvicorn.run("gateway.factory:combined_app", host="0.0.0.0", port=port)
