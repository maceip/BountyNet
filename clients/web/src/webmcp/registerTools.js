import {
  consumeVoiceTranscript,
  getVoiceInbox,
  pushVoiceTranscript,
} from '../utils/voiceInbox.js';
import {
  addAgentRepoPair,
  getAgentTrackState,
} from '../utils/agentTrackStore.js';

const hasWebMcp = () =>
  typeof navigator !== 'undefined' &&
  navigator.modelContext &&
  typeof navigator.modelContext.registerTool === 'function';

const getDiagnosticsState = () => {
  if (typeof window === 'undefined') {
    return {
      registered: false,
      webmcpAvailable: false,
      registeredTools: [],
      lastCall: null,
      initError: '',
    };
  }
  if (!window.__bnWebmcpDiagnostics) {
    window.__bnWebmcpDiagnostics = {
      registered: false,
      webmcpAvailable: false,
      registeredTools: [],
      lastCall: null,
      initError: '',
    };
  }
  return window.__bnWebmcpDiagnostics;
};

const recordToolCall = ({ name, args, result, error }) => {
  const state = getDiagnosticsState();
  state.lastCall = {
    name,
    args,
    ok: !error,
    result: result || null,
    error: error ? String(error) : '',
    at: new Date().toISOString(),
  };
};

const api = async (path, method = 'GET', body) => {
  const response = await fetch(path, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `request failed (${response.status})`);
  }
  return payload;
};

const register = async (name, description, inputSchema, handler) => {
  const state = getDiagnosticsState();
  await navigator.modelContext.registerTool(
    name,
    {
      description,
      inputSchema,
    },
    async (args) => {
      try {
        const result = await handler(args || {});
        recordToolCall({ name, args, result });
        return result;
      } catch (error) {
        recordToolCall({ name, args, error });
        throw error;
      }
    },
  );
  if (!state.registeredTools.includes(name)) {
    state.registeredTools.push(name);
  }
};

const routeHref = (route) => {
  if (!route || typeof route !== 'string') {
    throw new Error('route is required');
  }
  return route.startsWith('http')
    ? route
    : `${window.location.origin}${route.startsWith('/') ? route : `/${route}`}`;
};

export const initializeWebMcpTools = async () => {
  const state = getDiagnosticsState();
  state.webmcpAvailable = hasWebMcp();
  if (!hasWebMcp()) {
    state.registered = false;
    state.initError = 'navigator.modelContext unavailable';
    return { registered: false, reason: 'navigator.modelContext unavailable' };
  }

  await register(
    'bn_navigate',
    'Navigate to a BountyNet route by path.',
    {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description:
            'Destination route. Examples: /, /marketplace, /onboarding/repo-owner, /onboarding/agent-operator, /settings/repo-owner, /settings/agent-operator, /inventory, /agent-track',
        },
      },
      required: ['route'],
    },
    async ({ route }) => {
      const href = routeHref(route);
      window.location.assign(href);
      return { ok: true, navigated_to: href };
    },
  );

  await register(
    'bn_repo_owner_onboard',
    'Configure repo-owner onboarding: setup repository, spend caps, and lane preset.',
    {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        localPath: { type: 'string' },
        installationId: { type: 'number' },
        monthlyCap: { type: 'number' },
        perJobCap: { type: 'number' },
        preset: { type: 'string' },
      },
      required: ['repo', 'installationId', 'preset'],
    },
    async ({
      repo,
      localPath = '',
      installationId,
      monthlyCap = 1000,
      perJobCap = 100,
      preset,
    }) => {
      const setup = await api('/api/bountynet/market/repositories/setup', 'POST', {
        installation_id: Number(installationId),
        repos: [repo],
        local_path: localPath,
        owner: 'repo_owner',
        required_checks: ['CI'],
        budget_priority: ['platform_credits', 'api_key_pool'],
        monthly_spend_cap: Number(monthlyCap),
        per_job_spend_cap: Number(perJobCap),
      });
      const presetResult = await api(
        `/api/bountynet/market/repositories/${encodeURIComponent(repo)}/apply-preset`,
        'POST',
        { preset },
      );
      return { ok: true, setup, preset: presetResult };
    },
  );

  await register(
    'bn_agent_operator_register',
    'Register agent operator and specialist agent with payout identity.',
    {
      type: 'object',
      properties: {
        operatorSlug: { type: 'string' },
        operatorName: { type: 'string' },
        email: { type: 'string' },
        wallet: { type: 'string' },
        agentSlug: { type: 'string' },
        agentName: { type: 'string' },
        pod: { type: 'string' },
        lane: { type: 'string' },
      },
      required: [
        'operatorSlug',
        'operatorName',
        'email',
        'wallet',
        'agentSlug',
        'agentName',
        'pod',
        'lane',
      ],
    },
    async ({
      operatorSlug,
      operatorName,
      email,
      wallet,
      agentSlug,
      agentName,
      pod,
      lane,
    }) => {
      const operator = await api('/api/bountynet/market/operators', 'POST', {
        slug: operatorSlug,
        display_name: operatorName,
        summary: 'Supply-side agent operator',
        contact_email: email,
        status: 'active',
      });
      const operatorId = operator?.operator?.id;
      if (!operatorId) {
        throw new Error('operator id missing from response');
      }
      const onboarding = await api(
        `/api/bountynet/market/operators/${encodeURIComponent(operatorId)}/onboard`,
        'POST',
        {
          identity_anchor: `dynamic:${operatorSlug}`,
          wallet,
          verification_status: 'verified',
        },
      );
      const agent = await api('/api/bountynet/market/agents', 'POST', {
        slug: agentSlug,
        display_name: agentName,
        operator_id: operatorId,
        agent_kind: 'specialist',
        pod,
        lane,
        supported_job_classes: ['ci_repair', 'dependency_update', 'security_update'],
        supported_ecosystems: [pod],
        supported_budget_types: ['platform_credits'],
        status: 'active',
      });
      return { ok: true, operator, onboarding, agent };
    },
  );

  await register(
    'bn_market_seed',
    'Seed managed fleet in marketplace.',
    { type: 'object', properties: {} },
    async () => {
      const result = await api('/api/bountynet/market/seed', 'POST', {});
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_create_job',
    'Create a marketplace job on a repository.',
    {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        jobClass: { type: 'string' },
        title: { type: 'string' },
        risk: { type: 'string' },
        pod: { type: 'string' },
        lane: { type: 'string' },
        packageName: { type: 'string' },
        targetVersion: { type: 'string' },
      },
      required: ['repo', 'jobClass', 'title', 'risk', 'pod', 'lane'],
    },
    async ({
      repo,
      jobClass,
      title,
      risk,
      pod,
      lane,
      packageName = '',
      targetVersion = '',
    }) => {
      const metadata = {
        pod,
        lane,
        required_trust_tier: 'standard',
      };
      if (packageName) {
        metadata.package = packageName;
        metadata.crate = packageName;
      }
      if (targetVersion) {
        metadata.target_version = targetVersion;
      }
      const result = await api('/api/bountynet/market/jobs', 'POST', {
        repo_full_name: repo,
        job_class: jobClass,
        title,
        risk_level: risk,
        metadata,
      });
      return { ok: true, result };
    },
  );

  await register(
    'bn_inventory_snapshot',
    'Fetch a machine-readable snapshot of jobs, agents, operators, and sessions.',
    { type: 'object', properties: {} },
    async () => {
      const [jobs, agents, operators, dashboard] = await Promise.all([
        api('/api/bountynet/market/jobs'),
        api('/api/bountynet/market/agents'),
        api('/api/bountynet/market/operators'),
        api('/api/bountynet/dashboard'),
      ]);
      return {
        ok: true,
        jobs: jobs.jobs || [],
        agents: agents.agents || [],
        operators: operators.operators || [],
        sessions: dashboard.sessions || [],
      };
    },
  );

  await register(
    'bn_market_create_offer',
    'Create a seller offer on a marketplace job.',
    {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        agentId: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        etaSeconds: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['jobId', 'agentId', 'amount'],
    },
    async ({ jobId, agentId, amount, currency = 'credits', etaSeconds = 0, notes = '' }) => {
      const result = await api(`/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/offers`, 'POST', {
        agent_id: agentId,
        amount: Number(amount),
        currency,
        eta_seconds: Number(etaSeconds),
        notes,
      });
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_award_offer',
    'Award a selected offer for a marketplace job.',
    {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        offerId: { type: 'string' },
        awardedBy: { type: 'string' },
      },
      required: ['jobId', 'offerId'],
    },
    async ({ jobId, offerId, awardedBy = 'webmcp-agent' }) => {
      const result = await api(`/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/award`, 'POST', {
        offer_id: offerId,
        awarded_by: awardedBy,
      });
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_open_dispute',
    'Open a dispute for a marketplace job.',
    {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        settlementId: { type: 'string' },
        reasonCode: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['jobId', 'reasonCode', 'reason'],
    },
    async ({ jobId, settlementId = '', reasonCode, reason }) => {
      const result = await api(
        `/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/disputes`,
        'POST',
        {
          settlement_id: settlementId,
          reason_code: reasonCode,
          reason,
          opened_by: 'webmcp-agent',
        },
      );
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_resolve_dispute',
    'Resolve an existing dispute with a ruling.',
    {
      type: 'object',
      properties: {
        disputeId: { type: 'string' },
        ruling: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['disputeId', 'ruling'],
    },
    async ({ disputeId, ruling, notes = '' }) => {
      const result = await api(
        `/api/bountynet/market/disputes/${encodeURIComponent(disputeId)}/resolve`,
        'POST',
        {
          ruling,
          notes,
          resolved_by: 'webmcp-agent',
        },
      );
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_settlement_action',
    'Pay or refund a settlement by id.',
    {
      type: 'object',
      properties: {
        settlementId: { type: 'string' },
        action: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['settlementId', 'action'],
    },
    async ({ settlementId, action, notes = '' }) => {
      const normalized = action === 'refund' ? 'refund' : 'pay';
      const result = await api(
        `/api/bountynet/market/settlements/${encodeURIComponent(settlementId)}/${normalized}`,
        'POST',
        { notes },
      );
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_reputation_snapshot',
    'Fetch agent and operator reputation snapshots.',
    { type: 'object', properties: {} },
    async () => {
      const [agents, operators] = await Promise.all([
        api('/api/bountynet/market/reputation/agents'),
        api('/api/bountynet/market/reputation/operators'),
      ]);
      return {
        ok: true,
        agents: agents.reputation || [],
        operators: operators.reputation || [],
      };
    },
  );

  await register(
    'bn_market_admin_suspend_agent',
    'Suspend or unsuspend an agent profile.',
    {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        action: { type: 'string' },
      },
      required: ['agentId', 'action'],
    },
    async ({ agentId, action }) => {
      const normalized = action === 'unsuspend' ? 'unsuspend' : 'suspend';
      const result = await api(
        `/api/bountynet/ops/market/agents/${encodeURIComponent(agentId)}/${normalized}`,
        'POST',
        { actor: 'webmcp-agent' },
      );
      return { ok: true, result };
    },
  );

  await register(
    'bn_market_admin_settlement_freeze',
    'Freeze or unfreeze settlement execution.',
    {
      type: 'object',
      properties: {
        settlementId: { type: 'string' },
        action: { type: 'string' },
      },
      required: ['settlementId', 'action'],
    },
    async ({ settlementId, action }) => {
      const normalized = action === 'unfreeze' ? 'unfreeze' : 'freeze';
      const result = await api(
        `/api/bountynet/ops/market/settlements/${encodeURIComponent(settlementId)}/${normalized}`,
        'POST',
        { actor: 'webmcp-agent' },
      );
      return { ok: true, result };
    },
  );

  await register(
    'bn_voice_inbox_snapshot',
    'Read queued voice transcripts captured across pages.',
    { type: 'object', properties: {} },
    async () => {
      const state = getVoiceInbox();
      return {
        ok: true,
        pending: state.pending || [],
        last_transcript: state.lastTranscript || '',
        updated_at: state.updatedAt || '',
      };
    },
  );

  await register(
    'bn_voice_inbox_push',
    'Store text in the cross-page voice inbox for later agent handoff.',
    {
      type: 'object',
      properties: {
        text: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['text'],
    },
    async ({ text, source = 'webmcp' }) => {
      const state = pushVoiceTranscript(text, source);
      return {
        ok: true,
        pending_count: (state.pending || []).length,
        last_transcript: state.lastTranscript || '',
      };
    },
  );

  await register(
    'bn_voice_inbox_consume',
    'Consume the next queued voice transcript for agent track processing.',
    { type: 'object', properties: {} },
    async () => {
      const item = consumeVoiceTranscript();
      return {
        ok: true,
        item: item || null,
      };
    },
  );

  await register(
    'bn_agent_track_snapshot',
    'Read current agent-track stream state (agents, repos, events).',
    { type: 'object', properties: {} },
    async () => {
      const state = getAgentTrackState();
      return {
        ok: true,
        agents: state.agents || [],
        repos: state.repos || [],
        events: state.events || [],
        updated_at: state.updatedAt || '',
      };
    },
  );

  await register(
    'bn_agent_track_add_pair',
    'Add a synthetic agent+repo pair to the agent-track stream.',
    {
      type: 'object',
      properties: {
        source: { type: 'string' },
      },
    },
    async ({ source = 'webmcp' }) => {
      const state = addAgentRepoPair(source);
      return {
        ok: true,
        newest_agent: state.agents[state.agents.length - 1] || null,
        newest_repo: state.repos[state.repos.length - 1] || null,
      };
    },
  );

  await register(
    'bn_help',
    'Ask the marketplace a natural-language question. Returns a contextual answer based on journey state and live data.',
    {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description:
            "A question about the marketplace, e.g. 'How do I set up a budget?' or 'Why was my agent rejected?'",
        },
      },
      required: ['question'],
    },
    async ({ question }) => {
      const result = await api('/api/bountynet/market/agent/help', 'POST', { question });
      return { ok: true, ...result };
    },
  );

  await register(
    'bn_chat',
    'Send a free-form message to the Marketplace Agent. Supports multi-turn conversations within a session.',
    {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Free-form message to the agent.' },
        session_id: {
          type: 'string',
          description: 'Optional session ID for multi-turn context. Omit to start a new session.',
        },
      },
      required: ['message'],
    },
    async ({ message, session_id }) => {
      const body = { message };
      if (session_id) body.session_id = session_id;
      const result = await api('/api/bountynet/market/agent/chat', 'POST', body);
      return { ok: true, ...result };
    },
  );

  await register(
    'bn_explain',
    'Ask the platform to explain a concept, surface, or workflow by topic name.',
    {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description:
            "The concept to explain, e.g. 'trust tiers', 'lane presets', 'acceptance rate', 'BYOA webhook contract'.",
        },
      },
      required: ['topic'],
    },
    async ({ topic }) => {
      const result = await api('/api/bountynet/market/agent/explain', 'POST', { topic });
      return { ok: true, ...result };
    },
  );

  await register(
    'bn_troubleshoot',
    'Report a problem. The agent inspects your context and returns a diagnosis with suggested fixes.',
    {
      type: 'object',
      properties: {
        problem: {
          type: 'string',
          description:
            "Description of the issue, e.g. 'my agent keeps getting rejected' or 'budget shows $0 remaining'.",
        },
      },
      required: ['problem'],
    },
    async ({ problem }) => {
      const result = await api('/api/bountynet/market/agent/troubleshoot', 'POST', { problem });
      return { ok: true, ...result };
    },
  );

  await register(
    'bn_feedback',
    'Submit feedback or a feature request to the product team.',
    {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['bug', 'feature_request', 'ux_issue', 'general'],
          description: 'Feedback category.',
        },
        message: { type: 'string', description: 'The feedback content.' },
        surface: {
          type: 'string',
          description: 'Optional: which page or surface the feedback relates to.',
        },
      },
      required: ['category', 'message'],
    },
    async ({ category, message, surface }) => {
      const body = { category, message };
      if (surface) body.surface = surface;
      const result = await api('/api/bountynet/market/feedback', 'POST', body);
      return { ok: true, ...result };
    },
  );

  state.registered = true;
  state.initError = '';
  return { registered: true, tools: state.registeredTools };
};

export const getWebMcpDiagnostics = () => ({ ...getDiagnosticsState() });
