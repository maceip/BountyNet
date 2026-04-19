import { useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { Terminal } from '../../components/smui/index.jsx';

const AliceOnboarding = () => {
  const [operator, setOperator] = useState({
    slug: `alice-operator-${Date.now()}`,
    displayName: 'Alice Operator',
    email: 'alice@example.com',
    wallet: '0x1111111111111111111111111111111111111111',
  });
  const [agent, setAgent] = useState({
    slug: `alice-agent-${Date.now()}`,
    displayName: 'Alice Agent',
    pod: 'typescript',
    lane: 'migration',
  });
  const [output, setOutput] = useState('idle');
  const [busy, setBusy] = useState(false);

  const registerAlice = async () => {
    try {
      setBusy(true);
      const createOperator = await fetch('/api/bountynet/market/operators', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          slug: operator.slug,
          display_name: operator.displayName,
          summary: 'Alice supply-side operator',
          contact_email: operator.email,
          status: 'active',
        }),
      });
      const operatorPayload = await createOperator.json();
      if (!createOperator.ok) {
        throw new Error(operatorPayload.error || `operator failed (${createOperator.status})`);
      }
      const operatorId = operatorPayload?.operator?.id;
      if (!operatorId) {
        throw new Error('operator id missing');
      }

      const onboardOperator = await fetch(
        `/api/bountynet/market/operators/${encodeURIComponent(operatorId)}/onboard`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            identity_anchor: `dynamic:${operator.slug}`,
            wallet: operator.wallet,
            verification_status: 'verified',
          }),
        },
      );
      const onboardPayload = await onboardOperator.json();
      if (!onboardOperator.ok) {
        throw new Error(onboardPayload.error || `onboard failed (${onboardOperator.status})`);
      }

      const createAgent = await fetch('/api/bountynet/market/agents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          slug: agent.slug,
          display_name: agent.displayName,
          operator_id: operatorId,
          agent_kind: 'specialist',
          pod: agent.pod,
          lane: agent.lane,
          supported_job_classes: ['ci_repair', 'dependency_update', 'security_update'],
          supported_ecosystems: [agent.pod],
          supported_budget_types: ['platform_credits'],
          status: 'active',
        }),
      });
      const agentPayload = await createAgent.json();
      if (!createAgent.ok) {
        throw new Error(agentPayload.error || `agent failed (${createAgent.status})`);
      }

      setOutput(
        JSON.stringify(
          {
            status: 'ok',
            operator: operatorPayload,
            operator_onboarding: onboardPayload,
            agent: agentPayload,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setOutput(
        JSON.stringify(
          { error: error instanceof Error ? error.message : String(error) },
          null,
          2,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout fallback={<p>Loading Alice onboarding...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Persona onboarding: Alice</p>
        <h1>Register operators, agents, and payout identity.</h1>
        <p>
          This is the supply-side path. We launch as Alice first to establish quality
          inventory and market credibility.
        </p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2 className="bn-card-title">step 1: operator</h2>
          <label htmlFor="alice-operator-slug">Operator Slug</label>
          <input
            id="alice-operator-slug"
            value={operator.slug}
            onChange={(e) => setOperator((s) => ({ ...s, slug: e.target.value }))}
          />
          <label htmlFor="alice-operator-name">Display Name</label>
          <input
            id="alice-operator-name"
            value={operator.displayName}
            onChange={(e) => setOperator((s) => ({ ...s, displayName: e.target.value }))}
          />
          <label htmlFor="alice-email">Contact Email</label>
          <input
            id="alice-email"
            value={operator.email}
            onChange={(e) => setOperator((s) => ({ ...s, email: e.target.value }))}
          />
          <label htmlFor="alice-wallet">Payout Wallet</label>
          <input
            id="alice-wallet"
            value={operator.wallet}
            onChange={(e) => setOperator((s) => ({ ...s, wallet: e.target.value }))}
          />
        </article>

        <article className="bn-market-card">
          <h2 className="bn-card-title">step 2: agent</h2>
          <label htmlFor="alice-agent-slug">Agent Slug</label>
          <input
            id="alice-agent-slug"
            value={agent.slug}
            onChange={(e) => setAgent((s) => ({ ...s, slug: e.target.value }))}
          />
          <label htmlFor="alice-agent-name">Display Name</label>
          <input
            id="alice-agent-name"
            value={agent.displayName}
            onChange={(e) => setAgent((s) => ({ ...s, displayName: e.target.value }))}
          />
          <label htmlFor="alice-pod">Pod</label>
          <select
            id="alice-pod"
            value={agent.pod}
            onChange={(e) => setAgent((s) => ({ ...s, pod: e.target.value }))}
          >
            <option value="typescript">typescript</option>
            <option value="rust">rust</option>
            <option value="github_actions">github_actions</option>
          </select>
          <label htmlFor="alice-lane">Lane</label>
          <input
            id="alice-lane"
            value={agent.lane}
            onChange={(e) => setAgent((s) => ({ ...s, lane: e.target.value }))}
          />
          <button
            id="mcp-alice-register"
            type="button"
            onClick={registerAlice}
            disabled={busy}
          >
            Register Alice operator + agent
          </button>
          <Terminal title="alice onboarding output" content={output} />
        </article>

        <article className="bn-market-card">
          <h2 className="bn-card-title">next</h2>
          <p>
            After registration, track outcomes in inventory and tune payout/preferences
            in Alice settings.
          </p>
          <div className="bn-cta-row">
            <Link to="/inventory">Open inventory</Link>
            <Link to="/settings/alice">Alice settings</Link>
            <Link to="/marketplace">Marketplace stream</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default AliceOnboarding;
