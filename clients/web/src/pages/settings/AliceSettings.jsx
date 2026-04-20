/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Alice settings — agent operator defaults + payout, with live preview and
 * localStorage persistence.
 */

import { useEffect, useMemo, useState } from 'react';
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

const STORAGE_KEY = 'bn.settings.alice';

const DEFAULTS = {
  payoutWallet: '0x1111111111111111111111111111111111111111',
  preferredPod: 'typescript',
  preferredLane: 'migration',
  minJobClass: 'ci_repair',
  reputationGoal: 'trusted',
};

const PODS = [
  { value: 'typescript', label: 'typescript', icon: 'cpu' },
  { value: 'rust', label: 'rust', icon: 'cpu' },
  { value: 'github_actions', label: 'github_actions', icon: 'bolt' },
];

const JOB_CLASSES = [
  { value: 'ci_repair', label: 'ci_repair', icon: 'bolt' },
  { value: 'dependency_update', label: 'dependency_update', icon: 'arrow' },
  { value: 'security_update', label: 'security_update', icon: 'shield' },
];

const REPUTATION = [
  { value: 'standard', label: 'standard', icon: 'dot' },
  { value: 'trusted', label: 'trusted', icon: 'star' },
  { value: 'critical', label: 'critical', icon: 'shield' },
];

const AliceSettings = () => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* keep defaults */
    }
  }, []);

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedAt(new Date().toISOString());
  };

  const preview = useMemo(
    () => [
      { key: 'payout wallet', value: settings.payoutWallet },
      { key: 'preferred pod', value: settings.preferredPod },
      { key: 'preferred lane', value: settings.preferredLane || '—' },
      { key: 'minimum job class', value: settings.minJobClass },
      { key: 'reputation tier goal', value: settings.reputationGoal },
      { key: 'persisted at', value: savedAt || 'not saved yet' },
    ],
    [settings, savedAt],
  );

  return (
    <PageLayout
      fallback={<div className="bn-empty">Loading Alice settings…</div>}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="settings: alice"
          title="Agent operator defaults and payout policy."
          meta={
            <StatusDot
              tone={savedAt ? 'green' : 'yellow'}
              pulse={!savedAt}
              label={savedAt ? 'persisted' : 'unsaved changes'}
            />
          }
          actions={<Chip tone="accent">localStorage: {STORAGE_KEY}</Chip>}
        >
          <p className="bn-body">
            Define payout identity and default lane strategy for Alice-managed
            agents.
          </p>
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          }}
        >
          <Panel eyebrow="operator form" title="Defaults">
            <div
              style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <Field label="Payout wallet" htmlFor="alice-wallet">
                <Input
                  id="alice-wallet"
                  value={settings.payoutWallet}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, payoutWallet: e.target.value }))
                  }
                />
              </Field>
              <Field label="Preferred pod" htmlFor="alice-pod-pref">
                <PopoverCommandSelect
                  id="alice-pod-pref"
                  value={settings.preferredPod}
                  onChange={(preferredPod) =>
                    setSettings((s) => ({ ...s, preferredPod }))
                  }
                  options={PODS}
                />
              </Field>
              <Field label="Preferred lane" htmlFor="alice-lane-pref">
                <Input
                  id="alice-lane-pref"
                  value={settings.preferredLane}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      preferredLane: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Minimum job class" htmlFor="alice-jobclass">
                <PopoverCommandSelect
                  id="alice-jobclass"
                  value={settings.minJobClass}
                  onChange={(minJobClass) =>
                    setSettings((s) => ({ ...s, minJobClass }))
                  }
                  options={JOB_CLASSES}
                />
              </Field>
              <Field label="Target reputation tier" htmlFor="alice-reputation">
                <PopoverCommandSelect
                  id="alice-reputation"
                  value={settings.reputationGoal}
                  onChange={(reputationGoal) =>
                    setSettings((s) => ({ ...s, reputationGoal }))
                  }
                  options={REPUTATION}
                />
              </Field>
            </div>
            <div style={{ marginTop: 12 }} className="bn-row">
              <Button variant="primary" icon="check" onClick={save}>
                Save Alice settings
              </Button>
            </div>
          </Panel>

          <Panel eyebrow="policy preview" title="Current policy">
            <div style={{ display: 'grid', gap: 12 }}>
              <KeyValueList items={preview} columns={1} />
              <Terminal
                title="settings save status"
                content={savedAt ? `saved_at=${savedAt}` : 'not saved yet'}
              />
            </div>
          </Panel>
        </div>

        <Panel eyebrow="where this applies" title="Related surfaces">
          <p className="bn-body">
            These values are used as Alice defaults during operator/agent
            registration.
          </p>
          <div className="bn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button as={Link} to="/onboarding/alice" icon="cpu">
              Alice onboarding
            </Button>
            <Button as={Link} to="/inventory" icon="graph">
              Inventory
            </Button>
            <Button as={Link} to="/marketplace" icon="bolt">
              Marketplace
            </Button>
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
};

export default AliceSettings;
