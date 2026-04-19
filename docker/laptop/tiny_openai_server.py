from __future__ import annotations

import argparse
import time
import os

from flask import Flask, jsonify, request
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline


def build_app(model_id: str, served_model_name: str) -> Flask:
    app = Flask(__name__)

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id)
    generator = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=-1,
    )

    @app.get("/v1/models")
    def models():
        return jsonify(
            {
                "object": "list",
                "data": [
                    {
                        "id": served_model_name,
                        "object": "model",
                        "created": int(time.time()),
                        "owned_by": "tiny-cpu-transformers",
                    }
                ],
            }
        )

    @app.post("/v1/chat/completions")
    def completions():
        body = request.get_json(silent=True) or {}
        req_model = str(body.get("model") or served_model_name)
        agent_id = (
            request.headers.get("X-Agent-ID")
            or request.headers.get("x-agent-id")
            or ""
        ).strip()
        messages = body.get("messages") if isinstance(body.get("messages"), list) else []
        max_tokens = int(body.get("max_tokens") or 32)

        prompt_parts: list[str] = []
        for msg in messages:
            if isinstance(msg, dict):
                role = str(msg.get("role") or "user")
                content = str(msg.get("content") or "")
                prompt_parts.append(f"{role}: {content}")
        prompt = "\n".join(prompt_parts) if prompt_parts else "user: hello"
        if "__force_timeout__" in prompt:
            # Used by smoke tests to verify LiteLLM circuit-break fallback behavior.
            time.sleep(int(os.getenv("PRIMARY_TIMEOUT_SLEEP_SECONDS", "15")))

        result = generator(
            prompt,
            max_new_tokens=max(1, min(max_tokens, 64)),
            do_sample=False,
            num_return_sequences=1,
            pad_token_id=tokenizer.eos_token_id,
        )[0]["generated_text"]

        completion_text = result[len(prompt) :].strip() if result.startswith(prompt) else result.strip()
        if not completion_text:
            completion_text = "ok"
        if agent_id:
            completion_text = f"[primary-tiny][agent-id:{agent_id}] {completion_text}"
        else:
            completion_text = f"[primary-tiny] {completion_text}"

        return jsonify(
            {
                "id": f"chatcmpl-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": req_model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": completion_text},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            }
        )

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "model_id": model_id})

    return app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--model-id", default="sshleifer/tiny-gpt2")
    parser.add_argument("--served-model-name", default="base-coder")
    args = parser.parse_args()

    app = build_app(args.model_id, args.served_model_name)
    app.run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
