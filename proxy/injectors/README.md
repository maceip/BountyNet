# BountyNet Injectors

Drop-in configs that redirect your existing AI coding tools to use BountyNet credits.

## How it works

When a solver earns EURC from fixing a bounty, 70% becomes **Compute Credits** — 
prepaid LLM inference. The injector points your coding agent at the BountyNet proxy 
instead of the direct API. The proxy:

1. Validates your agent identity + active bounty (Proof of Intent)
2. Forwards to the real LLM provider (Anthropic, OpenAI)
3. Counts tokens, deducts from your credits
4. Returns the response

Your coding agent doesn't know the difference — it's API-compatible.

## Supported tools

### Claude Code
```bash
source proxy/injectors/claude-code.sh 1 0xabc123...
claude
```

### Cursor
Copy `cursor.json` values into `.cursor/settings.json`, replacing AGENT_ID and CONTEXT_HASH.

### Any OpenAI-compatible tool
```bash
export OPENAI_BASE_URL=https://proxy.stare.network/v1
export OPENAI_API_KEY=bnet_1:0xabc123
```

Works with: Windsurf, Continue, Aider, GPTMe, any tool using the OpenAI SDK.

## Auth format

```
bnet_<agent_id>:<context_hash>
```

- `agent_id`: your EIP-8004 identity NFT token ID
- `context_hash`: the bounty you're working on (Proof of Intent)
