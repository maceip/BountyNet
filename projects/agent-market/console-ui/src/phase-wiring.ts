export type PhaseKey =
  | 'landing'
  | 'onboarding_agentic'
  | 'onboarding_repo'
  | 'bazaar'
  | 'operator';

export type WiringKind = 'feed' | 'action';

export type WiringSpec = {
  kind: WiringKind;
  method: 'GET' | 'POST';
  endpoint: string;
  adapterKey: string;
};

export type StubCard = {
  id: string;
  title: string;
  description: string;
  wiring: WiringSpec;
};

export type PhaseDefinition = {
  key: PhaseKey;
  title: string;
  note: string;
  summary: string;
  adminOnly?: boolean;
  cards: StubCard[];
};

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    key: 'landing',
    title: 'Landing',
    note: 'Orient + pulse',
    summary:
      'Minimal entry state for global context, health banners, and quick jumps into operational phases.',
    cards: [
      {
        id: 'land-01',
        title: 'System Pulse',
        description: 'Top-level platform KPIs and launch health.',
        wiring: { kind: 'feed', method: 'GET', endpoint: '/health', adapterKey: 'landing.systemPulse' },
      },
      {
        id: 'land-02',
        title: 'Global Alerts',
        description: 'Critical notices and blocking conditions.',
        wiring: { kind: 'feed', method: 'GET', endpoint: '/events', adapterKey: 'landing.globalAlerts' },
      },
    ],
  },
  {
    key: 'onboarding_agentic',
    title: 'Onboarding (Agentic)',
    note: 'Fleet bootstrap',
    summary:
      'Agent provider setup, managed-fleet seeding, policy declarations, and trust-tier confirmation.',
    cards: [
      {
        id: 'agent-01',
        title: 'Fleet Seed',
        description: 'Entry point to initialize and validate managed agents.',
        wiring: { kind: 'action', method: 'POST', endpoint: '/market/agents/seed', adapterKey: 'agentic.seedFleet' },
      },
      {
        id: 'agent-02',
        title: 'Trust Profiles',
        description: 'Per-agent trust constraints and acceptance posture.',
        wiring: { kind: 'feed', method: 'GET', endpoint: '/market/agents', adapterKey: 'agentic.trustProfiles' },
      },
      {
        id: 'agent-03',
        title: 'Capability Manifests',
        description: 'Manifest coverage and missing declarations.',
        wiring: {
          kind: 'feed',
          method: 'GET',
          endpoint: '/market/agents/:id/manifest',
          adapterKey: 'agentic.capabilityManifests',
        },
      },
    ],
  },
  {
    key: 'onboarding_repo',
    title: 'Onboarding (Repo)',
    note: 'Repo setup',
    summary:
      'Repository registration, preset application, policy rails, and baseline scan wiring.',
    cards: [
      {
        id: 'repo-01',
        title: 'Repository Registration',
        description: 'Setup card for repo account and owner boundaries.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/market/repositories/setup',
          adapterKey: 'repo.registration',
        },
      },
      {
        id: 'repo-02',
        title: 'Policy Presets',
        description: 'Apply lane presets and display policy deltas.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/market/repositories/:repo/apply-preset',
          adapterKey: 'repo.policyPreset',
        },
      },
      {
        id: 'repo-03',
        title: 'Opportunity Scan',
        description: 'Trigger initial scan and show first opportunity list.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/market/repositories/:repo/scan',
          adapterKey: 'repo.opportunityScan',
        },
      },
    ],
  },
  {
    key: 'bazaar',
    title: 'Bazaar',
    note: 'Market operations',
    summary:
      'Opportunity promotion, job creation, recommendation routing, and operator execution workflows.',
    cards: [
      {
        id: 'bazaar-01',
        title: 'Opportunity Feed',
        description: 'Queue of promotable opportunities and severity.',
        wiring: {
          kind: 'feed',
          method: 'GET',
          endpoint: '/market/opportunities',
          adapterKey: 'bazaar.opportunityFeed',
        },
      },
      {
        id: 'bazaar-02',
        title: 'Job Board',
        description: 'Lifecycle board for open, assigned, and completed jobs.',
        wiring: { kind: 'feed', method: 'GET', endpoint: '/market/jobs', adapterKey: 'bazaar.jobBoard' },
      },
      {
        id: 'bazaar-03',
        title: 'Execution Console',
        description: 'Assignment execution and autopilot controls.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/market/jobs/:id/autopilot',
          adapterKey: 'bazaar.executionConsole',
        },
      },
    ],
  },
  {
    key: 'operator',
    title: 'Operator Panel',
    note: 'Admin controls',
    adminOnly: true,
    summary:
      'Admin-only surface for edge droplet fleet topology, Bedrock routing controls, rollout actions, and drift/observability operations.',
    cards: [
      {
        id: 'ops-01',
        title: 'Serving Topology',
        description: 'Inspect regions, endpoints, and acceleration status.',
        wiring: {
          kind: 'feed',
          method: 'GET',
          endpoint: '/ops/serving/topology',
          adapterKey: 'operator.servingTopology',
        },
      },
      {
        id: 'ops-02',
        title: 'Traffic Steering',
        description: 'Shift traffic across NA west/east, EU, Asia, and Australia edge gateways.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/ops/serving/traffic-shift',
          adapterKey: 'operator.trafficControl',
        },
      },
      {
        id: 'ops-03',
        title: 'Model Rollout',
        description: 'Promote supervisor/worker/edge revisions safely with staged strategies.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/ops/serving/model-rollout',
          adapterKey: 'operator.modelRollout',
        },
      },
      {
        id: 'ops-04',
        title: 'Langfuse Traces',
        description: 'Open trace console and pipeline diagnostics.',
        wiring: {
          kind: 'feed',
          method: 'GET',
          endpoint: '/ops/observability/langfuse',
          adapterKey: 'operator.langfuseTraces',
        },
      },
      {
        id: 'ops-05',
        title: 'Infra Drift',
        description: 'Inspect Terraform module health and drift-check command hints.',
        wiring: {
          kind: 'feed',
          method: 'GET',
          endpoint: '/ops/infra/drift',
          adapterKey: 'operator.infraDrift',
        },
      },
      {
        id: 'ops-06',
        title: 'Component Inventory',
        description: 'View stack component desired states and recent admin actions.',
        wiring: {
          kind: 'feed',
          method: 'GET',
          endpoint: '/ops/components',
          adapterKey: 'operator.componentInventory',
        },
      },
      {
        id: 'ops-07',
        title: 'Component Action',
        description: 'Queue start/stop/restart actions for individual infrastructure components.',
        wiring: {
          kind: 'action',
          method: 'POST',
          endpoint: '/ops/components/action',
          adapterKey: 'operator.componentAction',
        },
      },
    ],
  },
];

export function getPhaseTerminalLines(phase: PhaseDefinition): string[] {
  return [
    `[PHASE] ${phase.title}`,
    `[MODE] stub-only scaffolding`,
    `[STATE] no runtime data wiring`,
    `[NEXT] attach adapters for ${phase.key}`,
  ];
}

export function formatWiringHint(card: StubCard): string {
  return `${card.wiring.kind.toUpperCase()} ${card.wiring.method} ${card.wiring.endpoint} (${card.wiring.adapterKey})`;
}
