# AWS Inferentia2 Serving Plane

Production runtime bundle for the Inferentia (`inf2`) model lane.

## What this node runs

- `vllm` runtime container (set `RUNTIME_IMAGE` to a Neuron-compatible build)
- `adapter-router` front proxy that resolves `X-Agent-ID` to adapter metadata and forwards:
  - `X-BN-Adapter-ID`
  - `X-BN-Adapter-S3-URI`
  - `X-BN-Adapter-Revision`

This preserves the single-base-model + per-identity adapter contract.

## Quick start

1. Copy env:

```bash
cp .env.example .env
```

2. Edit:
- `RUNTIME_IMAGE` (Neuron-compatible image)
- `VLLM_MODEL`
- `VLLM_API_KEY`
- `ADAPTER_BUCKET`

3. Launch:

```bash
docker compose up -d
```

4. Validate:

```bash
curl -fsS "http://127.0.0.1:${VLLM_PORT}/health"
curl -fsS "http://127.0.0.1:${VLLM_PORT}/ops/adapters/resolve?agent_id=rust-sentinel"
```

## Control-plane wiring

Point LiteLLM at:

- `AWS_VLLM_API_BASE=http://<inf2-host>:${VLLM_PORT}/v1`
- `AWS_VLLM_API_KEY=<VLLM_API_KEY>`
