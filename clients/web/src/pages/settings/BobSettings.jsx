import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { PopoverCommandSelect, Terminal } from '../../components/smui/index.jsx';

const STORAGE_KEY = 'bn.settings.bob';

const DEFAULTS = {
  defaultBudgetType: 'platform_credits',
  requireChecks: 'CI,Typecheck',
  monthlySpendCap: '1000',
  perJobCap: '100',
  autoPromoteThreshold: 'high',
};

const BobSettings = () => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // keep defaults
    }
  }, []);

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedAt(new Date().toISOString());
  };

  return (
    <PageLayout fallback={<p>Loading Bob settings...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">settings: bob</p>
        <h1>repository-owner policy controls.</h1>
        <p>Set default spend and promotion policy for Bob-owned repositories.</p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <PopoverCommandSelect
            id="bob-budget-type"
            label="Default Budget Type"
            value={settings.defaultBudgetType}
            onChange={(defaultBudgetType) => setSettings((s) => ({ ...s, defaultBudgetType }))}
            options={[
              { value: 'platform_credits', label: 'platform_credits' },
              { value: 'api_key_pool', label: 'api_key_pool' },
            ]}
          />
          <label htmlFor="bob-checks">Required Checks (comma separated)</label>
          <input
            id="bob-checks"
            value={settings.requireChecks}
            onChange={(e) => setSettings((s) => ({ ...s, requireChecks: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <label htmlFor="bob-monthly-cap">Monthly Spend Cap</label>
              <input
                id="bob-monthly-cap"
                value={settings.monthlySpendCap}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, monthlySpendCap: e.target.value }))
                }
              />
            </div>
            <div>
              <label htmlFor="bob-perjob-cap">Per-job Cap</label>
              <input
                id="bob-perjob-cap"
                value={settings.perJobCap}
                onChange={(e) => setSettings((s) => ({ ...s, perJobCap: e.target.value }))}
              />
            </div>
          </div>
          <PopoverCommandSelect
            id="bob-promote-threshold"
            label="Auto-promote threshold"
            value={settings.autoPromoteThreshold}
            onChange={(autoPromoteThreshold) => setSettings((s) => ({ ...s, autoPromoteThreshold }))}
            options={[
              { value: 'low', label: 'low' },
              { value: 'medium', label: 'medium' },
              { value: 'high', label: 'high' },
            ]}
          />
          <button type="button" onClick={save}>
            Save Bob settings
          </button>
          <Terminal title="settings save status" content={savedAt ? `saved_at=${savedAt}` : 'not saved yet'} />
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">where this applies</h2>
          <p>
            These values are used as Bob defaults during onboarding and repository
            setup decisions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/onboarding/bob">Bob onboarding</Link>
            <Link to="/inventory">Inventory</Link>
            <Link to="/marketplace">Marketplace</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default BobSettings;
