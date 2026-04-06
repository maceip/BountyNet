# BountyNet — Claude Code plugin

Native **Claude Code plugin** (not MCP-first): skills + `bin/` tools + status line.

## What it does

| Piece | Role |
|--------|------|
| **Skill** `onboard-staker` | `/bountynet:onboard-staker` — guided onboarding with consent rules |
| **`bin/bountynet-setup`** | Wizard: API key consent, build **`be`** from **`be-cli/`** (or use `be` on `PATH`), merge `statusLine` into `~/.claude/settings.json`, optional `be join` |
| **`bin/bountynet-statusline`** | Pink `bounty[agentId]` + remaining credits; **yellow `+Δ` flash** for a few seconds when gateway `GET /credits/<id>` **`total`** increases |

## `be` CLI resolution

The setup wizard looks for the **`be`** binary in order: `BOUNTYNET_BE_BIN`, your `PATH`, `~/.cargo/bin/be`, then it tries **`cargo build --release`** in every discovered `be-cli/` directory (walks up from the plugin, and honors **`BOUNTYNET_REPO_ROOT`** or `../..` from `integrations/claude-code-bountynet`).

## Install (dev — plugin dir)

From repo root:

```bash
claude --plugin-dir ./integrations/claude-code-bountynet
```

Then `/reload-plugins` if needed, and run:

```bash
bountynet-setup
```

(With plugin loaded, `bin/` is on the Bash tool `PATH`. You can also run `./integrations/claude-code-bountynet/bin/bountynet-setup`.)

## Install via npm (global CLI)

The same wizard and status-line scripts are published as **`bin`** entries on **Node 18+** (no runtime npm dependencies).

From a checkout:

```bash
cd integrations/claude-code-bountynet
npm link
# → bountynet-setup, bountynet-statusline on your PATH
bountynet-setup
```

Or install from a packed tarball / registry once published:

```bash
npm install -g @bountynet/claude-code-plugin
bountynet-setup
```

**`statusLine.command`** in `~/.claude/settings.json` points at your local **`node`** plus **`lib/statusline.mjs`** inside the installed package, so moving or deleting the install breaks the line until you run **`bountynet-setup`** again.

## Status line + another plugin

Claude Code only supports **one** `statusLine.command` in `~/.claude/settings.json`, so a second skill that edits the same field can hide BountyNet (or the other way around).

Running **`bountynet-setup`** when something else is already configured prompts: **chain** (run the old command first, then BountyNet — combined with ` | `) or **replace** (BountyNet only). The upstream command is stored in `~/.bountynet/statusline-chain.json`. The entry script is `lib/statusline-chain.mjs`.

## Mock status line (no gateway)

```bash
export BOUNTYNET_STATUSLINE_MOCK=1
claude --plugin-dir ./integrations/claude-code-bountynet
```

## CLI commands (Rust binary **`be`** from `be-cli/`)

- `be join` — Dynamic / GitHub OAuth, writes `~/.bountynet/agent.json`
- `be bounties watch` — poll claimable bounties
- `be status` — agent summary

## Consent

Setup **never** scrapes keychains. It only uses `ANTHROPIC_API_KEY` if the user confirms, or a one-line paste into the wizard.

## References

- [Claude Code status line](https://docs.anthropic.com/en/docs/claude-code/statusline)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins.md)
