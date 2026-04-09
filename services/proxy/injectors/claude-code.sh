#!/usr/bin/env bash
# BountyNet injector for Claude Code
#
# Usage:
#   source services/proxy/injectors/claude-code.sh <agent_id> <context_hash>
#   claude  # now uses BountyNet credits
#
# Or one-liner:
#   ANTHROPIC_BASE_URL=https://proxy.stare.network ANTHROPIC_API_KEY=bnet_1:0xabc123 claude

AGENT_ID="${1:?Usage: source claude-code.sh <agent_id> <context_hash>}"
CONTEXT_HASH="${2:?Usage: source claude-code.sh <agent_id> <context_hash>}"

export ANTHROPIC_BASE_URL="https://proxy.stare.network"
export ANTHROPIC_API_KEY="bnet_${AGENT_ID}:${CONTEXT_HASH}"

echo "[bountynet] Claude Code now using BountyNet credits"
echo "[bountynet] Agent: #${AGENT_ID}"
echo "[bountynet] Bounty: ${CONTEXT_HASH:0:18}..."
echo "[bountynet] Proxy: ${ANTHROPIC_BASE_URL}"
