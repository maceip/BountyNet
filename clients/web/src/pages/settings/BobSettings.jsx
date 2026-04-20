/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Bob settings — repository-owner policy controls with a live KeyValueList
 * preview and localStorage persistence.
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

const STORAGE_KEY = 'bn.settings.bob';

const DEFAULTS = {
  defaultBudgetType: 'platform_credits',
  requireChecks: 'CI,Typecheck',
  monthlySpendCap: '1000',
  perJobCap: '100',
  autoPromoteThreshold: 'high',
};

const BUDGET_TYPES = [
  { value: 'platform_credits', label: 'platform_credits', icon: 'bolt' },
  { value: 'api_key_pool', label: 'api_key_pool', icon: 'shield' },
];

const THRESHOLDS = [
  { value: 'low', label: 'low', icon: 'dot' },
  { value: 'medium', label: 'medium', icon: 'dot' },
  { value: 'high', label: 'high', icon: 'dot' },
];

const BobSettings = () => {
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
      { key: 'default budget', value: settings.defaultBudgetType },
      { key: 'required checks', value: settings.requireChecks || '—' },
      { key: 'monthly cap', value: `$${settings.monthlySpendCap}` },
      { key: 'per-job cap', value: `$${settings.perJobCap}` },
      { key: 'auto-promote', value: settings.autoPromoteThreshold },
      { key: 'persisted at', value: savedAt || 'not saved yet' },
    ],
    [settings, savedAt],
  );

  return (
    <PageLayout
      fallback={<div className="bn-empty">Loading Bob settings…</div>}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="settings: bob"
          title="Repository-owner policy controls."
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
            Set default spend, required checks, and promotion policy for
            Bob-owned repositories.
          </p>
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          }}
        >
          <Panel eyebrow="policy form" title="Defaults">
            <div
              style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <Field label="Default budget type" htmlFor="bob-budget-type">
                <PopoverCommandSelect
                  id="bob-budget-type"
                  value={settings.defaultBudgetType}
                  onChange={(defaultBudgetType) =>
                    setSettings((s) => ({ ...s, defaultBudgetType }))
                  }
                  options={BUDGET_TYPES}
                />
              </Field>
              <Field
                label="Required checks (comma-separated)"
                htmlFor="bob-checks"
              >
                <Input
                  id="bob-checks"
                  value={settings.requireChecks}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      requireChecks: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Monthly spend cap (USD)" htmlFor="bob-monthly-cap">
                <Input
                  id="bob-monthly-cap"
                  value={settings.monthlySpendCap}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      monthlySpendCap: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Per-job cap (USD)" htmlFor="bob-perjob-cap">
                <Input
                  id="bob-perjob-cap"
                  value={settings.perJobCap}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, perJobCap: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Auto-promote threshold"
                htmlFor="bob-promote-threshold"
              >
                <PopoverCommandSelect
                  id="bob-promote-threshold"
                  value={settings.autoPromoteThreshold}
                  onChange={(autoPromoteThreshold) =>
                    setSettings((s) => ({ ...s, autoPromoteThreshold }))
                  }
                  options={THRESHOLDS}
                />
              </Field>
            </div>
            <div style={{ marginTop: 12 }} className="bn-row">
              <Button variant="primary" icon="check" onClick={save}>
                Save Bob settings
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
            These values are used as Bob defaults during onboarding and
            repository setup decisions.
          </p>
          <div className="bn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button as={Link} to="/onboarding/bob" icon="shield">
              Bob onboarding
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

export default BobSettings;
