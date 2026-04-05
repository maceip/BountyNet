#!/usr/bin/env node
/**
 * Runs the previous statusLine command (if any), then BountyNet statusline.mjs,
 * on the same stdin JSON. One combined line for Claude Code.
 */
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUSLINE_JS = path.join(__dirname, "statusline.mjs");
const CHAIN_PATH = path.join(os.homedir(), ".bountynet", "statusline-chain.json");

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const raw = Buffer.concat(chunks).toString("utf8");

function firstLine(s) {
  const line = String(s || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find(Boolean);
  return line || "";
}

let upstream = "";
try {
  const j = JSON.parse(fs.readFileSync(CHAIN_PATH, "utf8"));
  if (j && typeof j.upstream === "string") upstream = j.upstream.trim();
} catch {
  /* none */
}

let left = "";
if (upstream) {
  const r = child_process.spawnSync(upstream, {
    shell: true,
    input: raw,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  left = firstLine(r.stdout);
}

const r2 = child_process.spawnSync(process.execPath, [STATUSLINE_JS], {
  input: raw,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  windowsHide: true,
});
const right = firstLine(r2.stdout);

if (left && right) process.stdout.write(`${left}  |  ${right}\n`);
else process.stdout.write(`${right || left}\n`);
