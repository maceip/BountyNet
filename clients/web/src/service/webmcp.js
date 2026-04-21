const BASE_URL = process.env.WEB_BASE_URL || 'http://127.0.0.1:5173';

const JOURNEYS = {
  repo_owner: {
    persona: 'repo_owner',
    role: 'github_owner',
    description:
      'Repo-owner onboarding and market participation flow for configuring repositories, policy, and spend.',
    routes: {
      landing: `${BASE_URL}/`,
      onboarding: `${BASE_URL}/onboarding/repo-owner`,
      settings: `${BASE_URL}/settings/repo-owner`,
      marketplace: `${BASE_URL}/marketplace`,
      inventory: `${BASE_URL}/inventory`,
      diagnostics: `${BASE_URL}/diagnostics/webmcp`,
      control_plane: `${BASE_URL}/ops/control-plane`,
      agent_track: `${BASE_URL}/agent-track`,
    },
    actions: [
      {
        id: 'repo_owner_open_onboarding',
        route: '/onboarding/repo-owner',
        selector: '#mcp-repo-owner-onboarding-link',
        type: 'navigate',
      },
      {
        id: 'repo_owner_save_repo_policy',
        route: '/onboarding/repo-owner',
        selector: '#mcp-repo-owner-save',
        type: 'submit',
        api: {
          method: 'POST',
          path: '/api/bountynet/market/repositories/setup',
        },
      },
      {
        id: 'repo_owner_apply_repo_preset',
        route: '/onboarding/repo-owner',
        selector: '#mcp-repo-owner-save',
        type: 'submit',
        api: {
          method: 'POST',
          path: '/api/bountynet/market/repositories/:repo/apply-preset',
        },
      },
      {
        id: 'repo_owner_open_marketplace',
        route: '/marketplace',
        selector: '#mcp-marketplace-link',
        type: 'navigate',
      },
      {
        id: 'repo_owner_open_inventory',
        route: '/inventory',
        selector: '#mcp-inventory-link',
        type: 'navigate',
      },
      {
        id: 'repo_owner_open_diagnostics',
        route: '/diagnostics/webmcp',
        selector: '#mcp-diagnostics-link',
        type: 'navigate',
      },
      {
        id: 'repo_owner_offer_on_job',
        route: '/marketplace',
        selector: '#offer-agent',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/offers' },
      },
      {
        id: 'repo_owner_award_offer',
        route: '/marketplace',
        selector: '#award-offer',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/award' },
      },
      {
        id: 'repo_owner_open_control_plane',
        route: '/ops/control-plane',
        selector: '#mcp-control-plane-link',
        type: 'navigate',
      },
      {
        id: 'repo_owner_open_agent_track',
        route: '/agent-track',
        selector: '#mcp-agent-track-link',
        type: 'navigate',
      },
      {
        id: 'repo_owner_freeze_settlement',
        route: '/ops/control-plane',
        selector: '#settlement-action',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/ops/market/settlements/:settlementId/freeze' },
      },
    ],
  },
  agent_operator: {
    persona: 'agent_operator',
    role: 'agent_operator',
    description:
      'Supply-side onboarding flow for registering operators, agents, payout identity, and participating in market execution.',
    routes: {
      landing: `${BASE_URL}/`,
      onboarding: `${BASE_URL}/onboarding/agent-operator`,
      settings: `${BASE_URL}/settings/agent-operator`,
      marketplace: `${BASE_URL}/marketplace`,
      inventory: `${BASE_URL}/inventory`,
      diagnostics: `${BASE_URL}/diagnostics/webmcp`,
      control_plane: `${BASE_URL}/ops/control-plane`,
      agent_track: `${BASE_URL}/agent-track`,
    },
    actions: [
      {
        id: 'agent_operator_open_onboarding',
        route: '/onboarding/agent-operator',
        selector: '#mcp-agent-operator-onboarding-link',
        type: 'navigate',
      },
      {
        id: 'agent_operator_register_operator_and_agent',
        route: '/onboarding/agent-operator',
        selector: '#mcp-agent-operator-register',
        type: 'submit',
        api: [
          { method: 'POST', path: '/api/bountynet/market/operators' },
          {
            method: 'POST',
            path: '/api/bountynet/market/operators/:operatorId/onboard',
          },
          { method: 'POST', path: '/api/bountynet/market/agents' },
        ],
      },
      {
        id: 'agent_operator_seed_market',
        route: '/marketplace',
        selector: '#mcp-seed-fleet',
        type: 'submit',
        api: {
          method: 'POST',
          path: '/api/bountynet/market/seed',
        },
      },
      {
        id: 'agent_operator_open_inventory',
        route: '/inventory',
        selector: '#mcp-inventory-link',
        type: 'navigate',
      },
      {
        id: 'agent_operator_open_diagnostics',
        route: '/diagnostics/webmcp',
        selector: '#mcp-diagnostics-link',
        type: 'navigate',
      },
      {
        id: 'agent_operator_submit_offer',
        route: '/marketplace',
        selector: '#offer-agent',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/offers' },
      },
      {
        id: 'agent_operator_open_dispute',
        route: '/marketplace',
        selector: '#dispute-reason',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/disputes' },
      },
      {
        id: 'agent_operator_open_reputation',
        route: '/marketplace/reputation',
        selector: '#mcp-marketplace-link',
        type: 'navigate',
      },
      {
        id: 'agent_operator_open_agent_track',
        route: '/agent-track',
        selector: '#mcp-agent-track-link',
        type: 'navigate',
      },
    ],
  },
};

export const getWebMcpJourneys = () => ({
  version: '1.0',
  kind: 'webmcp_journey_manifest',
  journeys: JOURNEYS,
});

export const getWebMcpJourney = (persona) => {
  const key = String(persona || '').toLowerCase();
  return JOURNEYS[key] || null;
};
