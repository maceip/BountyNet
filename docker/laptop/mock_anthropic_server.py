from __future__ import annotations

import argparse
import time

from flask import Flask, jsonify, request


def build_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "provider": "anthropic-mock"})

    @app.post("/v1/messages")
    def messages():
        body = request.get_json(silent=True) or {}
        model = str(body.get("model") or "claude-3-5-haiku-latest")
        max_tokens = int(body.get("max_tokens") or 64)
        content = "[anthropic-fallback] upstream-primary-unavailable"
        return jsonify(
            {
                "id": f"msg_{int(time.time())}",
                "type": "message",
                "role": "assistant",
                "model": model,
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "content": [{"type": "text", "text": content}],
                "usage": {"input_tokens": 0, "output_tokens": min(max_tokens, 16)},
            }
        )

    return app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8100)
    args = parser.parse_args()

    app = build_app()
    app.run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
