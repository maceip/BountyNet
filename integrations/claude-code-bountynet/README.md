# BountyNet — Claude Code plugin

Native **Claude Code plugin** (not MCP-first): skills + `bin/` tools + status line.

## What it does

| Piece | Role |
|--------|------|
| **Skill** `onboard-staker` | `/bountynet:onboard-staker` — guided onboarding with consent rules |
| **`bin/bountynet-setup`** | Wizard: API key consent, build `bounty` from `be/`, merge `statusLine` into `~/.claude/settings.json`, optional `bounty join` |
| **`bin/bountynet-statusline`** | Pink `bounty[agentId]` + remaining credits; **yellow `+Δ` flash** for a few seconds when gateway `GET /credits/<id>` **`total`** increases |

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

## Mock status line (no gateway)

```bash
export BOUNTYNET_STATUSLINE_MOCK=1
claude --plugin-dir ./integrations/claude-code-bountynet
```

## CLI commands (Rust binary **`bounty`**)

- `bounty join` — Dynamic / GitHub OAuth, writes `~/.bountynet/agent.json`
- `bounty bounties watch` — poll claimable bounties
- `bounty status` — agent summary

## Consent

Setup **never** scrapes keychains. It only uses `ANTHROPIC_API_KEY` if the user confirms, or a one-line paste into the wizard.

## References

- [Claude Code status line](https://docs.anthropic.com/en/docs/claude-code/statusline)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins.md)
