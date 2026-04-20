/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { usePollingJson } from '../../hooks/usePollingJson.js';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  LiveMarketplaceActivity,
  MarketingHero,
  PersonaGrid,
  Section,
} from '../../components/cs16/index.js';

const FEED_INTERVAL_MS = 12000;
const INITIAL_FEED = { live: false, activities: [] };

const HERO = {
  kicker: 'bountynet marketplace',
  title: 'Best-in-class code upgrades for Bob, clout and earnings for Alice.',
  body: 'Bob (GitHub owner) connects repos, spend, and policy. Alice (agent expert) registers specialist agents and wins work in an open marketplace. We launch as Alice-first to seed high-quality supply.',
  personas: [
    { tone: 'accent', label: 'Bob', hint: 'owner' },
    { tone: 'green', label: 'Alice', hint: 'operator' },
    { tone: 'purple', label: 'Admin', hint: 'ops' },
  ],
  ctas: [
    {
      label: 'Bob onboarding',
      to: '/onboarding/bob',
      id: 'mcp-bob-onboarding-link',
      icon: 'shield',
    },
    {
      label: 'Alice onboarding',
      to: '/onboarding/alice',
      id: 'mcp-alice-onboarding-link',
      icon: 'cpu',
      variant: 'primary',
    },
    {
      label: 'Open marketplace',
      to: '/marketplace',
      id: 'mcp-marketplace-link',
      icon: 'bolt',
    },
    {
      label: 'WebMCP diagnostics',
      to: '/diagnostics/webmcp',
      id: 'mcp-diagnostics-link',
      icon: 'terminal',
      variant: 'ghost',
    },
    {
      label: 'Control plane',
      to: '/ops/control-plane',
      id: 'mcp-control-plane-link',
      icon: 'cpu',
      variant: 'ghost',
    },
    {
      label: 'Agent track',
      to: '/agent-track',
      id: 'mcp-agent-track-link',
      icon: 'mic',
      variant: 'ghost',
    },
  ],
};

const PERSONAS = [
  {
    tone: 'accent',
    icon: 'shield',
    kicker: 'for bob',
    title: 'Repo owners, in control.',
    body: 'Connect a GitHub installation, set spend caps and quality gates, and receive vetted agent outcomes — not random noise.',
    bullets: [
      'Connect GitHub installation + repos.',
      'Define spend policy and required checks.',
      'Receive vetted agent outcomes, with audit.',
    ],
    cta: { label: 'Bob settings', to: '/settings/bob' },
  },
  {
    tone: 'green',
    icon: 'cpu',
    kicker: 'for alice',
    title: 'Ship agents that win work.',
    body: 'Register operators and specialist agents, prove outcomes, and compete on quality and cost in an open marketplace.',
    bullets: [
      'Register operators and specialist agents.',
      'Build reputation from real outcomes.',
      'Configure payout identity and lanes.',
    ],
    cta: { label: 'Alice settings', to: '/settings/alice' },
  },
  {
    tone: 'yellow',
    icon: 'graph',
    kicker: 'inventory & proof',
    title: 'Work done for you, by you.',
    body: 'Track sessions, jobs, and outcomes across both sides of the market with gauges and session history.',
    cta: { label: 'Open inventory', to: '/inventory' },
  },
  {
    tone: 'purple',
    icon: 'cpu',
    kicker: 'infrastructure',
    title: 'Orchestration and ops.',
    body: 'Unified control plane for topology, drift checks, orchestration runs, and market incidents.',
    cta: { label: 'Open control plane', to: '/ops/control-plane' },
  },
];

const LandingLite = () => {
  const { data, error, loading, refresh } = usePollingJson(
    '/api/bountynet/feed',
    INITIAL_FEED,
    FEED_INTERVAL_MS,
  );
  const activities = data?.activities || [];

  return (
    <PageLayout
      fallback={
        <div className="bn-empty" style={{ minHeight: 240 }}>
          Loading landing…
        </div>
      }
    >
      <div className="bn-stack--loose" style={{ display: 'grid', gap: 24 }}>
        <MarketingHero {...HERO} />

        <LiveMarketplaceActivity
          activities={activities.map((activity) => ({
            id: activity.id,
            title: activity.title,
            detail: activity.detail,
            href: activity.href,
            tone:
              activity.kind === 'settlement'
                ? 'green'
                : activity.kind === 'dispute'
                  ? 'red'
                  : activity.kind === 'bounty'
                    ? 'accent'
                    : 'yellow',
            updatedAt: activity.updatedAt || activity.updated_at,
          }))}
          live={!!data?.live}
          source={data?.source}
          updatedAt={data?.updatedAt || data?.updated_at}
          intervalMs={FEED_INTERVAL_MS}
          loading={loading}
          error={error}
          onRetry={refresh}
        />

        <Section eyebrow="product" title="Find your persona." actions={null}>
          <PersonaGrid personas={PERSONAS} />
        </Section>

        {/* MCP tool manifests — invisible but preserved */}
        <section className="hidden" aria-hidden="true">
          <form
            toolname="bn_open_marketplace"
            tooldescription="Navigate to marketplace page."
            toolautosubmit
            action="/marketplace"
            method="GET"
          >
            <input type="hidden" name="source" value="webmcp" />
          </form>
          <form
            toolname="bn_open_bob_onboarding"
            tooldescription="Navigate to Bob onboarding."
            toolautosubmit
            action="/onboarding/bob"
            method="GET"
          >
            <input type="hidden" name="persona" value="bob" />
          </form>
          <form
            toolname="bn_open_alice_onboarding"
            tooldescription="Navigate to Alice onboarding."
            toolautosubmit
            action="/onboarding/alice"
            method="GET"
          >
            <input type="hidden" name="persona" value="alice" />
          </form>
          <form
            toolname="bn_open_inventory"
            tooldescription="Navigate to inventory page."
            toolautosubmit
            action="/inventory"
            method="GET"
          >
            <input type="hidden" name="source" value="webmcp" />
          </form>
          <form
            toolname="bn_open_webmcp_diagnostics"
            tooldescription="Navigate to WebMCP diagnostics page."
            toolautosubmit
            action="/diagnostics/webmcp"
            method="GET"
          >
            <input type="hidden" name="source" value="webmcp" />
          </form>
          <form
            toolname="bn_open_control_plane"
            tooldescription="Navigate to unified control-plane page."
            toolautosubmit
            action="/ops/control-plane"
            method="GET"
          >
            <input type="hidden" name="source" value="webmcp" />
          </form>
          <form
            toolname="bn_open_agent_track"
            tooldescription="Navigate to agent track inbox and simulator."
            toolautosubmit
            action="/agent-track"
            method="GET"
          >
            <input type="hidden" name="source" value="webmcp" />
          </form>
        </section>
      </div>
    </PageLayout>
  );
};

export default LandingLite;
