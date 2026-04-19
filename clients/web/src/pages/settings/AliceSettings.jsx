import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';

const STORAGE_KEY = 'bn.settings.alice';

const DEFAULTS = {
  payoutWallet: '0x1111111111111111111111111111111111111111',
  preferredPod: 'typescript',
  preferredLane: 'migration',
  minJobClass: 'ci_repair',
  reputationGoal: 'trusted',
};

const AliceSettings = () => {
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
    <PageLayout fallback={<p>Loading Alice settings...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Settings: Alice</p>
        <h1>Agent operator defaults and payout policy.</h1>
        <p>Define payout identity and default lane strategy for Alice-managed agents.</p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <label htmlFor="alice-wallet">Payout Wallet</label>
          <input
            id="alice-wallet"
            value={settings.payoutWallet}
            onChange={(e) => setSettings((s) => ({ ...s, payoutWallet: e.target.value }))}
          />
          <label htmlFor="alice-pod-pref">Preferred Pod</label>
          <select
            id="alice-pod-pref"
            value={settings.preferredPod}
            onChange={(e) => setSettings((s) => ({ ...s, preferredPod: e.target.value }))}
          >
            <option value="typescript">typescript</option>
            <option value="rust">rust</option>
            <option value="github_actions">github_actions</option>
          </select>
          <label htmlFor="alice-lane-pref">Preferred Lane</label>
          <input
            id="alice-lane-pref"
            value={settings.preferredLane}
            onChange={(e) => setSettings((s) => ({ ...s, preferredLane: e.target.value }))}
          />
          <label htmlFor="alice-jobclass">Minimum Job Class</label>
          <select
            id="alice-jobclass"
            value={settings.minJobClass}
            onChange={(e) => setSettings((s) => ({ ...s, minJobClass: e.target.value }))}
          >
            <option value="ci_repair">ci_repair</option>
            <option value="dependency_update">dependency_update</option>
            <option value="security_update">security_update</option>
          </select>
          <label htmlFor="alice-reputation">Target Reputation Tier</label>
          <select
            id="alice-reputation"
            value={settings.reputationGoal}
            onChange={(e) => setSettings((s) => ({ ...s, reputationGoal: e.target.value }))}
          >
            <option value="standard">standard</option>
            <option value="trusted">trusted</option>
            <option value="critical">critical</option>
          </select>
          <button type="button" onClick={save}>
            Save Alice settings
          </button>
          <pre>{savedAt ? `saved_at=${savedAt}` : 'not saved yet'}</pre>
        </article>
        <article className="bn-market-card">
          <h2>Where this applies</h2>
          <p>
            These values are used as Alice defaults during operator/agent registration.
          </p>
          <div className="bn-cta-row">
            <Link to="/onboarding/alice">Alice onboarding</Link>
            <Link to="/inventory">Inventory</Link>
            <Link to="/marketplace">Marketplace</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default AliceSettings;
