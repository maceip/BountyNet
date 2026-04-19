# AWS vLLM Model Plane

This is the self-hosted model-plane bundle.

It is intentionally separate from the DigitalOcean control plane.

The control plane talks to it through LiteLLM using:

- `AWS_VLLM_API_BASE`
- `AWS_VLLM_API_KEY`

## What it serves

One base model through an OpenAI-compatible vLLM server.
An adapter resolver proxy sits in front of vLLM and maps `X-Agent-ID` to adapter metadata.

That is enough for LiteLLM to treat it as the shared base-model backend for the six agent aliases if you choose to move traffic off Anthropic later.

## Bring up

1. Copy `.env.example` to `.env`.
2. Set `VLLM_MODEL` to the absolute model path on the box.
3. Optional: edit `adapter-manifest.json` (or rely on `ADAPTER_BUCKET` convention).
4. Bring up `docker compose up -d`.

## Adapter routing

- Clients should send `X-Agent-ID` (`ts-migrator`, `rust-sentinel`, etc).
- Query the resolver directly:

```bash
curl -fsS "http://127.0.0.1:${VLLM_PORT}/ops/adapters/resolve?agent_id=rust-sentinel" | jq
```

- The resolver returns and forwards:
  - `adapter_id`
  - `adapter_s3_uri`
  - `revision`

This gives you serving-time identity selection while keeping one shared base model.

## Notes

- This bundle is for an AWS model node, not the control plane.
- The control plane stays on DigitalOcean.
- Anthropic remains the default route until you intentionally repoint LiteLLM aliases.
- Point control-plane `AWS_VLLM_API_BASE` to this router endpoint (`http://<node-ip>:${VLLM_PORT}/v1`).
