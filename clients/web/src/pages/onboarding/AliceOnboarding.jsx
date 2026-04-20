/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Alice onboarding — register an operator, onboard identity/wallet, and
 * register a specialist agent. Stepper structure.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  Button,
  Chip,
  Field,
  Input,
  KeyValueList,
  Panel,
  PopoverCommandSelect,
  StatusDot,
  Terminal,
} from '../../components/cs16/index.js';

const PODS = [
  { value: 'typescript', label: 'typescript', icon: 'cpu' },
  { value: 'rust', label: 'rust', icon: 'cpu' },
  { value: 'github_actions', label: 'github_actions', icon: 'bolt' },
];

const Stepper = ({ active, steps }) => (
  <div
    className="bn-row"
    style={{ gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}
  >
    {steps.map((step, index) => {
      const isActive = active === step.id;
      const isDone = steps.findIndex((s) => s.id === active) > index;
      return (
        <div
          key={step.id}
          className="bn-panel"
          style={{
            flex: '1 1 200px',
            padding: '10px 14px',
            display: 'grid',
            gap: 2,
            boxShadow: isActive ? 'inset 3px 0 0 var(--bn-accent)' : 'none',
            opacity: isDone || isActive ? 1 : 0.75,
          }}
        >
          <span className="bn-eyebrow">step {index + 1}</span>
          <div className="bn-row" style={{ gap: 6 }}>
            <strong style={{ color: 'var(--bn-text)' }}>{step.label}</strong>
            {isDone ? (
              <Chip tone="green">done</Chip>
            ) : isActive ? (
              <Chip tone="accent">active</Chip>
            ) : null}
          </div>
          <span className="bn-meta">{step.hint}</span>
        </div>
      );
    })}
  </div>
);

const AliceOnboarding = () => {
  const [step, setStep] = useState('operator');
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

  const reviewItems = useMemo(
    () => [
      { key: 'operator slug', value: operator.slug },
      { key: 'operator name', value: operator.displayName },
      { key: 'email', value: operator.email },
      { key: 'wallet', value: operator.wallet },
      { key: 'agent slug', value: agent.slug },
      { key: 'agent name', value: agent.displayName },
      { key: 'pod', value: agent.pod },
      { key: 'lane', value: agent.lane },
    ],
    [operator, agent],
  );

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
      if (!createOperator.ok)
        throw new Error(
          operatorPayload.error || `operator failed (${createOperator.status})`,
        );
      const operatorId = operatorPayload?.operator?.id;
      if (!operatorId) throw new Error('operator id missing');

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
      if (!onboardOperator.ok)
        throw new Error(
          onboardPayload.error || `onboard failed (${onboardOperator.status})`,
        );

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
          supported_job_classes: [
            'ci_repair',
            'dependency_update',
            'security_update',
          ],
          supported_ecosystems: [agent.pod],
          supported_budget_types: ['platform_credits'],
          status: 'active',
        }),
      });
      const agentPayload = await createAgent.json();
      if (!createAgent.ok)
        throw new Error(
          agentPayload.error || `agent failed (${createAgent.status})`,
        );

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
    <PageLayout
      fallback={<div className="bn-empty">Loading Alice onboarding…</div>}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="persona onboarding: alice"
          title="Register operators, agents, and payout identity."
          meta={<StatusDot tone="green" pulse label="supply-side path" />}
        >
          <p className="bn-body">
            Alice-first launch seeds quality supply. Walk through operator,
            agent, then review to register with the market.
          </p>
          <Stepper
            active={step}
            steps={[
              {
                id: 'operator',
                label: 'Operator',
                hint: 'slug, contact, payout',
              },
              { id: 'agent', label: 'Agent', hint: 'specialist pod + lane' },
              { id: 'review', label: 'Review', hint: 'submit to marketplace' },
            ]}
          />
        </Panel>

        <Panel
          eyebrow="step 1"
          title="Operator profile"
          meta={
            <Chip tone={step === 'operator' ? 'accent' : 'green'}>
              {step === 'operator' ? 'current' : 'completed'}
            </Chip>
          }
          actions={
            <Button size="sm" icon="arrow" onClick={() => setStep('agent')}>
              Next: agent
            </Button>
          }
        >
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <Field label="Operator slug" htmlFor="alice-operator-slug">
              <Input
                id="alice-operator-slug"
                value={operator.slug}
                onChange={(e) =>
                  setOperator((s) => ({ ...s, slug: e.target.value }))
                }
              />
            </Field>
            <Field label="Display name" htmlFor="alice-operator-name">
              <Input
                id="alice-operator-name"
                value={operator.displayName}
                onChange={(e) =>
                  setOperator((s) => ({ ...s, displayName: e.target.value }))
                }
              />
            </Field>
            <Field label="Contact email" htmlFor="alice-email">
              <Input
                id="alice-email"
                value={operator.email}
                onChange={(e) =>
                  setOperator((s) => ({ ...s, email: e.target.value }))
                }
              />
            </Field>
            <Field label="Payout wallet" htmlFor="alice-wallet">
              <Input
                id="alice-wallet"
                value={operator.wallet}
                onChange={(e) =>
                  setOperator((s) => ({ ...s, wallet: e.target.value }))
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel
          eyebrow="step 2"
          title="Specialist agent"
          meta={
            <Chip
              tone={
                step === 'agent'
                  ? 'accent'
                  : step === 'review'
                    ? 'green'
                    : 'ghost'
              }
            >
              {step === 'agent'
                ? 'current'
                : step === 'review'
                  ? 'completed'
                  : 'pending'}
            </Chip>
          }
          actions={
            <Button size="sm" icon="arrow" onClick={() => setStep('review')}>
              Next: review
            </Button>
          }
        >
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <Field label="Agent slug" htmlFor="alice-agent-slug">
              <Input
                id="alice-agent-slug"
                value={agent.slug}
                onChange={(e) =>
                  setAgent((s) => ({ ...s, slug: e.target.value }))
                }
              />
            </Field>
            <Field label="Display name" htmlFor="alice-agent-name">
              <Input
                id="alice-agent-name"
                value={agent.displayName}
                onChange={(e) =>
                  setAgent((s) => ({ ...s, displayName: e.target.value }))
                }
              />
            </Field>
            <Field label="Pod" htmlFor="alice-pod">
              <PopoverCommandSelect
                id="alice-pod"
                value={agent.pod}
                onChange={(pod) => setAgent((s) => ({ ...s, pod }))}
                options={PODS}
              />
            </Field>
            <Field label="Lane" htmlFor="alice-lane">
              <Input
                id="alice-lane"
                value={agent.lane}
                onChange={(e) =>
                  setAgent((s) => ({ ...s, lane: e.target.value }))
                }
              />
            </Field>
          </div>
        </Panel>

        <Panel
          eyebrow="step 3"
          title="Review & register"
          meta={
            <Chip tone={step === 'review' ? 'accent' : 'ghost'}>
              {step === 'review' ? 'current' : 'pending'}
            </Chip>
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <KeyValueList items={reviewItems} columns={3} />
            <div className="bn-row" style={{ gap: 8 }}>
              <Button
                id="mcp-alice-register"
                variant="primary"
                icon="check"
                disabled={busy}
                onClick={registerAlice}
              >
                Register Alice operator + agent
              </Button>
              <Button
                variant="ghost"
                icon="arrow"
                onClick={() => setStep('agent')}
              >
                Back to agent
              </Button>
            </div>
            <Terminal title="alice onboarding output" content={output} />
          </div>
        </Panel>

        <Panel eyebrow="next" title="Where to go from here">
          <div className="bn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button as={Link} to="/inventory" icon="graph">
              Open inventory
            </Button>
            <Button as={Link} to="/settings/alice" icon="cpu">
              Alice settings
            </Button>
            <Button as={Link} to="/marketplace" icon="bolt">
              Marketplace stream
            </Button>
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
};

export default AliceOnboarding;
