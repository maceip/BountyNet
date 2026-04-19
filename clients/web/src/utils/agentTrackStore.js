const STORAGE_KEY = 'bn.agent-track.v1';
const MAX_ITEMS = 120;

const randomPick = (items) => items[Math.floor(Math.random() * items.length)];

const AGENT_PREFIX = [
  'orca',
  'helios',
  'vector',
  'atlas',
  'zephyr',
  'nova',
  'ember',
  'quartz',
];

const AGENT_SUFFIX = ['lint', 'fix', 'ops', 'ci', 'guard', 'solver', 'pilot', 'patch'];

const REPO_OWNER = ['octo', 'bounty', 'rail', 'ship', 'market', 'alice', 'bob', 'cargo'];
const REPO_NAME = [
  'web-core',
  'gateway-runtime',
  'agent-shell',
  'mcp-toolkit',
  'repo-audit',
  'risk-lab',
  'workflow-kit',
  'fleet-engine',
];

const INITIAL_STATE = {
  agents: [],
  repos: [],
  events: [],
  updatedAt: '',
};

const nowIso = () => new Date().toISOString();

const toId = (kind) => `${kind}_${Math.random().toString(36).slice(2, 10)}`;

const readState = () => {
  if (typeof window === 'undefined') {
    return INITIAL_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw);
    return {
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      repos: Array.isArray(parsed.repos) ? parsed.repos : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return INITIAL_STATE;
  }
};

const emit = (state) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bn:agent-track-updated', { detail: state }));
  }
};

const writeState = (next) => {
  if (typeof window === 'undefined') {
    return next;
  }
  const bounded = {
    ...next,
    agents: (next.agents || []).slice(-MAX_ITEMS),
    repos: (next.repos || []).slice(-MAX_ITEMS),
    events: (next.events || []).slice(-MAX_ITEMS),
    updatedAt: nowIso(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  emit(bounded);
  return bounded;
};

const makeAgent = () => {
  const slug = `${randomPick(AGENT_PREFIX)}-${randomPick(AGENT_SUFFIX)}-${Math.floor(Math.random() * 999)}`;
  return {
    id: toId('agt'),
    slug,
    display_name: slug.replace(/-/g, ' '),
    status: 'active',
    at: nowIso(),
  };
};

const makeRepo = () => {
  const owner = randomPick(REPO_OWNER);
  const name = randomPick(REPO_NAME);
  return {
    id: toId('repo'),
    repo_full_name: `${owner}/${name}`,
    status: 'tracked',
    at: nowIso(),
  };
};

export const getAgentTrackState = () => readState();

export const clearAgentTrackState = () => writeState(INITIAL_STATE);

export const addAgentRepoPair = (source = 'simulator') => {
  const state = readState();
  const agent = makeAgent();
  const repo = makeRepo();
  const next = {
    ...state,
    agents: [...state.agents, agent],
    repos: [...state.repos, repo],
    events: [
      ...state.events,
      {
        id: toId('evt'),
        kind: 'pair_added',
        source,
        detail: `Added ${agent.slug} + ${repo.repo_full_name}`,
        at: nowIso(),
      },
    ],
  };
  return writeState(next);
};

export const appendAgentTrackEvent = (kind, detail, source = 'ui') => {
  const state = readState();
  const next = {
    ...state,
    events: [...state.events, { id: toId('evt'), kind, detail, source, at: nowIso() }],
  };
  return writeState(next);
};
