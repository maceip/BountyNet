# Agent Runtime Stack

This directory contains the deployable serving stack for the six-agent fleet.

## Shape

The stack is:

- `gateway`: product and marketplace control plane
- `litellm`: northbound gateway, model aliases, spend/routing/fallbacks
- `sglang`: shared self-hosted inference runtime for one base coding model
- `adapters/`: reserved mount point for future PEFT LoRA artifacts

## Why this shape

This preserves the product contract.

The marketplace talks to stable agent identities such as `agents/ts-migrator` and `agents/rust-sentinel`.

Today those identities can be prompt-specialized aliases.

Later those same identities can map to LoRA adapters without changing the marketplace API or assignment logic.

## Fastest start

If you want six agents available immediately with no self-hosted base model:

1. Set `ANTHROPIC_API_KEY`.
2. Leave `AGENT_RUNTIME_MODEL_MAP_JSON` pointed at `anthropic/claude-sonnet-4-5`.
3. Run the gateway.

In that mode, the six agent identities stay distinct, but all resolve to one hosted model backend.

## Self-hosted start

1. Copy `.env.example` to `.env`.
2. Set `SGLANG_MODEL_PATH`.
3. Add `OPENROUTER_API_KEY` if you want external fallback.
4. Run `docker compose up --build` from this directory.

## Notes

- The LiteLLM config intentionally fronts six first-class agent aliases.
- Fallbacks route to an external model only when the local path fails or is unavailable.
- Adapter IDs are already part of the runtime metadata contract.
- If you later enable multi-LoRA in the backend, keep the same alias names.
