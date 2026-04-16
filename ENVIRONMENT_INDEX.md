# BountyNet Environment Index

This file is the single index for local/runtime environment variables.
Use `.env.sample` as a starting point for local development.

## Core Gateway

- `GATEWAY_PORT` - gateway listen port (default `8090`).
- `BOUNTYNET_DB_PATH` - SQLite path override for gateway state.
- `BOUNTYNET_DATA_DIR` - base directory used when `BOUNTYNET_DB_PATH` is not set.
- `BOUNTYNET_HEALTH_ALLOW_DEGRADED` - when truthy, `/health` returns `200` with `status=degraded` instead of `500` if chain RPC is unavailable.

## Chain / Contracts

- `BOUNTYNET_EVM_RPC` - primary chain RPC endpoint.
- `BOUNTYNET_EVM_RPC_FALLBACK` - fallback chain RPC endpoint.
- `IDENTITY_REGISTRY` - identity contract address.
- `BOUNTY_ESCROW` - escrow contract address.
- `VALIDATION_REGISTRY` - validation contract address.
- `DEPLOYER_PRIVATE_KEY` - signing key for onchain writes (never commit).

## Auth / Security

- `BOUNTYNET_DEV_SKIP_JWT_VERIFICATION` - local testing only.
- `BOUNTYNET_DEV_SKIP_GITHUB_WEBHOOK_VERIFY` - local testing only.
- `BOUNTYNET_AUTH_DEV_FACTOR_SECRET` - local auth test helper.
- `BOUNTYNET_AUTH_BOOTSTRAP_SECRET` - secret required by `/auth/bootstrap/admin` when set.
- `MARKET_API_TOKEN` - shared token for market write and ops access paths.

## Infra Ops / Terraform

- `MARKET_INFRA_ROOT` - path to infra root (default `infra/marketplace-fleet`).
- `MARKET_INFRA_ENV_FILE` - optional env file loaded by ops terraform runners.
- `TERRAFORM_BIN` - terraform executable override.
- `MARKET_OPS_EXECUTOR_TIMEOUT_SEC` - component action timeout.
- `MARKET_OPS_DRIFT_TIMEOUT_SEC` - drift run timeout.
- `MARKET_OPS_BACKGROUND_ENABLED` - enables background ops loops when `1`.
- `MARKET_OPS_TERRAFORM_ARMED` - must be truthy to allow apply/destroy execution modes.
- `DIGITAL_OCEAN_TOKEN` - preferred DigitalOcean token variable.
- `DIGITALOCEAN_TOKEN` - accepted alias for legacy scripts.
- `DIGITALOCEAN_ACCESS_TOKEN` - accepted alias for CLI/tooling compatibility.

## Inference / External Providers

- `ANTHROPIC_API_KEY` - Anthropic model access.
- `OPENAI_API_KEY` - OpenAI model access.
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` - Langfuse telemetry.

## Client/Frontend

- `VITE_GATEWAY_URL` - console/web frontend gateway base URL.
- `BOUNTYNET_GATEWAY_URL` - `clients/web` server-side gateway override.

## Notes

- Never commit real secrets.
- Keep local values in `.env`, `.env.local`, or other ignored files.
- Prefer `DIGITAL_OCEAN_TOKEN` for new automation.
