import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { PopoverCommandSelect, Terminal } from '../../components/smui/index.jsx';

const STORAGE_KEY = 'bn.settings.agent_operator';

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
    <PageLayout fallback={<p>Loading agent operator settings...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">settings: agent_operator</p>
        <h1>agent operator defaults and payout policy.</h1>
        <p>Define payout identity and default lane strategy for your agents.</p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <label htmlFor="ao-wallet">Payout Wallet</label>
          <input
            id="ao-wallet"
            value={settings.payoutWallet}
            onChange={(e) => setSettings((s) => ({ ...s, payoutWallet: e.target.value }))}
          />
          <PopoverCommandSelect
            id="ao-pod-pref"
            label="Preferred Pod"
            value={settings.preferredPod}
            onChange={(preferredPod) => setSettings((s) => ({ ...s, preferredPod }))}
            options={[
              { value: 'typescript', label: 'typescript' },
              { value: 'rust', label: 'rust' },
              { value: 'github_actions', label: 'github_actions' },
            ]}
          />
          <label htmlFor="ao-lane-pref">Preferred Lane</label>
          <input
            id="ao-lane-pref"
            value={settings.preferredLane}
            onChange={(e) => setSettings((s) => ({ ...s, preferredLane: e.target.value }))}
          />
          <PopoverCommandSelect
            id="ao-jobclass"
            label="Minimum Job Class"
            value={settings.minJobClass}
            onChange={(minJobClass) => setSettings((s) => ({ ...s, minJobClass }))}
            options={[
              { value: 'ci_repair', label: 'ci_repair' },
              { value: 'dependency_update', label: 'dependency_update' },
              { value: 'security_update', label: 'security_update' },
            ]}
          />
          <PopoverCommandSelect
            id="ao-reputation"
            label="Target Reputation Tier"
            value={settings.reputationGoal}
            onChange={(reputationGoal) => setSettings((s) => ({ ...s, reputationGoal }))}
            options={[
              { value: 'standard', label: 'standard' },
              { value: 'trusted', label: 'trusted' },
              { value: 'critical', label: 'critical' },
            ]}
          />
          <button type="button" onClick={save}>
            Save operator settings
          </button>
          <Terminal title="settings save status" content={savedAt ? `saved_at=${savedAt}` : 'not saved yet'} />
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">where this applies</h2>
          <p>
            These values are used as defaults during operator/agent registration.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/onboarding/agent-operator">Operator onboarding</Link>
            <Link to="/inventory">Inventory</Link>
            <Link to="/marketplace">Marketplace</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default AliceSettings;
