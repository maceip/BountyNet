const BASE_URL = process.env.WEB_BASE_URL || 'http://127.0.0.1:5173';

const JOURNEYS = {
  bob: {
    persona: 'bob',
    role: 'github_owner',
    description:
      'Repo-owner onboarding and market participation flow for configuring repositories, policy, and spend.',
    routes: {
      landing: `${BASE_URL}/`,
      onboarding: `${BASE_URL}/onboarding/bob`,
      settings: `${BASE_URL}/settings/bob`,
      marketplace: `${BASE_URL}/marketplace`,
      inventory: `${BASE_URL}/inventory`,
      diagnostics: `${BASE_URL}/diagnostics/webmcp`,
      control_plane: `${BASE_URL}/ops/control-plane`,
      agent_track: `${BASE_URL}/agent-track`,
    },
    actions: [
      {
        id: 'bob_open_onboarding',
        route: '/onboarding/bob',
        selector: '#mcp-bob-onboarding-link',
        type: 'navigate',
      },
      {
        id: 'bob_save_repo_policy',
        route: '/onboarding/bob',
        selector: '#mcp-bob-save',
        type: 'submit',
        api: {
          method: 'POST',
          path: '/api/bountynet/market/repositories/setup',
        },
      },
      {
        id: 'bob_apply_repo_preset',
        route: '/onboarding/bob',
        selector: '#mcp-bob-save',
        type: 'submit',
        api: {
          method: 'POST',
          path: '/api/bountynet/market/repositories/:repo/apply-preset',
        },
      },
      {
        id: 'bob_open_marketplace',
        route: '/marketplace',
        selector: '#mcp-marketplace-link',
        type: 'navigate',
      },
      {
        id: 'bob_open_inventory',
        route: '/inventory',
        selector: '#mcp-inventory-link',
        type: 'navigate',
      },
      {
        id: 'bob_open_diagnostics',
        route: '/diagnostics/webmcp',
        selector: '#mcp-diagnostics-link',
        type: 'navigate',
      },
      {
        id: 'bob_offer_on_job',
        route: '/marketplace',
        selector: '#offer-agent',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/offers' },
      },
      {
        id: 'bob_award_offer',
        route: '/marketplace',
        selector: '#award-offer',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/award' },
      },
      {
        id: 'bob_open_control_plane',
        route: '/ops/control-plane',
        selector: '#mcp-control-plane-link',
        type: 'navigate',
      },
      {
        id: 'bob_open_agent_track',
        route: '/agent-track',
        selector: '#mcp-agent-track-link',
        type: 'navigate',
      },
      {
        id: 'bob_freeze_settlement',
        route: '/ops/control-plane',
        selector: '#settlement-action',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/ops/market/settlements/:settlementId/freeze' },
      },
    ],
  },
  alice: {
    persona: 'alice',
    role: 'agent_operator',
    description:
      'Supply-side onboarding flow for registering operators, agents, payout identity, and participating in market execution.',
    routes: {
      landing: `${BASE_URL}/`,
      onboarding: `${BASE_URL}/onboarding/alice`,
      settings: `${BASE_URL}/settings/alice`,
      marketplace: `${BASE_URL}/marketplace`,
      inventory: `${BASE_URL}/inventory`,
      diagnostics: `${BASE_URL}/diagnostics/webmcp`,
      control_plane: `${BASE_URL}/ops/control-plane`,
      agent_track: `${BASE_URL}/agent-track`,
    },
    actions: [
      {
        id: 'alice_open_onboarding',
        route: '/onboarding/alice',
        selector: '#mcp-alice-onboarding-link',
        type: 'navigate',
      },
      {
        id: 'alice_register_operator_and_agent',
        route: '/onboarding/alice',
        selector: '#mcp-alice-register',
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
        id: 'alice_seed_market',
        route: '/marketplace',
        selector: '#mcp-seed-fleet',
        type: 'submit',
        api: {
          method: 'POST',
          path: '/api/bountynet/market/seed',
        },
      },
      {
        id: 'alice_open_inventory',
        route: '/inventory',
        selector: '#mcp-inventory-link',
        type: 'navigate',
      },
      {
        id: 'alice_open_diagnostics',
        route: '/diagnostics/webmcp',
        selector: '#mcp-diagnostics-link',
        type: 'navigate',
      },
      {
        id: 'alice_submit_offer',
        route: '/marketplace',
        selector: '#offer-agent',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/offers' },
      },
      {
        id: 'alice_open_dispute',
        route: '/marketplace',
        selector: '#dispute-reason',
        type: 'submit',
        api: { method: 'POST', path: '/api/bountynet/market/jobs/:jobId/disputes' },
      },
      {
        id: 'alice_open_reputation',
        route: '/marketplace/reputation',
        selector: '#mcp-marketplace-link',
        type: 'navigate',
      },
      {
        id: 'alice_open_agent_track',
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
