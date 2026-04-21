import { useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { PopoverCommandSelect, Terminal } from '../../components/smui/index.jsx';

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
          owner: 'repo_owner',
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
    <PageLayout fallback={<p>Loading repo owner onboarding...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">persona onboarding: repo_owner</p>
        <h1>connect github and configure spend policy.</h1>
        <p>
          This is the repo-owner path: installation access, target repos, required checks,
          and budget controls.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 desktop:grid-cols-3 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">step 1: github app install</h2>
          <p>Install and authorize the app for your organization or repository.</p>
          <a href={GITHUB_APP_INSTALL_URL} target="_blank" rel="noreferrer">
            Open GitHub App installation
          </a>
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">step 2: repository + spend setup</h2>
          <label htmlFor="ro-repo">Repo Full Name</label>
          <input
            id="ro-repo"
            value={form.repo}
            onChange={(e) => setForm((s) => ({ ...s, repo: e.target.value }))}
          />
          <label htmlFor="ro-local">Local Path</label>
          <input
            id="ro-local"
            value={form.localPath}
            onChange={(e) => setForm((s) => ({ ...s, localPath: e.target.value }))}
          />
          <label htmlFor="ro-installation">GitHub Installation ID</label>
          <input
            id="ro-installation"
            value={form.installationId}
            onChange={(e) => setForm((s) => ({ ...s, installationId: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <label htmlFor="ro-monthly">Monthly Cap</label>
              <input
                id="ro-monthly"
                value={form.monthlyCap}
                onChange={(e) => setForm((s) => ({ ...s, monthlyCap: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="ro-perjob">Per-job Cap</label>
              <input
                id="ro-perjob"
                value={form.perJobCap}
                onChange={(e) => setForm((s) => ({ ...s, perJobCap: e.target.value }))}
              />
            </div>
          </div>
          <PopoverCommandSelect
            id="ro-preset"
            label="Preset"
            value={form.preset}
            onChange={(preset) => setForm((s) => ({ ...s, preset }))}
            options={[
              { value: 'typescript_ci_repair', label: 'typescript_ci_repair' },
              { value: 'typescript_security_audit', label: 'typescript_security_audit' },
              { value: 'rust_security_patch', label: 'rust_security_patch' },
              { value: 'rust_porting', label: 'rust_porting' },
            ]}
          />
          <button id="mcp-repo-owner-save" type="button" onClick={save} disabled={busy}>
            Save repo owner configuration
          </button>
          <Terminal title="repo owner onboarding output" content={output} />
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">next</h2>
          <p>Once configured, you can monitor outcomes and spend from inventory/settings.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/inventory">Open inventory</Link>
            <Link to="/settings/repo-owner">Repo owner settings</Link>
            <Link to="/marketplace">Marketplace stream</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default BobOnboarding;
