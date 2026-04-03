"""
BountyNet Gateway — unified API surface.

One process, one port, all routes:

  /ens/{sender}/{data}.json  — CCIP-Read resolver for *.maceip.eth
  /github                    — GitHub App webhook (CI failure → bounty)
  /oracle                    — CI Oracle (green build → validation → payout)
  /v1/messages               — Anthropic-compatible inference proxy
  /v1/chat/completions       — OpenAI-compatible inference proxy
  /identity/onboard          — Dynamic identity creation
  /identity/status/{agent}   — Agent wallet + credit status
  /bounties                  — Active bounty feed
  /health                    — Gateway status

All auth flows through one pattern:
  - GitHub webhooks: X-Hub-Signature-256
  - Inference: Bearer bnet_<agent_id>:<context_hash>
  - Public reads: no auth
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

app.register_blueprint(ens_bp)
app.register_blueprint(github_bp)
app.register_blueprint(oracle_bp)
app.register_blueprint(inference_bp)
app.register_blueprint(identity_bp)
app.register_blueprint(bounties_bp)
app.register_blueprint(attest_bp)


@app.route("/health")
def health():
    from gateway.chain import get_health
    return get_health()


if __name__ == "__main__":
    import os
    port = int(os.environ.get("GATEWAY_PORT", "8090"))
    print(f"BountyNet Gateway on :{port}")
    app.run(host="0.0.0.0", port=port)
