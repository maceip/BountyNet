# AWS vLLM Model Plane

This is the self-hosted model-plane bundle.

It is intentionally separate from the DigitalOcean control plane.

The control plane talks to it through LiteLLM using:

- `AWS_VLLM_API_BASE`
- `AWS_VLLM_API_KEY`

## What it serves

One base model through an OpenAI-compatible vLLM server.

That is enough for LiteLLM to treat it as the shared base-model backend for the six agent aliases if you choose to move traffic off Anthropic later.

## Bring up

1. Copy `.env.example` to `.env`.
2. Set `VLLM_MODEL` to the absolute model path on the box.
3. Bring up `docker compose up -d`.

## Notes

- This bundle is for an AWS GPU node, not the control plane.
- The control plane stays on DigitalOcean.
- Anthropic remains the default route until you intentionally repoint LiteLLM aliases.
