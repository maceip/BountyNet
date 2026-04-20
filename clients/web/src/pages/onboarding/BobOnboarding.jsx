/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Bob onboarding — install GitHub app, connect a repo, configure spend policy
 * + preset. Stepper structure.
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

const GITHUB_APP_INSTALL_URL =
  import.meta.env.VITE_GITHUB_APP_INSTALL_URL || 'https://github.com/apps';

const PRESETS = [
  {
    value: 'typescript_ci_repair',
    label: 'typescript_ci_repair',
    icon: 'bolt',
  },
  {
    value: 'typescript_security_audit',
    label: 'typescript_security_audit',
    icon: 'shield',
  },
  {
    value: 'rust_security_patch',
    label: 'rust_security_patch',
    icon: 'shield',
  },
  { value: 'rust_porting', label: 'rust_porting', icon: 'arrow' },
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
            borderLeft: index === 0 ? undefined : 'none',
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

const BobOnboarding = () => {
  const [step, setStep] = useState('github');
  const [form, setForm] = useState({
    repo: 'local/demo-repo',
    localPath: '',
    installationId: '1',
    monthlyCap: '1000',
    perJobCap: '100',
    preset: 'typescript_ci_repair',
  });
  const [output, setOutput] = useState('idle');
  const [busy, setBusy] = useState(false);

  const policyPreview = useMemo(
    () => [
      { key: 'repo', value: form.repo || '—' },
      { key: 'local path', value: form.localPath || '—' },
      { key: 'installation id', value: form.installationId || '—' },
      { key: 'monthly cap', value: `$${form.monthlyCap || 0}` },
      { key: 'per-job cap', value: `$${form.perJobCap || 0}` },
      { key: 'preset', value: form.preset },
    ],
    [form],
  );

  const save = async () => {
    try {
      setBusy(true);
      const setupResp = await fetch(
        '/api/bountynet/market/repositories/setup',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            installation_id: Number(form.installationId || 1),
            repos: [form.repo],
            local_path: form.localPath,
            owner: 'bob',
            required_checks: ['CI'],
            budget_priority: ['platform_credits', 'api_key_pool'],
            monthly_spend_cap: Number(form.monthlyCap || 0),
            per_job_spend_cap: Number(form.perJobCap || 0),
          }),
        },
      );
      const setupPayload = await setupResp.json();
      if (!setupResp.ok)
        throw new Error(
          setupPayload.error || `setup failed (${setupResp.status})`,
        );

      const presetResp = await fetch(
        `/api/bountynet/market/repositories/${encodeURIComponent(form.repo)}/apply-preset`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ preset: form.preset }),
        },
      );
      const presetPayload = await presetResp.json();
      if (!presetResp.ok)
        throw new Error(
          presetPayload.error || `preset failed (${presetResp.status})`,
        );

      setOutput(
        JSON.stringify(
          {
            status: 'ok',
            repository_setup: setupPayload,
            preset_application: presetPayload,
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
      fallback={<div className="bn-empty">Loading Bob onboarding…</div>}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="persona onboarding: bob"
          title="Connect GitHub and configure spend policy."
          meta={<StatusDot tone="accent" pulse label="repo owner path" />}
        >
          <p className="bn-body">
            Installation access, target repos, required checks, and budget
            controls. Completing all three steps saves Bob&rsquo;s repository
            config and applies the chosen preset.
          </p>
          <Stepper
            active={step}
            steps={[
              {
                id: 'github',
                label: 'GitHub',
                hint: 'install the BountyNet app',
              },
              { id: 'repo', label: 'Repo', hint: 'configure spend + preset' },
              { id: 'policy', label: 'Policy', hint: 'review & save' },
            ]}
          />
        </Panel>

        <Panel
          eyebrow="step 1"
          title="Install the GitHub App"
          meta={
            <Chip tone={step === 'github' ? 'accent' : 'green'}>
              {step === 'github' ? 'current' : 'completed'}
            </Chip>
          }
          actions={
            <Button size="sm" icon="arrow" onClick={() => setStep('repo')}>
              Next: repo
            </Button>
          }
        >
          <p className="bn-body">
            Authorise the app for your organization or repository to grant
            installation access.
          </p>
          <Button
            as="a"
            href={GITHUB_APP_INSTALL_URL}
            target="_blank"
            rel="noreferrer"
            variant="primary"
            icon="globe"
            trailingIcon="arrow"
          >
            Open GitHub App installation
          </Button>
        </Panel>

        <Panel
          eyebrow="step 2"
          title="Repository + spend setup"
          meta={
            <Chip
              tone={
                step === 'repo'
                  ? 'accent'
                  : step === 'policy'
                    ? 'green'
                    : 'ghost'
              }
            >
              {step === 'repo'
                ? 'current'
                : step === 'policy'
                  ? 'completed'
                  : 'pending'}
            </Chip>
          }
          actions={
            <Button size="sm" icon="arrow" onClick={() => setStep('policy')}>
              Next: review
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
              }}
            >
              <Field label="Repo full name" htmlFor="bob-repo">
                <Input
                  id="bob-repo"
                  value={form.repo}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, repo: e.target.value }))
                  }
                  placeholder="owner/name"
                />
              </Field>
              <Field label="Local path" htmlFor="bob-local">
                <Input
                  id="bob-local"
                  value={form.localPath}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, localPath: e.target.value }))
                  }
                  placeholder="/code/bob-repo"
                />
              </Field>
              <Field label="GitHub installation ID" htmlFor="bob-installation">
                <Input
                  id="bob-installation"
                  value={form.installationId}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, installationId: e.target.value }))
                  }
                />
              </Field>
              <Field label="Monthly cap (USD)" htmlFor="bob-monthly">
                <Input
                  id="bob-monthly"
                  value={form.monthlyCap}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, monthlyCap: e.target.value }))
                  }
                />
              </Field>
              <Field label="Per-job cap (USD)" htmlFor="bob-perjob">
                <Input
                  id="bob-perjob"
                  value={form.perJobCap}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, perJobCap: e.target.value }))
                  }
                />
              </Field>
              <Field label="Preset" htmlFor="bob-preset">
                <PopoverCommandSelect
                  id="bob-preset"
                  value={form.preset}
                  onChange={(preset) => setForm((s) => ({ ...s, preset }))}
                  options={PRESETS}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="step 3"
          title="Review & save"
          meta={
            <Chip tone={step === 'policy' ? 'accent' : 'ghost'}>
              {step === 'policy' ? 'current' : 'pending'}
            </Chip>
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <KeyValueList items={policyPreview} columns={3} />
            <div className="bn-row" style={{ gap: 8 }}>
              <Button
                id="mcp-bob-save"
                variant="primary"
                icon="check"
                disabled={busy}
                onClick={save}
              >
                Save Bob configuration
              </Button>
              <Button
                variant="ghost"
                icon="arrow"
                onClick={() => setStep('repo')}
              >
                Back to repo setup
              </Button>
            </div>
            <Terminal title="bob onboarding output" content={output} />
          </div>
        </Panel>

        <Panel eyebrow="next" title="Where to go from here">
          <div className="bn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button as={Link} to="/inventory" icon="graph">
              Open inventory
            </Button>
            <Button as={Link} to="/settings/bob" icon="shield">
              Bob settings
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

export default BobOnboarding;
