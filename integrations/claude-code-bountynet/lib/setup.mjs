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
const BE_DIR = path.resolve(PLUGIN_ROOT, "..", "..", "be");

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

function whichBounty() {
  const pathEnv = process.env.PATH || "";
  for (const dir of pathEnv.split(path.delimiter)) {
    const p = path.join(dir, process.platform === "win32" ? "bounty.exe" : "bounty");
    if (fs.existsSync(p)) return p;
  }
  return null;
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

  let bountyBin = whichBounty();
  if (bountyBin) {
    console.log("Found bounty:", bountyBin);
  } else {
    console.log("Installing bounty CLI...");
    const installDir = path.join(os.homedir(), ".bountynet", "bin");
    fs.mkdirSync(installDir, { recursive: true });
    bountyBin = path.join(installDir, "bounty");

    const arch = os.arch() === "x64" ? "x64" : "arm64";
    const platform = os.platform();
    const url = `https://bountynet.stare.network/bounty-${platform}-${arch}`;

    console.log(`Downloading from ${url}...`);
    const st = run("curl", ["-fsSL", url, "-o", bountyBin]);
    if (st !== 0) {
      console.error("Download failed. Install manually:");
      console.error(`  curl -fsSL ${url} -o ${bountyBin} && chmod +x ${bountyBin}`);
      process.exit(1);
    }
    fs.chmodSync(bountyBin, 0o755);
    console.log("Installed:", bountyBin);
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

  const djoin = (await ask("Run bounty join now (browser OAuth)? (Y/n) ")).trim();
  if (!/^n/i.test(djoin)) {
    run(bountyBin, ["join"], { env: process.env });
  }

  console.log(`
Optional: in another terminal:
  ${bountyBin} bounties watch

Restart Claude Code or send a message so the status line refreshes.
`);

  await closeReadline();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
