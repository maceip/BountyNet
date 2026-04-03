"""BountyNet Solver Bot — Silverback event-driven agent.

Listens for BountyCreated events, claims bounties, invokes inference,
submits fixes, and triggers resolution.

Usage:
  silverback run bots/solver --network :arc-testnet:
"""
import os
import json
from datetime import datetime

import boa
from silverback import SilverbackBot, StateSnapshot

# Load deployment addresses
DEPLOYMENTS = {}
if os.path.exists("deployments.json"):
    with open("deployments.json") as f:
        DEPLOYMENTS = json.load(f)

bot = SilverbackBot()


@bot.on_startup()
def startup(state: StateSnapshot):
    """Initialize bot state on startup."""
    bot.state.bounties_seen = 0
    bot.state.bounties_claimed = 0
    bot.state.bounties_resolved = 0
    bot.state.active_bounty = None

    print("=" * 60)
    print("BountyNet Solver Bot")
    print(f"  Escrow:     {DEPLOYMENTS.get('bounty_escrow', 'not set')}")
    print(f"  Identity:   {DEPLOYMENTS.get('identity_registry', 'not set')}")
    print(f"  Validation: {DEPLOYMENTS.get('validation_registry', 'not set')}")
    print(f"  Last block: {state.last_block_seen}")
    print("=" * 60)

    return {"started_at": str(datetime.utcnow()), "last_block": state.last_block_seen}


# ── Event handlers (wired up when escrow contract is loaded) ────

# These will be connected to the actual contract events once
# Silverback's Ape integration supports custom Vyper ABIs.
# For now, we use block-based polling as the trigger.

from ape import chain
from ape.api import BlockAPI


@bot.on_(chain.blocks)
def on_new_block(block: BlockAPI):
    """
    Poll each block for new bounties.
    In production, this becomes @bot.on_(escrow.BountyCreated).
    """
    bot.state.bounties_seen = block.number  # track progress

    # TODO: Query escrow for new BountyCreated events in this block
    # For now, log heartbeat every 10 blocks
    if block.number % 10 == 0:
        print(f"[block {block.number}] solver bot alive, {len(block.transactions)} txs")

    return {"block": block.number, "txs": len(block.transactions)}


@bot.cron("*/1 * * * *")
def check_active_bounties(time: datetime):
    """Every minute: check if we have active work, report status."""
    print(f"[{time.strftime('%H:%M')}] Status: seen={bot.state.bounties_seen} claimed={bot.state.bounties_claimed} resolved={bot.state.bounties_resolved}")
    return {
        "seen": bot.state.bounties_seen,
        "claimed": bot.state.bounties_claimed,
        "resolved": bot.state.bounties_resolved,
    }


@bot.on_shutdown()
def shutdown():
    """Clean shutdown — report final stats."""
    print(f"Solver bot shutting down. Final stats: claimed={bot.state.bounties_claimed} resolved={bot.state.bounties_resolved}")
    return {
        "claimed": bot.state.bounties_claimed,
        "resolved": bot.state.bounties_resolved,
    }
