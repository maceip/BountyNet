import { useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { PopoverCommandSelect, Terminal } from '../../components/smui/index.jsx';

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
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">persona onboarding: alice</p>
        <h1>register operators, agents, and payout identity.</h1>
        <p>
          This is the supply-side path. We launch as Alice first to establish quality
          inventory and market credibility.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 desktop:grid-cols-3 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">step 1: operator</h2>
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

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">step 2: agent</h2>
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
          <PopoverCommandSelect
            id="alice-pod"
            label="Pod"
            value={agent.pod}
            onChange={(pod) => setAgent((s) => ({ ...s, pod }))}
            options={[
              { value: 'typescript', label: 'typescript' },
              { value: 'rust', label: 'rust' },
              { value: 'github_actions', label: 'github_actions' },
            ]}
          />
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

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">next</h2>
          <p>
            After registration, track outcomes in inventory and tune payout/preferences
            in Alice settings.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
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
