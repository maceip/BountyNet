#!/usr/bin/env node
/**
 * BountyNet wizard — Node (npm bundle). Zero runtime deps.
 */
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const STATUSLINE_JS = path.join(PLUGIN_ROOT, "lib", "statusline.mjs");
const BE_DIR = path.resolve(PLUGIN_ROOT, "..", "..", "be");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function run(cmd, args, opts = {}) {
  const r = child_process.spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  return r.status ?? 0;
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
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 BountyNet × Claude Code — setup (npm bundle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  if (process.env.ANTHROPIC_API_KEY) {
    const ok = (await rl.question("ANTHROPIC_API_KEY is set. OK to use for BountyNet docs (y/N)? ")).trim();
    if (!/^y/i.test(ok)) {
      console.log("Skipping key assumptions.");
    }
  } else {
    console.log("No ANTHROPIC_API_KEY.");
    const key = (await rl.question("Paste Anthropic API key (visible) or Enter to skip: ")).trim();
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
  data.statusLine = {
    type: "command",
    padding: 2,
    command: `${q(process.execPath)} ${q(STATUSLINE_JS)}`,
  };

  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf8");
  console.log("Wrote statusLine to", settingsPath);
  console.log("  command:", data.statusLine.command);

  const djoin = (await rl.question("Run bounty join now (browser OAuth)? (Y/n) ")).trim();
  if (!/^n/i.test(djoin)) {
    run(bountyBin, ["join"], { env: process.env });
  }

  console.log(`
Optional: in another terminal:
  ${bountyBin} bounties watch

Restart Claude Code or send a message so the status line refreshes.
`);

  await rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
