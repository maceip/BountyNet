#!/usr/bin/env node
/**
 * Claude Code status line — zero deps.
 * See https://docs.anthropic.com/en/docs/claude-code/statusline
 */
import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";

const STATE_PATH = path.join(os.homedir(), ".bountynet/statusline-state.json");
const AGENT_PATH = path.join(os.homedir(), ".bountynet/agent.json");

const PINK = "\x1b[38;5;213m";
const FLASH = "\x1b[1;93m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function saveJson(p, o) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(o, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

function fetchJson(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(
      url,
      { headers: { Accept: "application/json" }, timeout: 2000 },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");

  let sess = {};
  try {
    if (raw.trim()) sess = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  const model = sess.model?.display_name ?? "?";
  const now = Date.now() / 1000;

  if (process.env.BOUNTYNET_STATUSLINE_MOCK === "1") {
    const state = loadJson(STATE_PATH);
    const n = (Number(state.mock_invocation) || 0) + 1;
    state.mock_invocation = n;
    const mockRem = 9000 + (n % 5) * 100;
    if (n % 12 === 0) {
      state.flash_until = now + 2.8;
      state.flash_delta = 100;
    }
    saveJson(STATE_PATH, state);
    let flash = "";
    if (now < Number(state.flash_until || 0) && state.flash_delta) {
      flash = ` ${FLASH}+${parseInt(String(state.flash_delta), 10)}${RESET}`;
    }
    console.log(`${DIM}[${model}]${RESET} ${PINK}bounty[mock]${RESET} cr ${mockRem.toLocaleString("en-US")}${flash}`);
    return;
  }

  const agent = loadJson(AGENT_PATH);
  if (!agent.agent_id) {
    console.log(`${DIM}[${model}]${RESET} ${PINK}bounty[—]${RESET} run \`be join\``);
    return;
  }

  const aid = Number(agent.agent_id);
  const gw = agent.gateway || "https://gateway.stare.network";
  const credits = await fetchJson(`${gw.replace(/\/$/, "")}/credits/${aid}`);

  const total = credits?.total;
  const remaining = credits?.remaining;

  const state = loadJson(STATE_PATH);

  if (typeof total === "number") {
    const last = state.last_total;
    if (typeof last === "number" && total > last) {
      state.flash_delta = total - last;
      state.flash_until = now + 3.0;
    }
    state.last_total = total;
  }

  let flashSuffix = "";
  if (now < Number(state.flash_until || 0) && state.flash_delta) {
    flashSuffix = ` ${FLASH}+${parseInt(String(state.flash_delta), 10)}${RESET}`;
  }

  saveJson(STATE_PATH, state);

  const remS = typeof remaining === "number" ? remaining.toLocaleString("en-US") : "—";
  console.log(`${DIM}[${model}]${RESET} ${PINK}bounty[${aid}]${RESET} cr ${remS}${flashSuffix}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
