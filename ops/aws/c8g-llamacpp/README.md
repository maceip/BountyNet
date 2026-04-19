# AWS Graviton CPU Worker (llama.cpp)

Production runtime bundle for the CPU worker lane on Graviton (`c8g`).

## What this node runs

- `llama.cpp` OpenAI-compatible server
- GGUF model loaded from local path or synced from S3

## Quick start

1. Copy env:

```bash
cp .env.example .env
```

2. Set either:
- `GGUF_MODEL_PATH` to local model file, or
- `GGUF_MODEL_URI` to `s3://...` and run sync script.

3. Start:

```bash
docker compose up -d
```

4. Health / models:

```bash
curl -fsS "http://127.0.0.1:${LLAMACPP_PORT}/health"
curl -fsS "http://127.0.0.1:${LLAMACPP_PORT}/v1/models"
```

## Control-plane wiring

Point LiteLLM alias at:

- `AWS_C8G_API_BASE=http://<c8g-host>:${LLAMACPP_PORT}/v1`
- `AWS_C8G_API_KEY=<LLAMACPP_API_KEY>`
