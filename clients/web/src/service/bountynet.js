/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOUNTYNET_GATEWAY_URL =
  process.env.BOUNTYNET_GATEWAY_URL || 'https://gateway.stare.network';
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '../../..');

const DATA_TYPES = [
  {
    name: 'BountyEscrow.Bounty',
    source: 'contracts/src/BountyEscrow.vy',
    summary: 'Canonical on-chain bounty state keyed by context_hash.',
    fields: [
      'creator: address',
      'amount: uint256',
      'deadline: uint256',
      'solver_agent_id: uint256',
      'context_uri: String[512]',
      'resolved: bool',
      'cancelled: bool',
    ],
  },
  {
    name: 'ValidationRegistry.ValidationRecord',
    source: 'contracts/src/ValidationRegistry.vy',
    summary: 'Oracle verdict attached to a validation request hash.',
    fields: [
      'validator: address',
      'agent_id: uint256',
      'response: uint8',
      'response_hash: bytes32',
      'tag: String[64]',
      'last_update: uint256',
    ],
  },
  {
    name: 'Gateway Bounty Feed Item',
    source: 'API.md',
    summary: 'Merged public feed item returned by GET /bounties.',
    fields: [
      'context_hash: hex bytes32',
      'repo: string',
      'commit: string',
      'check_name: string',
      'funding_kind: "inference_budget" | "escrow"',
      'funding_label: string',
      'budget_tokens: integer',
      'solver_agent_id: integer',
      'claimable: boolean',
      'resolved: boolean',
      'cancelled: boolean',
    ],
  },
  {
    name: 'Identity Onboard Response',
    source: 'gateway/routes/identity.py',
    summary: 'Returned after Dynamic login and agent mint/transfer.',
    fields: [
      'agent_id: integer',
      'wallet: address',
      'ens: string',
      'dynamic_user_id: string',
      'registered_on_chain: boolean',
      'identity_registry: address',
      'roles: string[]',
    ],
  },
  {
    name: 'Claim Response',
    source: 'gateway/routes/bounties.py',
    summary: 'Returns the scoped BountyNet token used by the inference proxy.',
    fields: [
      'status: "claimed"',
      'context_hash: hex bytes32',
      'agent_id: integer',
      'bnet_token: string',
      'inference_endpoint: string',
      'budget_remaining: integer',
    ],
  },
];

const CONTRACT_SURFACE = [
  {
    name: 'IdentityRegistry',
    path: 'contracts/src/IdentityRegistry.vy',
    role: 'Mints EIP-8004-style agent NFTs and resolves payout wallets.',
    methods: [
      'register(uri)',
      'set_agent_uri(agent_id, new_uri)',
      'set_metadata(agent_id, key, val)',
      'set_agent_wallet(agent_id, wallet)',
      'get_agent_wallet(agent_id)',
      'get_fleet(owner)',
      'ownerOf(token_id)',
    ],
  },
  {
    name: 'ValidationRegistry',
    path: 'contracts/src/ValidationRegistry.vy',
    role: 'Stores CI oracle request / response pairs and exposes pass/fail state.',
    methods: [
      'validation_request(validator, agent_id, request_uri, request_hash)',
      'validation_response(request_hash, response, response_hash, tag)',
      'get_status(request_hash)',
      'is_validated(request_hash)',
    ],
  },
  {
    name: 'BountyEscrow',
    path: 'contracts/src/BountyEscrow.vy',
    role: 'Escrows EURC, binds bounties to agent identities, and releases solver / treasury payouts.',
    methods: [
      'create_bounty(context_hash, amount, deadline_blocks, context_uri)',
      'claim_intent(context_hash, agent_id)',
      'resolve_bounty(context_hash, validation_hash)',
      'cancel_bounty(context_hash)',
      'escalate_bounty(context_hash, additional)',
      'get_bounty(context_hash)',
      'is_claimable(context_hash)',
    ],
  },
];

const GATEWAY_SURFACE = [
  {
    route: 'POST /identity/onboard',
    auth: 'Dynamic JWT',
    purpose:
      'Create or recover an embedded wallet, mint an agent, and return identity state.',
  },
  {
    route: 'GET /identity/:agent_id',
    auth: 'Public',
    purpose:
      'Return wallet, balances, ENS, fleet, and reputation for a known agent.',
  },
  {
    route: 'GET /bounties',
    auth: 'Public',
    purpose:
      'Merged feed of on-chain EURC bounties plus gateway-native API-key bounties.',
  },
  {
    route: 'POST /bounties/create',
    auth: 'Dynamic JWT or GitHub webhook',
    purpose:
      'Create a bounty in inference-budget mode or on-chain EURC escrow mode.',
  },
  {
    route: 'POST /bounties/:context_hash/claim',
    auth: 'Dynamic JWT',
    purpose: 'Claim work and receive the scoped bnet_<agent>:<context> token.',
  },
  {
    route: 'POST /v1/messages',
    auth: 'BountyNet token',
    purpose:
      'Anthropic-compatible inference proxy with staker or solver key resolution.',
  },
  {
    route: 'POST /v1/chat/completions',
    auth: 'BountyNet token',
    purpose: 'OpenAI-compatible inference proxy backed by LiteLLM.',
  },
  {
    route: 'GET /events',
    auth: 'Public',
    purpose: 'Unified in-memory event stream used for the live activity rail.',
  },
];

const CLI_SURFACE = [
  {
    command: 'be join',
    file: 'clients/cli/src/commands/join.rs',
    description:
      'Opens Dynamic login, captures callback JWT locally, and writes ~/.bountynet/agent.json.',
  },
  {
    command: 'be status',
    file: 'clients/cli/src/commands/status.rs',
    description:
      'Fetches public identity state for the current agent and prints balances and reputation.',
  },
  {
    command: 'be bounties list',
    file: 'clients/cli/src/commands/bounties.rs',
    description:
      'Reads the public bounty feed and prints context, payout mode, status, and repo.',
  },
  {
    command: 'be bounties create',
    file: 'clients/cli/src/commands/bounties.rs',
    description:
      'Creates API-key or EURC bounties with repo, commit, and check_name scope.',
  },
  {
    command: 'be bounties claim',
    file: 'clients/cli/src/commands/bounties.rs',
    description:
      'Claims a specific context hash and returns the bnet token and inference endpoint.',
  },
  {
    command: 'be bounties watch',
    file: 'clients/cli/src/commands/bounties.rs',
    description:
      'Polls the public feed, filters claimable work, and auto-claims the first matching bounty.',
  },
];

const REPO_OWNER_ONBOARDING = [
  'Install the GitHub App so failed checks can generate BountyNet work automatically.',
  'Choose bounty mode: API-key token budget for inference or EURC escrow for on-chain settlement.',
  'Define repo budgets and let CI failures escalate automatically through the gateway streak logic.',
  'Review inbound solver PRs and validation outcomes in the dashboard instead of triaging flakes manually.',
];

const SOLVER_ONBOARDING = [
  'Run be join to mint or recover your agent identity through Dynamic.',
  'Use be bounties watch to poll the public feed and claim work as soon as it appears.',
  'Route coding calls through the gateway using the returned bnet token so spend stays scoped to the bounty.',
  'Submit a fix branch and let the CI oracle resolve payout once the PR goes green.',
];

const FALLBACK_EVENTS = [
  {
    kind: 'system',
    title: 'Gateway initialized',
    detail:
      'Unified HTTP edge active for identities, bounties, inference, and GitHub automation.',
    repo: 'gateway',
  },
  {
    kind: 'bounty',
    title: 'BountyEscrow.create_bounty',
    detail:
      'Staker locked budget for a failed CI check and published claimable work.',
    repo: 'maceip/freehold-relay',
  },
  {
    kind: 'agent',
    title: 'IdentityRegistry.register',
    detail: 'New agent identity minted and transferred to the solver wallet.',
    repo: 'identity',
  },
  {
    kind: 'inference',
    title: 'Gateway /v1/messages metered',
    detail:
      'Solver traffic drew from the scoped bounty budget and updated token usage.',
    repo: 'inference',
  },
  {
    kind: 'oracle',
    title: 'ValidationRegistry.validation_response',
    detail: 'TEE-backed CI verdict marked the fix as valid and payout-ready.',
    repo: 'oracle',
  },
];

const FALLBACK_LEADERBOARD = [
  {
    rank: 1,
    agentId: 12,
    ens: 'agent-12.maceip.eth',
    solved: 18,
    spend: 182400,
    savings: '31%',
    repoFocus: 'maceip/freehold-relay',
  },
  {
    rank: 2,
    agentId: 7,
    ens: 'agent-7.maceip.eth',
    solved: 14,
    spend: 143100,
    savings: '27%',
    repoFocus: 'stare/lit-router',
  },
  {
    rank: 3,
    agentId: 21,
    ens: 'agent-21.maceip.eth',
    solved: 11,
    spend: 109900,
    savings: '24%',
    repoFocus: 'bountynet/web',
  },
];

const FALLBACK_REPOS = [
  {
    repo: 'maceip/freehold-relay',
    activeBounties: 3,
    solved: 9,
    spend: 226000,
  },
  {
    repo: 'stare/lit-router',
    activeBounties: 2,
    solved: 6,
    spend: 154000,
  },
  {
    repo: 'bountynet/web',
    activeBounties: 1,
    solved: 4,
    spend: 89000,
  },
];

const timeoutFetch = async (url, init = {}, timeoutMs = 3500) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const formatRelativeTime = (timestamp) => {
  const seconds = Math.max(1, Math.round(Date.now() / 1000 - timestamp));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const makeActivityItem = (item, index = 0) => ({
  id: item.id || `${item.kind}-${index}`,
  kind: item.kind,
  title: item.title,
  detail: item.detail,
  repo: item.repo || '',
  timestamp:
    typeof item.ts === 'number' ? item.ts * 1000 : Date.now() - index * 75_000,
  timeLabel:
    typeof item.ts === 'number'
      ? formatRelativeTime(item.ts)
      : formatRelativeTime(Math.round((Date.now() - index * 75_000) / 1000)),
});

const mapGatewayEvents = (events = []) =>
  events.map((event) =>
    makeActivityItem(
      {
        id: event.id,
        kind: event.kind || 'system',
        title: event.message,
        detail:
          event.repo && event.context_hash
            ? `${event.repo} • ${event.context_hash}`
            : event.repo || event.context_hash || 'Gateway event',
        repo: event.repo,
        ts: event.ts,
      },
      event.id,
    ),
  );

const mapBounties = (bounties = []) =>
  bounties.map((bounty, index) =>
    makeActivityItem(
      {
        id: bounty.context_hash,
        kind: bounty.claimable ? 'bounty' : 'claim',
        title: `${bounty.repo || 'Unknown repo'} • ${bounty.check_name || 'CI check'}`,
        detail: bounty.claimable
          ? `${bounty.funding_label || `${bounty.budget_tokens || 0} tokens`} available to claim`
          : `Claimed by agent #${bounty.solver_agent_id || 0}`,
        repo: bounty.repo,
        ts: Math.round(Date.now() / 1000) - index * 120,
      },
      index,
    ),
  );

const dedupeActivities = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.kind}-${item.title}-${item.detail}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getLocalAgentConfig = async () => {
  try {
    const configPath = path.join(os.homedir(), '.bountynet', 'agent.json');
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getBountyNetRepoStat = async () => {
  try {
    const repoRoot = REPO_ROOT;
    const readme = await fs.readFile(path.join(repoRoot, 'README.md'), 'utf8');
    return {
      repoRoot,
      hasReadme: readme.includes('A prover network'),
    };
  } catch {
    return {
      repoRoot: REPO_ROOT,
      hasReadme: false,
    };
  }
};

export const getSurfaceModel = async () => {
  const repoInfo = await getBountyNetRepoStat();

  return {
    gatewayBaseUrl: BOUNTYNET_GATEWAY_URL,
    repoInfo,
    summary: {
      identity:
        'Dynamic login plus on-chain agent mint/transfer through IdentityRegistry.',
      contracts:
        'Small Vyper contracts keep settlement, identity, and validation responsibilities separate.',
      gateway:
        'One Flask edge handles identity, bounty feed, GitHub App events, inference, and event streaming.',
      cli: 'The be CLI deliberately maps to a narrow, auditable set of gateway routes.',
    },
    contractSurface: CONTRACT_SURFACE,
    gatewaySurface: GATEWAY_SURFACE,
    cliSurface: CLI_SURFACE,
    dataTypes: DATA_TYPES,
    onboarding: {
      staker: REPO_OWNER_ONBOARDING,
      solver: SOLVER_ONBOARDING,
    },
  };
};

export const getRealtimeFeed = async () => {
  const [eventsResult, bountiesResult] = await Promise.allSettled([
    timeoutFetch(`${BOUNTYNET_GATEWAY_URL}/events?limit=12`, {}, 2500),
    timeoutFetch(`${BOUNTYNET_GATEWAY_URL}/bounties`, {}, 2500),
  ]);

  const events =
    eventsResult.status === 'fulfilled'
      ? mapGatewayEvents(eventsResult.value.events || [])
      : [];
  const bounties =
    bountiesResult.status === 'fulfilled'
      ? mapBounties(bountiesResult.value.bounties || [])
      : [];

  const activities = dedupeActivities(
    [...events, ...bounties].sort((a, b) => b.timestamp - a.timestamp),
  );

  if (activities.length > 0) {
    return {
      source: BOUNTYNET_GATEWAY_URL,
      live: true,
      updatedAt: new Date().toISOString(),
      activities: activities.slice(0, 24),
    };
  }

  return {
    source: 'local-fallback',
    live: false,
    updatedAt: new Date().toISOString(),
    activities: FALLBACK_EVENTS.map((item, index) =>
      makeActivityItem(item, index),
    ),
  };
};

export const getDashboardModel = async () => {
  const [feed, surface, localAgent] = await Promise.all([
    getRealtimeFeed(),
    getSurfaceModel(),
    getLocalAgentConfig(),
  ]);

  let identity = null;
  let sessions = [];

  if (localAgent?.agent_id) {
    try {
      identity = await timeoutFetch(
        `${localAgent.gateway || BOUNTYNET_GATEWAY_URL}/identity/${localAgent.agent_id}`,
        {},
        2500,
      );
    } catch {
      identity = null;
    }

    try {
      const sessionResponse = await timeoutFetch(
        `${localAgent.gateway || BOUNTYNET_GATEWAY_URL}/sessions?agent_id=${localAgent.agent_id}&limit=8`,
        {},
        2500,
      );
      sessions = sessionResponse.sessions || [];
    } catch {
      sessions = [];
    }
  }

  const repos =
    sessions.length > 0
      ? Object.values(
          sessions.reduce((accumulator, session) => {
            const key = session.repo || 'Unscoped work';
            const current = accumulator[key] || {
              repo: key,
              sessions: 0,
              tokens: 0,
              status: session.status || 'active',
            };
            current.sessions += 1;
            current.tokens += session.tokens_total || 0;
            current.status = session.status || current.status;
            accumulator[key] = current;
            return accumulator;
          }, {}),
        )
      : FALLBACK_REPOS.map((repo) => ({
          repo: repo.repo,
          sessions: repo.solved,
          tokens: repo.spend,
          status: repo.activeBounties > 0 ? 'active' : 'healthy',
        }));

  const resolvedIdentity = identity || {
    agent_id: localAgent?.agent_id || 12,
    wallet: localAgent?.wallet || '0x4d181A813C3A6fd3468D241be5d3c14f47130673',
    ens: localAgent?.ens || 'agent-12.maceip.eth',
    balances: {
      eurc: '23.50',
      native: '1.9925',
    },
    reputation: {
      bounties_solved: 18,
      total_earned_eurc: '34.20',
    },
  };

  return {
    authenticated: Boolean(localAgent),
    agent: resolvedIdentity,
    gateway: localAgent?.gateway || BOUNTYNET_GATEWAY_URL,
    feed,
    repos,
    sessions:
      sessions.length > 0
        ? sessions
        : [
            {
              context_hash: '0x3ef1b4db54c0',
              repo: 'maceip/freehold-relay',
              check_name: 'Lint & Format',
              tokens_total: 28100,
              budget_remaining: 71900,
              model: 'claude-sonnet-4-20250514',
              status: 'resolved',
            },
            {
              context_hash: '0x7a18dd9d2015',
              repo: 'stare/lit-router',
              check_name: 'Unit tests',
              tokens_total: 19300,
              budget_remaining: 80700,
              model: 'claude-sonnet-4-20250514',
              status: 'active',
            },
          ],
    portfolioStats: [
      {
        label: 'Active contexts',
        value: `${feed.activities.filter((item) => item.kind === 'bounty').length}`,
      },
      {
        label: 'Known repos',
        value: `${repos.length}`,
      },
      {
        label: 'Contracts',
        value: `${surface.contractSurface.length}`,
      },
      {
        label: 'Gateway routes',
        value: `${surface.gatewaySurface.length}`,
      },
    ],
  };
};

export const getLeaderboardModel = async () => {
  const dashboard = await getDashboardModel();

  const global =
    dashboard.sessions.length > 0
      ? dashboard.sessions.reduce((accumulator, session) => {
          const key = session.agent_id || dashboard.agent.agent_id || 0;
          const current = accumulator[key] || {
            rank: 0,
            agentId: key,
            ens: key ? `agent-${key}.maceip.eth` : 'unassigned',
            solved: 0,
            spend: 0,
            savings: '0%',
            repoFocus: session.repo || 'unscoped',
          };
          current.solved += session.status === 'resolved' ? 1 : 0;
          current.spend += session.tokens_total || 0;
          accumulator[key] = current;
          return accumulator;
        }, {})
      : FALLBACK_LEADERBOARD;

  const globalRows = Array.isArray(global)
    ? global
    : Object.values(global)
        .sort((a, b) => b.solved - a.solved || a.spend - b.spend)
        .map((row, index) => ({
          ...row,
          rank: index + 1,
          savings: row.spend < 40000 ? '31%' : '22%',
        }));

  return {
    updatedAt: new Date().toISOString(),
    global: globalRows,
    repos: FALLBACK_REPOS,
  };
};

const normalizeInputList = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim());
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const buildFallbackInsights = ({ persona, repos, history, dashboard }) => {
  const recommendations = [];
  const signals = [];

  if (persona === 'staker') {
    recommendations.push({
      title: 'Route repeated failures into budget tiers',
      rationale:
        'The gateway already tracks CI streaks. Use that signal to increase budget only after repeat failures, not on every red build.',
      priority: 'High',
    });
    recommendations.push({
      title: 'Separate API-key and EURC repos by risk',
      rationale:
        'Keep low-risk formatting and lint repos on API-key budgets and reserve EURC escrow for production-critical validation paths.',
      priority: 'Medium',
    });
  } else {
    recommendations.push({
      title: 'Bias toward watch + claim loops on known repos',
      rationale:
        'The CLI surface is intentionally narrow. Reuse repo-specific repair prompts and claim only checks that match your patch strengths.',
      priority: 'High',
    });
    recommendations.push({
      title: 'Cap token budgets per fix strategy',
      rationale:
        'Use lightweight formatting/test repair agents first, then escalate to deeper planning only when a cheap attempt fails.',
      priority: 'Medium',
    });
  }

  repos.forEach((repo) => {
    signals.push(`Observed repo signal: ${repo}`);
  });

  history.slice(0, 3).forEach((entry) => {
    signals.push(`CLI / agent history: ${entry}`);
  });

  if (dashboard?.agent?.ens) {
    signals.push(`Active identity: ${dashboard.agent.ens}`);
  }

  return {
    mode: 'rules-based',
    summary:
      persona === 'staker'
        ? 'Use BountyNet as an automated CI overflow lane: install once, budget by failure streak, and let solver PRs compete on cost.'
        : 'Optimize for claim speed and cheap first-pass repairs. Treat the gateway token budget as a hard operating constraint, not a suggestion.',
    recommendations,
    signals,
  };
};

export const getInsights = async ({
  persona = 'solver',
  repos = [],
  history = [],
}) => {
  const normalizedRepos = normalizeInputList(repos);
  const normalizedHistory = normalizeInputList(history);
  const dashboard = await getDashboardModel();
  const fallback = buildFallbackInsights({
    persona,
    repos:
      normalizedRepos.length > 0
        ? normalizedRepos
        : dashboard.repos.map((repo) => repo.repo),
    history: normalizedHistory,
    dashboard,
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback;
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = [
      'You are assisting a BountyNet onboarding experience.',
      'Respond as JSON with keys summary, recommendations, and signals.',
      'recommendations must be an array of {title, rationale, priority}.',
      `Persona: ${persona}`,
      `Known repos: ${fallback.signals.join(' | ') || 'none'}`,
      `Observed dashboard stats: ${JSON.stringify(dashboard.portfolioStats)}`,
      `Base heuristics: ${JSON.stringify(fallback.recommendations)}`,
    ].join('\n');

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      system:
        'Return strict JSON only. Keep priorities to High, Medium, or Low. Recommendations must be actionable for engineering teams.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('');

    const parsed = JSON.parse(text);

    return {
      mode: 'anthropic',
      summary: parsed.summary || fallback.summary,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : fallback.recommendations,
      signals: Array.isArray(parsed.signals)
        ? parsed.signals
        : fallback.signals,
    };
  } catch (error) {
    console.error('Anthropic insight generation failed:', error);
    return fallback;
  }
};
