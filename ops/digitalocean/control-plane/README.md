# DigitalOcean Control Plane

This is the production control-plane bundle.

It is designed for six regions:

- `nyc3` for US East
- `sfo3` for US West
- `lon1` for West Europe
- `fra1` for Central Europe
- `sgp1` for Asia
- `syd1` for Australia

Each Droplet runs:

- `gateway`
- `litellm`
- `langfuse-web`
- `langfuse-worker`
- `postgres`
- `redis`
- `clickhouse`
- `minio`
- `caddy`

## Routing contract

By default all six marketplace agents route through `ANTHROPIC_API_KEY`.

LiteLLM is the single northbound gateway.

If you later set `AWS_VLLM_API_BASE`, LiteLLM can fail over to the AWS model plane without changing the marketplace API.

## Bring up one region

1. Copy `.env.example` to `.env`.
2. Fill in domains, secrets, `ANTHROPIC_API_KEY`, and GitHub app credentials.
3. Copy `docker-compose.yml`, `Caddyfile`, `litellm.config.yaml`, and `.env` to `/opt/bountynet-control`.
4. Run `configure-node.sh`.

## Provision the region fleet

`deploy.ps1` creates one Droplet per region from `regions.json`.

`create-regional-lbs.ps1` creates one regional load balancer per region.

`create-global-lb.ps1` creates the DigitalOcean Global Load Balancer on top of those regional load balancers.
