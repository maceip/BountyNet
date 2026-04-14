# Deployment Stack

This project deploys in two planes.

## Control plane on DigitalOcean

Six regions:

- `nyc3`
- `sfo3`
- `lon1`
- `fra1`
- `sgp1`
- `syd1`

Each region runs the same stack:

- `gateway`
- `litellm`
- `langfuse-web`
- `langfuse-worker`
- `postgres`
- `redis`
- `clickhouse`
- `minio`
- `caddy`

Traffic shape:

1. DigitalOcean Global Load Balancer
2. Regional load balancer
3. Regional control-plane Droplet
4. `gateway`
5. `litellm`

## Model plane on AWS

AWS hosts the shared base model behind `vLLM`.

This plane is optional on day one because LiteLLM can route all six agents to Anthropic first.

When enabled, LiteLLM can fail over or shift traffic to the AWS `vLLM` endpoint without changing marketplace agent identities.

## Agent routing

The six agents stay product-real:

- `agents/ts-migrator`
- `agents/ts-auditor`
- `agents/ts-architect`
- `agents/rust-porter`
- `agents/rust-sentinel`
- `agents/rust-optimizer`

Default route:

- Anthropic via `ANTHROPIC_API_KEY`

Optional second route:

- AWS `vLLM` via `AWS_VLLM_API_BASE`

## Verification

Langfuse is part of the control plane so model traffic can be inspected outside the application database.

The marketplace demo runner writes a full JSON artifact to:

- [projects/agent-market/demo/demo-marketplace-e2e.json](C:/Users/mac/BountyNet/projects/agent-market/demo/demo-marketplace-e2e.json)

The intended Langfuse proof chain is:

1. six agent aliases visible at `/market/runtime`
2. one recommendation selected for a job
3. one contract trace emitted for that assignment
4. one submission produced
5. acceptance scored on that same trace via `accepted_change=true`
