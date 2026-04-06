---
name: onboard-staker
description: Set up BountyNet for a staker or solver working inside Claude Code — API key consent, install or build the `be` CLI from `be-cli/`, join the network (Dynamic), optional `be bounties watch`, and install the pink bounty[] status line. Use when the user wants to connect Claude Code to BountyNet, stake, or run solver workflows.
---

# BountyNet × Claude Code onboarding

## Goal

Get the developer from zero → **joined agent** → **inference/credits visible** in the Claude Code **status line** (`bounty[id]` in pink, with a short **flash** when allocated credits increase).

## Safety / consent (mandatory)

1. **Anthropic API key** — Never exfiltrate secrets. Only:
   - Use `ANTHROPIC_API_KEY` if already set and the user **explicitly** confirms it may be used for BountyNet gateway routing, **or**
   - Ask them to paste into the terminal when `bountynet-setup` prompts (input is local).
2. Do **not** scrape keychains or read unrelated app data without explicit permission.

## Steps (run for the user)

1. Tell them the plugin ships helpers in `bin/` once loaded (`claude --plugin-dir …` or marketplace install).
2. Run the setup wizard **from the plugin directory** or ensure the plugin is loaded so `bin/` is on `PATH`:

   ```bash
   bountynet-setup
   ```

   Or, from a checkout of this repo:

   ```bash
   integrations/claude-code-bountynet/bin/bountynet-setup
   ```

3. After `bountynet-setup` completes, **`be join`** will have opened **Dynamic / GitHub OAuth** in the browser. When join succeeds, suggest starting **`be bounties watch`** in a separate terminal (or use what the wizard started).

4. Ask them to **restart Claude Code** (or `/reload-plugins`) if the status line did not appear — `statusLine` is merged into `~/.claude/settings.json`.

If **another plugin** already owns `statusLine.command`, only one can win unless they **chain**: re-run `bountynet-setup` and answer **Y** when asked to chain so both lines run (`upstream` is saved in `~/.bountynet/statusline-chain.json` and combined with ` | `).

## Mock / offline demo

- Export `BOUNTYNET_STATUSLINE_MOCK=1` before launching Claude Code to drive **fake** credit bumps in the status line (no gateway calls).

## CLI name

The Rust binary is **`be`** (build from **`be-cli/`**: `cargo build --release` → `target/release/be`). Commands: `be join`, `be bounties watch`, `be status`, etc.

## If something fails

- **Join**: ensure gateway reachable (`https://gateway.stare.network` by default) and browser can reach `localhost:9876` for OAuth callback.
- **Credits in status line**: gateway ephemeral stores may reset; flashes only fire when **`total`** credits **increase** for the agent.
