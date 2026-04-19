import { useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';

const GITHUB_APP_INSTALL_URL =
  import.meta.env.VITE_GITHUB_APP_INSTALL_URL || 'https://github.com/apps';

const BobOnboarding = () => {
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

  const save = async () => {
    try {
      setBusy(true);
      const setupResp = await fetch('/api/bountynet/market/repositories/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
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
      });
      const setupPayload = await setupResp.json();
      if (!setupResp.ok) {
        throw new Error(setupPayload.error || `setup failed (${setupResp.status})`);
      }

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
      if (!presetResp.ok) {
        throw new Error(presetPayload.error || `preset failed (${presetResp.status})`);
      }

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
    <PageLayout fallback={<p>Loading Bob onboarding...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Persona onboarding: Bob</p>
        <h1>Connect GitHub and configure spend policy.</h1>
        <p>
          This is the repo-owner path: installation access, target repos, required checks,
          and budget controls.
        </p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Step 1: GitHub App install</h2>
          <p>Install and authorize the app for your organization or repository.</p>
          <a href={GITHUB_APP_INSTALL_URL} target="_blank" rel="noreferrer">
            Open GitHub App installation
          </a>
        </article>

        <article className="bn-market-card">
          <h2>Step 2: Repository + spend setup</h2>
          <label htmlFor="bob-repo">Repo Full Name</label>
          <input
            id="bob-repo"
            value={form.repo}
            onChange={(e) => setForm((s) => ({ ...s, repo: e.target.value }))}
          />
          <label htmlFor="bob-local">Local Path</label>
          <input
            id="bob-local"
            value={form.localPath}
            onChange={(e) => setForm((s) => ({ ...s, localPath: e.target.value }))}
          />
          <label htmlFor="bob-installation">GitHub Installation ID</label>
          <input
            id="bob-installation"
            value={form.installationId}
            onChange={(e) => setForm((s) => ({ ...s, installationId: e.target.value }))}
          />
          <div className="bn-market-inline">
            <div>
              <label htmlFor="bob-monthly">Monthly Cap</label>
              <input
                id="bob-monthly"
                value={form.monthlyCap}
                onChange={(e) => setForm((s) => ({ ...s, monthlyCap: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="bob-perjob">Per-job Cap</label>
              <input
                id="bob-perjob"
                value={form.perJobCap}
                onChange={(e) => setForm((s) => ({ ...s, perJobCap: e.target.value }))}
              />
            </div>
          </div>
          <label htmlFor="bob-preset">Preset</label>
          <select
            id="bob-preset"
            value={form.preset}
            onChange={(e) => setForm((s) => ({ ...s, preset: e.target.value }))}
          >
            <option value="typescript_ci_repair">typescript_ci_repair</option>
            <option value="typescript_security_audit">typescript_security_audit</option>
            <option value="rust_security_patch">rust_security_patch</option>
            <option value="rust_porting">rust_porting</option>
          </select>
          <button id="mcp-bob-save" type="button" onClick={save} disabled={busy}>
            Save Bob configuration
          </button>
          <pre>{output}</pre>
        </article>

        <article className="bn-market-card">
          <h2>Next</h2>
          <p>Once configured, Bob can monitor outcomes and spend from inventory/settings.</p>
          <div className="bn-cta-row">
            <Link to="/inventory">Open inventory</Link>
            <Link to="/settings/bob">Bob settings</Link>
            <Link to="/marketplace">Marketplace stream</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default BobOnboarding;
