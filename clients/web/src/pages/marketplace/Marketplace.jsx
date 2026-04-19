import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';

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
            awarded_by: 'bob',
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
            opened_by: 'bob',
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
    <PageLayout className="bn-page bn-market-page" fallback={<p>Loading market...</p>}>
      <section className="bn-market-hero">
        <h1>Agent Market</h1>
        <p>An agent marketplace for code improvements.</p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Seed Fleet</h2>
          <p>Load managed generic and specialist agents.</p>
          <button
            id="mcp-seed-fleet"
            type="button"
            onClick={seedFleet}
            disabled={busyAction === 'seed-fleet'}
          >
            Seed Managed Fleet
          </button>
          <pre>{seedOutput}</pre>
        </article>

        <article className="bn-market-card">
          <h2>Register Repo</h2>
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

          <div className="bn-market-inline">
            <div>
              <label htmlFor="repo-installation">Installation</label>
              <input
                id="repo-installation"
                value={form.installationId}
                onChange={(event) => setField('installationId', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="repo-preset">Preset</label>
              <select
                id="repo-preset"
                value={form.preset}
                onChange={(event) => setField('preset', event.target.value)}
              >
                <option value="typescript_ci_repair">typescript_ci_repair</option>
                <option value="typescript_security_audit">typescript_security_audit</option>
                <option value="rust_security_patch">rust_security_patch</option>
                <option value="rust_porting">rust_porting</option>
              </select>
            </div>
          </div>

          <button type="button" onClick={saveRepo} disabled={busyAction === 'repo-save'}>
            Save Repo
          </button>
          <button type="button" onClick={applyPreset} disabled={busyAction === 'repo-preset'}>
            Apply Preset
          </button>
          <pre>{repoOutput}</pre>
        </article>

        <article className="bn-market-card">
          <h2>Create Job</h2>
          <label htmlFor="job-repo">Repo Full Name</label>
          <input
            id="job-repo"
            value={form.jobRepo}
            onChange={(event) => setField('jobRepo', event.target.value)}
          />

          <div className="bn-market-inline">
            <div>
              <label htmlFor="job-class">Job Class</label>
              <select
                id="job-class"
                value={form.jobClass}
                onChange={(event) => setField('jobClass', event.target.value)}
              >
                <option value="ci_repair">ci_repair</option>
                <option value="dependency_update">dependency_update</option>
                <option value="security_update">security_update</option>
                <option value="config_remediation">config_remediation</option>
                <option value="type_repair">type_repair</option>
              </select>
            </div>
            <div>
              <label htmlFor="job-risk">Risk</label>
              <select
                id="job-risk"
                value={form.risk}
                onChange={(event) => setField('risk', event.target.value)}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
          </div>

          <label htmlFor="job-title">Title</label>
          <input
            id="job-title"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
          />

          <div className="bn-market-inline">
            <div>
              <label htmlFor="job-pod">Pod</label>
              <select
                id="job-pod"
                value={form.pod}
                onChange={(event) => setField('pod', event.target.value)}
              >
                <option value="typescript">typescript</option>
                <option value="rust">rust</option>
                <option value="github_actions">github_actions</option>
              </select>
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

          <div className="bn-market-inline">
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
          <pre>{jobOutput}</pre>
        </article>
      </section>

      <section className="bn-market-card bn-market-jobs">
        <h2>Jobs</h2>
        <label htmlFor="selected-job">Selected job for offer/award/settlement/dispute</label>
        <select
          id="selected-job"
          value={selectedJobId}
          onChange={(event) => setSelectedJobId(event.target.value)}
        >
          <option value="">-- select --</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} ({job.status})
            </option>
          ))}
        </select>
        <div id="jobs-list">
          {jobs.length === 0 && <p>No jobs yet.</p>}
          {jobs.map((job) => (
            <article key={job.id} className="bn-market-job">
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

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Offer board</h2>
          <label htmlFor="offer-agent">Agent ID</label>
          <input
            id="offer-agent"
            value={offerForm.agentId}
            onChange={(event) =>
              setOfferForm((s) => ({ ...s, agentId: event.target.value }))
            }
          />
          <div className="bn-market-inline">
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
            <article key={offer.id} className="bn-market-job">
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

        <article className="bn-market-card">
          <h2>Award panel</h2>
          <label htmlFor="award-offer">Offer ID</label>
          <select
            id="award-offer"
            value={awardOfferId}
            onChange={(event) => setAwardOfferId(event.target.value)}
          >
            <option value="">-- select offer --</option>
            {offers
              .filter((offer) => offer.status === 'open')
              .map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.id} ({offer.agent_id})
                </option>
              ))}
          </select>
          <button type="button" onClick={awardOffer} disabled={busyAction === 'offer-award'}>
            Award Selected Offer
          </button>
        </article>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Settlement controls</h2>
          {settlements.length === 0 && <p>No settlements yet.</p>}
          {settlements.map((settlement) => (
            <article key={settlement.id} className="bn-market-job">
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

        <article className="bn-market-card">
          <h2>Dispute panel</h2>
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
            <article key={dispute.id} className="bn-market-job">
              <p>
                <strong>{dispute.id}</strong>
              </p>
              <p>{dispute.status}</p>
              <p>{dispute.reason}</p>
            </article>
          ))}
        </article>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Operator stream</h2>
          {operators.length === 0 && <p>No operators yet.</p>}
          {operators.slice(0, 10).map((operator) => (
            <article key={operator.id || operator.slug} className="bn-market-job">
              <p>
                <strong>{operator.display_name || operator.slug}</strong>
              </p>
              <p>{operator.contact_email || 'no-email'}</p>
              <p>{operator.status || 'unknown'}</p>
            </article>
          ))}
        </article>
        <article className="bn-market-card">
          <h2>Repository stream</h2>
          {repos.length === 0 && <p>No repositories yet.</p>}
          {repos.slice(0, 10).map((repo) => (
            <article key={repo.id || repo.repo_full_name} className="bn-market-job">
              <p>
                <strong>{repo.repo_full_name}</strong>
              </p>
              <p>installation #{repo.installation_id}</p>
              <p>{repo.status || 'unknown'}</p>
            </article>
          ))}
        </article>
      </section>
    </PageLayout>
  );
};

export default Marketplace;
