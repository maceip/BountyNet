import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  CommitGraph,
  PopoverCommandSelect,
  RepoCard,
  Terminal,
} from '../../components/smui/index.jsx';

const initialForm = {
  repoName: 'local/demo-repo',
  repoPath: '',
  installationId: '1',
  preset: 'typescript_ci_repair',
  jobRepo: 'local/demo-repo',
  jobClass: 'ci_repair',
  risk: 'medium',
  title: 'Repair repository maintenance drift',
  pod: 'typescript',
  lane: 'migration',
  packageName: '',
  targetVersion: '',
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
};

const pretty = (value) => JSON.stringify(value, null, 2);

const Marketplace = () => {
  const [form, setForm] = useState(initialForm);
  const [seedOutput, setSeedOutput] = useState('idle');
  const [repoOutput, setRepoOutput] = useState('idle');
  const [jobOutput, setJobOutput] = useState('idle');
  const [jobs, setJobs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [operators, setOperators] = useState([]);
  const [offers, setOffers] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [offerForm, setOfferForm] = useState({
    agentId: '',
    amount: '500',
    currency: 'credits',
    etaSeconds: '3600',
    notes: '',
  });
  const [awardOfferId, setAwardOfferId] = useState('');
  const [disputeForm, setDisputeForm] = useState({
    reasonCode: 'quality',
    reason: 'Needs manual review',
    settlementId: '',
  });
  const [busyAction, setBusyAction] = useState('');

  const setField = (key, value) =>
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

  const withAction = async (name, callback) => {
    try {
      setBusyAction(name);
      await callback();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (name.startsWith('seed')) {
        setSeedOutput(pretty({ error: message }));
      } else if (name.startsWith('repo')) {
        setRepoOutput(pretty({ error: message }));
      } else {
        setJobOutput(pretty({ error: message }));
      }
    } finally {
      setBusyAction('');
    }
  };

  const loadJobs = async () => {
    const payload = await fetchJson('/api/bountynet/market/jobs');
    setJobs(payload.jobs || []);
  };

  const loadRepos = async () => {
    const payload = await fetchJson('/api/bountynet/market/repositories');
    setRepos(payload.repositories || []);
  };

  const loadOperators = async () => {
    const payload = await fetchJson('/api/bountynet/market/operators');
    setOperators(payload.operators || []);
  };

  const loadOffers = async (jobId) => {
    if (!jobId) {
      setOffers([]);
      return;
    }
    const payload = await fetchJson(
      `/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/offers`,
    );
    setOffers(payload.offers || []);
  };

  const loadSettlements = async (jobId) => {
    if (!jobId) {
      setSettlements([]);
      return;
    }
    const payload = await fetchJson(
      `/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/settlements`,
    );
    setSettlements(payload.settlements || []);
  };

  const loadDisputes = async (jobId) => {
    if (!jobId) {
      setDisputes([]);
      return;
    }
    const payload = await fetchJson(
      `/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/disputes`,
    );
    setDisputes(payload.disputes || []);
  };

  const seedFleet = async () =>
    withAction('seed-fleet', async () => {
      const payload = await fetchJson('/api/bountynet/market/seed', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSeedOutput(pretty(payload));
      await loadJobs();
      await loadOperators();
    });

  const saveRepo = async () =>
    withAction('repo-save', async () => {
      const payload = await fetchJson('/api/bountynet/market/repositories/setup', {
        method: 'POST',
        body: JSON.stringify({
          installation_id: Number(form.installationId || 1),
          repos: [form.repoName],
          local_path: form.repoPath,
          owner: 'local',
          budget_priority: ['platform_credits', 'api_key_pool'],
          has_api_key_pool: true,
        }),
      });
      setRepoOutput(pretty(payload));
    });

  const applyPreset = async () =>
    withAction('repo-preset', async () => {
      const repo = encodeURIComponent(form.repoName);
      const payload = await fetchJson(
        `/api/bountynet/market/repositories/${repo}/apply-preset`,
        {
          method: 'POST',
          body: JSON.stringify({ preset: form.preset }),
        },
      );
      setRepoOutput(pretty(payload));
    });

  const createJob = async () =>
    withAction('job-create', async () => {
      const metadata = {
        pod: form.pod,
        lane: form.lane,
        required_trust_tier: 'standard',
      };
      if (form.packageName.trim()) {
        metadata.package = form.packageName.trim();
        metadata.crate = form.packageName.trim();
      }
      if (form.targetVersion.trim()) {
        metadata.target_version = form.targetVersion.trim();
      }

      const payload = await fetchJson('/api/bountynet/market/jobs', {
        method: 'POST',
        body: JSON.stringify({
          repo_full_name: form.jobRepo,
          job_class: form.jobClass,
          title: form.title,
          risk_level: form.risk,
          metadata,
        }),
      });
      setJobOutput(pretty(payload));
      await loadJobs();
      await loadRepos();
    });

  const runAutopilot = async (jobId) =>
    withAction(`job-autopilot-${jobId}`, async () => {
      const payload = await fetchJson(
        `/api/bountynet/market/jobs/${encodeURIComponent(jobId)}/autopilot`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      setJobOutput(pretty(payload));
      await loadJobs();
      await loadRepos();
    });

  const createOffer = async () =>
    withAction('offer-create', async () => {
      if (!selectedJobId) {
        throw new Error('Select a job first');
      }
      const payload = await fetchJson(
        `/api/bountynet/market/jobs/${encodeURIComponent(selectedJobId)}/offers`,
        {
          method: 'POST',
          body: JSON.stringify({
            agent_id: offerForm.agentId,
            amount: Number(offerForm.amount || 0),
            currency: offerForm.currency,
            eta_seconds: Number(offerForm.etaSeconds || 0),
            notes: offerForm.notes,
          }),
        },
      );
      setJobOutput(pretty(payload));
      await loadOffers(selectedJobId);
    });

  const awardOffer = async () =>
    withAction('offer-award', async () => {
      if (!selectedJobId || !awardOfferId) {
        throw new Error('Select job and offer first');
      }
      const payload = await fetchJson(
        `/api/bountynet/market/jobs/${encodeURIComponent(selectedJobId)}/award`,
        {
          method: 'POST',
          body: JSON.stringify({
            offer_id: awardOfferId,
            awarded_by: 'repo_owner',
          }),
        },
      );
      setJobOutput(pretty(payload));
      await loadJobs();
      await loadOffers(selectedJobId);
    });

  const openDispute = async () =>
    withAction('dispute-open', async () => {
      if (!selectedJobId) {
        throw new Error('Select a job first');
      }
      const payload = await fetchJson(
        `/api/bountynet/market/jobs/${encodeURIComponent(selectedJobId)}/disputes`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason_code: disputeForm.reasonCode,
            reason: disputeForm.reason,
            settlement_id: disputeForm.settlementId,
            opened_by: 'repo_owner',
          }),
        },
      );
      setJobOutput(pretty(payload));
      await loadDisputes(selectedJobId);
      await loadSettlements(selectedJobId);
    });

  const settleAction = async (settlementId, action) =>
    withAction(`settlement-${action}-${settlementId}`, async () => {
      const payload = await fetchJson(
        `/api/bountynet/market/settlements/${encodeURIComponent(settlementId)}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({ notes: `marketplace ${action}` }),
        },
      );
      setJobOutput(pretty(payload));
      await loadSettlements(selectedJobId);
    });

  useEffect(() => {
    Promise.all([loadJobs(), loadRepos(), loadOperators()]).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setJobOutput(pretty({ error: message }));
    });
  }, []);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    Promise.all([
      loadOffers(selectedJobId),
      loadSettlements(selectedJobId),
      loadDisputes(selectedJobId),
    ]).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setJobOutput(pretty({ error: message }));
    });
  }, [selectedJobId]);

  return (
    <PageLayout fallback={<p>Loading market...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">marketplace</p>
        <h1>agent market</h1>
        <p>An agent marketplace for code improvements.</p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 desktop:grid-cols-3 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">seed fleet</h2>
          <p>Load managed generic and specialist agents.</p>
          <button
            id="mcp-seed-fleet"
            type="button"
            onClick={seedFleet}
            disabled={busyAction === 'seed-fleet'}
          >
            Seed Managed Fleet
          </button>
          <Terminal title="seed output" content={seedOutput} />
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">register repo</h2>
          <label htmlFor="repo-name">Repo Full Name</label>
          <input
            id="repo-name"
            value={form.repoName}
            onChange={(event) => setField('repoName', event.target.value)}
          />
          <label htmlFor="repo-path">Local Path</label>
          <input
            id="repo-path"
            placeholder="C:\\path\\to\\repo"
            value={form.repoPath}
            onChange={(event) => setField('repoPath', event.target.value)}
          />

          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <label htmlFor="repo-installation">Installation</label>
              <input
                id="repo-installation"
                value={form.installationId}
                onChange={(event) => setField('installationId', event.target.value)}
              />
            </div>
            <div>
              <PopoverCommandSelect
                id="repo-preset"
                label="Preset"
                value={form.preset}
                onChange={(preset) => setField('preset', preset)}
                options={[
                  { value: 'typescript_ci_repair', label: 'typescript_ci_repair' },
                  { value: 'typescript_security_audit', label: 'typescript_security_audit' },
                  { value: 'rust_security_patch', label: 'rust_security_patch' },
                  { value: 'rust_porting', label: 'rust_porting' },
                ]}
              />
            </div>
          </div>

          <button type="button" onClick={saveRepo} disabled={busyAction === 'repo-save'}>
            Save Repo
          </button>
          <button type="button" onClick={applyPreset} disabled={busyAction === 'repo-preset'}>
            Apply Preset
          </button>
          <Terminal title="repo output" content={repoOutput} />
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">create job</h2>
          <label htmlFor="job-repo">Repo Full Name</label>
          <input
            id="job-repo"
            value={form.jobRepo}
            onChange={(event) => setField('jobRepo', event.target.value)}
          />

          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <PopoverCommandSelect
                id="job-class"
                label="Job Class"
                value={form.jobClass}
                onChange={(jobClass) => setField('jobClass', jobClass)}
                options={[
                  { value: 'ci_repair', label: 'ci_repair' },
                  { value: 'dependency_update', label: 'dependency_update' },
                  { value: 'security_update', label: 'security_update' },
                  { value: 'config_remediation', label: 'config_remediation' },
                  { value: 'type_repair', label: 'type_repair' },
                ]}
              />
            </div>
            <div>
              <PopoverCommandSelect
                id="job-risk"
                label="Risk"
                value={form.risk}
                onChange={(risk) => setField('risk', risk)}
                options={[
                  { value: 'low', label: 'low' },
                  { value: 'medium', label: 'medium' },
                  { value: 'high', label: 'high' },
                ]}
              />
            </div>
          </div>

          <label htmlFor="job-title">Title</label>
          <input
            id="job-title"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
          />

          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <PopoverCommandSelect
                id="job-pod"
                label="Pod"
                value={form.pod}
                onChange={(pod) => setField('pod', pod)}
                options={[
                  { value: 'typescript', label: 'typescript' },
                  { value: 'rust', label: 'rust' },
                  { value: 'github_actions', label: 'github_actions' },
                ]}
              />
            </div>
            <div>
              <label htmlFor="job-lane">Lane</label>
              <input
                id="job-lane"
                value={form.lane}
                onChange={(event) => setField('lane', event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <label htmlFor="job-package">Package/Crate</label>
              <input
                id="job-package"
                value={form.packageName}
                onChange={(event) => setField('packageName', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="job-version">Target Version</label>
              <input
                id="job-version"
                value={form.targetVersion}
                onChange={(event) => setField('targetVersion', event.target.value)}
              />
            </div>
          </div>

          <button type="button" onClick={createJob} disabled={busyAction === 'job-create'}>
            Create Job
          </button>
          <button type="button" onClick={loadJobs} disabled={busyAction === 'job-refresh'}>
            Refresh Jobs
          </button>
          <Terminal title="job output" content={jobOutput} />
        </article>
      </section>

      <section className="mx-auto mt-4 w-full max-w-6xl border border-border bg-card p-4 px-3 fold:px-6 desktop:px-8">
        <h2 className="text-label">jobs</h2>
        <PopoverCommandSelect
          id="selected-job"
          label="Selected job for offer/award/settlement/dispute"
          value={selectedJobId}
          onChange={setSelectedJobId}
          options={[
            { value: '', label: '-- select --' },
            ...jobs.map((job) => ({
              value: job.id,
              label: `${job.title} (${job.status})`,
            })),
          ]}
        />
        <div id="jobs-list">
          {jobs.length === 0 && <p>No jobs yet.</p>}
          {jobs.map((job) => (
            <article key={job.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{job.title}</strong>
              </p>
              <p>
                <span>{job.job_class}</span> <span>{job.status}</span>
              </p>
              <p>{job.repo_full_name}</p>
              <button
                type="button"
                onClick={() => runAutopilot(job.id)}
                disabled={busyAction === `job-autopilot-${job.id}`}
              >
                Autopilot
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">offer board</h2>
          <label htmlFor="offer-agent">Agent ID</label>
          <input
            id="offer-agent"
            value={offerForm.agentId}
            onChange={(event) =>
              setOfferForm((s) => ({ ...s, agentId: event.target.value }))
            }
          />
          <div className="grid grid-cols-1 gap-2 fold:grid-cols-2">
            <div>
              <label htmlFor="offer-amount">Amount</label>
              <input
                id="offer-amount"
                value={offerForm.amount}
                onChange={(event) =>
                  setOfferForm((s) => ({ ...s, amount: event.target.value }))
                }
              />
            </div>
            <div>
              <label htmlFor="offer-eta">ETA Seconds</label>
              <input
                id="offer-eta"
                value={offerForm.etaSeconds}
                onChange={(event) =>
                  setOfferForm((s) => ({ ...s, etaSeconds: event.target.value }))
                }
              />
            </div>
          </div>
          <button type="button" onClick={createOffer} disabled={busyAction === 'offer-create'}>
            Create Offer
          </button>
          {offers.map((offer) => (
            <article key={offer.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{offer.id}</strong>
              </p>
              <p>
                {offer.agent_id} - {offer.amount} {offer.currency}
              </p>
              <p>{offer.status}</p>
            </article>
          ))}
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">award panel</h2>
          <PopoverCommandSelect
            id="award-offer"
            label="Offer ID"
            value={awardOfferId}
            onChange={setAwardOfferId}
            options={[
              { value: '', label: '-- select offer --' },
              ...offers
                .filter((offer) => offer.status === 'open')
                .map((offer) => ({
                  value: offer.id,
                  label: `${offer.id} (${offer.agent_id})`,
                })),
            ]}
          />
          <button type="button" onClick={awardOffer} disabled={busyAction === 'offer-award'}>
            Award Selected Offer
          </button>
        </article>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">settlement controls</h2>
          {settlements.length === 0 && <p>No settlements yet.</p>}
          {settlements.map((settlement) => (
            <article key={settlement.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{settlement.id}</strong>
              </p>
              <p>
                {settlement.status} - {settlement.amount} {settlement.currency}
              </p>
              <p>frozen: {String(settlement.frozen)}</p>
              <button
                type="button"
                onClick={() => settleAction(settlement.id, 'pay')}
                disabled={busyAction === `settlement-pay-${settlement.id}`}
              >
                Mark Paid
              </button>
              <button
                type="button"
                onClick={() => settleAction(settlement.id, 'refund')}
                disabled={busyAction === `settlement-refund-${settlement.id}`}
              >
                Refund
              </button>
            </article>
          ))}
        </article>

        <article className="border border-border bg-card p-4">
          <h2 className="text-label">dispute panel</h2>
          <label htmlFor="dispute-settlement">Settlement ID (optional)</label>
          <input
            id="dispute-settlement"
            value={disputeForm.settlementId}
            onChange={(event) =>
              setDisputeForm((s) => ({ ...s, settlementId: event.target.value }))
            }
          />
          <label htmlFor="dispute-code">Reason Code</label>
          <input
            id="dispute-code"
            value={disputeForm.reasonCode}
            onChange={(event) =>
              setDisputeForm((s) => ({ ...s, reasonCode: event.target.value }))
            }
          />
          <label htmlFor="dispute-reason">Reason</label>
          <input
            id="dispute-reason"
            value={disputeForm.reason}
            onChange={(event) =>
              setDisputeForm((s) => ({ ...s, reason: event.target.value }))
            }
          />
          <button type="button" onClick={openDispute} disabled={busyAction === 'dispute-open'}>
            Open Dispute
          </button>
          {disputes.map((dispute) => (
            <article key={dispute.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{dispute.id}</strong>
              </p>
              <p>{dispute.status}</p>
              <p>{dispute.reason}</p>
            </article>
          ))}
        </article>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">operator stream</h2>
          {operators.length === 0 && <p>No operators yet.</p>}
          {operators.slice(0, 10).map((operator) => (
            <article key={operator.id || operator.slug} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{operator.display_name || operator.slug}</strong>
              </p>
              <p>{operator.contact_email || 'no-email'}</p>
              <p>{operator.status || 'unknown'}</p>
            </article>
          ))}
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">repository stream</h2>
          {repos.length === 0 && <p>No repositories yet.</p>}
          {repos.slice(0, 10).map((repo) => (
            <div key={repo.id || repo.repo_full_name}>
              <RepoCard repo={repo} />
              <CommitGraph seed={repo.repo_full_name} />
            </div>
          ))}
        </article>
      </section>
    </PageLayout>
  );
};

export default Marketplace;
