import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';

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
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Settings: Bob</p>
        <h1>Repository-owner policy controls.</h1>
        <p>Set default spend and promotion policy for Bob-owned repositories.</p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <label htmlFor="bob-budget-type">Default Budget Type</label>
          <select
            id="bob-budget-type"
            value={settings.defaultBudgetType}
            onChange={(e) =>
              setSettings((s) => ({ ...s, defaultBudgetType: e.target.value }))
            }
          >
            <option value="platform_credits">platform_credits</option>
            <option value="api_key_pool">api_key_pool</option>
          </select>
          <label htmlFor="bob-checks">Required Checks (comma separated)</label>
          <input
            id="bob-checks"
            value={settings.requireChecks}
            onChange={(e) => setSettings((s) => ({ ...s, requireChecks: e.target.value }))}
          />
          <div className="bn-market-inline">
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
          <label htmlFor="bob-promote-threshold">Auto-promote threshold</label>
          <select
            id="bob-promote-threshold"
            value={settings.autoPromoteThreshold}
            onChange={(e) =>
              setSettings((s) => ({ ...s, autoPromoteThreshold: e.target.value }))
            }
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
          <button type="button" onClick={save}>
            Save Bob settings
          </button>
          <pre>{savedAt ? `saved_at=${savedAt}` : 'not saved yet'}</pre>
        </article>
        <article className="bn-market-card">
          <h2>Where this applies</h2>
          <p>
            These values are used as Bob defaults during onboarding and repository
            setup decisions.
          </p>
          <div className="bn-cta-row">
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
