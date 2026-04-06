#!/usr/bin/env node
/**
 * BountyNet wizard — Node (npm bundle). Zero runtime deps.
 */
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const STATUSLINE_JS = path.join(PLUGIN_ROOT, "lib", "statusline.mjs");
const CHAIN_JS = path.join(PLUGIN_ROOT, "lib", "statusline-chain.mjs");
const CHAIN_PATH = path.join(os.homedir(), ".bountynet", "statusline-chain.json");

/** Monorepo root when plugin lives at integrations/claude-code-bountynet */
const DEFAULT_REPO_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");

function collectBeCliCandidates() {
  const dirs = [];
  const envCli = process.env.BOUNTYNET_BE_CLI?.trim();
  if (envCli) dirs.push(envCli);
  const envRoot = process.env.BOUNTYNET_REPO_ROOT?.trim();
  const roots = new Set();
  if (envRoot) roots.add(path.resolve(envRoot));
  roots.add(DEFAULT_REPO_ROOT);
  let walk = PLUGIN_ROOT;
  for (let i = 0; i < 10; i++) {
    roots.add(walk);
    walk = path.dirname(walk);
  }
  for (const r of roots) {
    const c = path.join(r, "be-cli");
    if (fs.existsSync(path.join(c, "Cargo.toml"))) dirs.push(c);
  }
  return [...new Set(dirs)];
}

function cargoHomeBe() {
  const home = os.homedir();
  const name = process.platform === "win32" ? "be.exe" : "be";
  return path.join(home, ".cargo", "bin", name);
}

/** readline/promises breaks after the first prompt when stdin is a pipe; drain first. */
let ttyRl = null;
let stdinLines = null;

async function bootstrapStdin() {
  if (!process.stdin.isTTY) {
    stdinLines = [];
    const probe = readline.createInterface({ input: process.stdin });
    for await (const line of probe) stdinLines.push(line);
  } else {
    ttyRl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
}

async function ask(prompt) {
  if (stdinLines) {
    process.stdout.write(prompt);
    return stdinLines.length ? stdinLines.shift() : "";
  }
  return new Promise((resolve) => ttyRl.question(prompt, resolve));
}

async function closeReadline() {
  if (ttyRl) ttyRl.close();
}

function run(cmd, args, opts = {}) {
  const r = child_process.spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  return r.status ?? 0;
}

function commandReferencesOurStatusline(cmd) {
  if (!cmd || typeof cmd !== "string") return false;
  if (cmd.includes("statusline-chain.mjs")) return false;
  try {
    const parts = cmd.match(/'[^']+'|"[^"]+"|\S+/g) || [];
    for (const p of parts) {
      const u = p.replace(/^['"]|['"]$/g, "");
      if (!u.endsWith("statusline.mjs")) continue;
      if (path.resolve(u) === path.resolve(STATUSLINE_JS)) return true;
    }
  } catch {
    /* */
  }
  return false;
}

function explicitBeBin() {
  const v = process.env.BOUNTYNET_BE_BIN?.trim();
  if (v && fs.existsSync(v)) return path.resolve(v);
  return null;
}

function whichBe() {
  const hit = explicitBeBin();
  if (hit) return hit;
  const name = process.platform === "win32" ? "be.exe" : "be";
  const pathEnv = process.env.PATH || "";
  for (const dir of pathEnv.split(path.delimiter)) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  const cargo = cargoHomeBe();
  if (fs.existsSync(cargo)) return cargo;
  return null;
}

function releaseBePath(beCliDir) {
  const rel = process.platform === "win32" ? ["target", "release", "be.exe"] : ["target", "release", "be"];
  return path.join(beCliDir, ...rel);
}

async function main() {
  await bootstrapStdin();

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 BountyNet × Claude Code — setup (npm bundle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  if (process.env.ANTHROPIC_API_KEY) {
    const ok = (await ask("ANTHROPIC_API_KEY is set. OK to use for BountyNet docs (y/N)? ")).trim();
    if (!/^y/i.test(ok)) {
      console.log("Skipping key assumptions.");
    }
  } else {
    console.log("No ANTHROPIC_API_KEY.");
    const key = (await ask("Paste Anthropic API key (visible) or Enter to skip: ")).trim();
    if (key) process.env.ANTHROPIC_API_KEY = key;
  }

  let beBin = whichBe();
  if (beBin) {
    console.log("Using be CLI:", beBin);
  } else {
    const candidates = collectBeCliCandidates();
    let built = null;
    for (const beCliDir of candidates) {
      console.log("Building `be` from", beCliDir, "…");
      const st = run("cargo", ["build", "--release"], { cwd: beCliDir, env: process.env });
      if (st === 0) {
        const out = releaseBePath(beCliDir);
        if (fs.existsSync(out)) {
          built = out;
          break;
        }
      }
    }
    if (built) {
      beBin = built;
      console.log("Built:", beBin);
    } else {
      console.error(`
Could not find or build the BountyNet CLI (binary name: be).

Fix one of:
  • Put "be" on your PATH (e.g. cargo install --path /path/to/BountyNet/be-cli)
  • Set BOUNTYNET_BE_BIN to the full path of the "be" executable
  • Set BOUNTYNET_REPO_ROOT to your BountyNet checkout (must contain be-cli/)
  • Clone github.com/maceip/BountyNet and run this wizard from that tree
`);
      process.exit(1);
    }
  }

  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  const q = (s) => (/[^\w@%+=:,./-]/.test(s) ? `'${String(s).replace(/'/g, `'\\''`)}'` : s);
  let data = {};
  if (fs.existsSync(settingsPath)) {
    try {
      data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      data = {};
    }
  }

  const existingCmd =
    data.statusLine?.type === "command" && typeof data.statusLine.command === "string"
      ? data.statusLine.command.trim()
      : "";

  let upstream = "";
  if (existingCmd.includes("statusline-chain.mjs")) {
    try {
      const j = JSON.parse(fs.readFileSync(CHAIN_PATH, "utf8"));
      if (j && typeof j.upstream === "string") upstream = j.upstream;
    } catch {
      /* */
    }
  } else if (existingCmd && !commandReferencesOurStatusline(existingCmd)) {
    const ans = (
      await ask(
        "Another plugin/skill already set statusLine.command. Chain BountyNet after it (both show, Y), or replace with BountyNet only (n)? (Y/n) ",
      )
    ).trim();
    if (/^n/i.test(ans)) upstream = "";
    else upstream = existingCmd;
  }

  if (upstream) {
    fs.mkdirSync(path.dirname(CHAIN_PATH), { recursive: true });
    fs.writeFileSync(CHAIN_PATH, JSON.stringify({ upstream }, null, 2) + "\n", "utf8");
    data.statusLine = {
      type: "command",
      padding: 2,
      command: `${q(process.execPath)} ${q(CHAIN_JS)}`,
    };
    console.log("Chained status line: upstream saved to", CHAIN_PATH);
  } else {
    try {
      fs.unlinkSync(CHAIN_PATH);
    } catch {
      /* */
    }
    data.statusLine = {
      type: "command",
      padding: 2,
      command: `${q(process.execPath)} ${q(STATUSLINE_JS)}`,
    };
  }

  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf8");
  console.log("Wrote statusLine to", settingsPath);
  console.log("  command:", data.statusLine.command);

  const djoin = (await ask("Run `be join` now (browser OAuth)? (Y/n) ")).trim();
  if (!/^n/i.test(djoin)) {
    run(beBin, ["join"], { env: process.env });
  }

  console.log(`
Optional: in another terminal:
  ${beBin} bounties watch

Restart Claude Code or send a message so the status line refreshes.
`);

  await closeReadline();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
