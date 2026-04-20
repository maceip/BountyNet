/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Marketplace — the heart of the app.
 * Reimagined as a tabbed trading-floor with a persistent context rail.
 */

import { useCallback, useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  AnimatedNumber,
  Button,
  Chip,
  CommitGraph,
  EmptyState,
  Field,
  Icon,
  Input,
  Panel,
  PopoverCommandSelect,
  RepoCard,
  Section,
  Separator,
  Sparkline,
  StatsGrid,
  StatusDot,
  Tabs,
  Terminal,
  Toolbar,
} from '../../components/cs16/index.js';

const PRESETS = [
  { label: 'TypeScript CI repair', value: 'typescript_ci_repair' },
  { label: 'TypeScript security audit', value: 'typescript_security_audit' },
  { label: 'Rust security patch', value: 'rust_security_patch' },
  { label: 'Rust porting', value: 'rust_porting' },
];

const JOB_CLASSES = [
  { label: 'CI repair', value: 'ci_repair' },
  { label: 'Dependency update', value: 'dependency_update' },
  { label: 'Security update', value: 'security_update' },
  { label: 'Porting', value: 'porting' },
];

const RISKS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];

const PODS = [
  { label: 'typescript', value: 'typescript' },
  { label: 'rust', value: 'rust' },
  { label: 'github_actions', value: 'github_actions' },
];

const postJson = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, data: text };
  }
};

const getJson = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

const Marketplace = () => {
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [repos, setRepos] = useState([]);
  const [operators, setOperators] = useState([]);
  const [offers, setOffers] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [seedOutput, setSeedOutput] = useState('');
  const [repoOutput, setRepoOutput] = useState('');
  const [jobOutput, setJobOutput] = useState('');
  const [offerOutput, setOfferOutput] = useState('');
  const [settlementOutput, setSettlementOutput] = useState('');
  const [disputeOutput, setDisputeOutput] = useState('');
  const [busy, setBusy] = useState('');

  const [repoForm, setRepoForm] = useState({
    installationId: '',
    repo: '',
    localPath: '',
    preset: 'typescript_ci_repair',
  });
  const [jobForm, setJobForm] = useState({
    repo: '',
    jobClass: 'ci_repair',
    title: '',
    risk: 'medium',
    pod: 'typescript',
    lane: 'default',
    packageName: '',
    targetVersion: '',
  });
  const [offerForm, setOfferForm] = useState({
    agentId: '',
    amount: '',
    etaSeconds: '600',
    notes: '',
  });
  const [awardOfferId, setAwardOfferId] = useState('');
  const [disputeForm, setDisputeForm] = useState({
    settlementId: '',
    reasonCode: 'quality',
    reason: '',
  });

  const refresh = useCallback(async () => {
    try {
      const [jobList, repoList, opList] = await Promise.all([
        getJson('/api/bountynet/market/jobs'),
        getJson('/api/bountynet/market/repositories'),
        getJson('/api/bountynet/market/operators'),
      ]);
      setJobs(jobList.jobs || jobList || []);
      setRepos(repoList.repositories || repoList || []);
      setOperators(opList.operators || opList || []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedJobId) return;
    let cancel = false;
    (async () => {
      try {
        const [off, set, dis] = await Promise.all([
          getJson(`/api/bountynet/market/jobs/${selectedJobId}/offers`),
          getJson(`/api/bountynet/market/jobs/${selectedJobId}/settlements`),
          getJson(`/api/bountynet/market/jobs/${selectedJobId}/disputes`),
        ]);
        if (cancel) return;
        setOffers(off.offers || off || []);
        setSettlements(set.settlements || set || []);
        setDisputes(dis.disputes || dis || []);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedJobId]);

  const withBusy = async (key, fn) => {
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy('');
    }
  };

  const seed = () =>
    withBusy('seed', async () => {
      const { data } = await postJson('/api/bountynet/market/seed', {});
      setSeedOutput(data);
    });

  const saveRepo = () =>
    withBusy('repo', async () => {
      const { data } = await postJson(
        '/api/bountynet/market/repositories/setup',
        {
          installation_id: Number(repoForm.installationId) || undefined,
          repos: repoForm.repo ? [repoForm.repo] : [],
          local_path: repoForm.localPath,
          owner: 'marketplace',
          budget_priority: ['platform_credits'],
          has_api_key_pool: false,
        },
      );
      setRepoOutput(data);
      refresh();
    });

  const applyPreset = () =>
    withBusy('preset', async () => {
      if (!repoForm.repo) {
        setRepoOutput({ error: 'repo required' });
        return;
      }
      const { data } = await postJson(
        `/api/bountynet/market/repositories/${encodeURIComponent(repoForm.repo)}/apply-preset`,
        { preset: repoForm.preset },
      );
      setRepoOutput(data);
    });

  const createJob = () =>
    withBusy('job', async () => {
      const { data } = await postJson('/api/bountynet/market/jobs', {
        repo_full_name: jobForm.repo,
        job_class: jobForm.jobClass,
        title: jobForm.title,
        risk_level: jobForm.risk,
        metadata: {
          pod: jobForm.pod,
          lane: jobForm.lane,
          required_trust_tier:
            jobForm.risk === 'high' ? 'critical' : 'standard',
          package: jobForm.packageName || undefined,
          target_version: jobForm.targetVersion || undefined,
        },
      });
      setJobOutput(data);
      refresh();
    });

  const autopilot = (jobId) =>
    withBusy(`auto-${jobId}`, async () => {
      const { data } = await postJson(
        `/api/bountynet/market/jobs/${jobId}/autopilot`,
        {},
      );
      setJobOutput(data);
    });

  const createOffer = () =>
    withBusy('offer', async () => {
      if (!selectedJobId) return;
      const { data } = await postJson(
        `/api/bountynet/market/jobs/${selectedJobId}/offers`,
        {
          agent_id: offerForm.agentId,
          amount: Number(offerForm.amount) || 0,
          currency: 'USD',
          eta_seconds: Number(offerForm.etaSeconds) || 600,
          notes: offerForm.notes,
        },
      );
      setOfferOutput(data);
    });

  const award = () =>
    withBusy('award', async () => {
      if (!selectedJobId || !awardOfferId) return;
      const { data } = await postJson(
        `/api/bountynet/market/jobs/${selectedJobId}/award`,
        { offer_id: awardOfferId, awarded_by: 'marketplace-ui' },
      );
      setOfferOutput(data);
    });

  const settlementAction = (id, action) =>
    withBusy(`sa-${id}-${action}`, async () => {
      const { data } = await postJson(
        `/api/bountynet/market/settlements/${id}/${action}`,
        { notes: `${action} via ui` },
      );
      setSettlementOutput(data);
    });

  const openDispute = () =>
    withBusy('dispute', async () => {
      if (!selectedJobId) return;
      const { data } = await postJson(
        `/api/bountynet/market/jobs/${selectedJobId}/disputes`,
        {
          settlement_id: disputeForm.settlementId || undefined,
          reason_code: disputeForm.reasonCode,
          reason: disputeForm.reason,
          opened_by: 'marketplace-ui',
        },
      );
      setDisputeOutput(data);
    });

  const openJobCount = jobs.filter((j) => j.status !== 'closed').length;
  const activeOffers = offers.filter((o) => o.status !== 'withdrawn').length;
  const settlementsCount = settlements.length;
  const disputeRate = jobs.length
    ? Math.round((disputes.length / Math.max(1, jobs.length)) * 100)
    : 0;

  const selectedJob = jobs.find((j) => (j.id || j.job_id) === selectedJobId);

  const jobOptions = jobs.map((job) => ({
    label: `${job.title || job.id} · ${job.status || 'open'}`,
    value: job.id || job.job_id,
    hint: job.repo_full_name,
    icon: 'bolt',
  }));

  return (
    <PageLayout fallback={<div className="bn-empty">Loading market…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="bountynet marketplace"
          title="Trading floor"
          meta={
            <StatusDot
              tone="green"
              pulse
              label={`${operators.length} operators online`}
            />
          }
          actions={
            <Button size="sm" icon="arrow" onClick={refresh}>
              Refresh
            </Button>
          }
        >
          <StatsGrid
            tiles={[
              {
                key: 'jobs',
                label: 'open jobs',
                value: openJobCount,
                hint: `${jobs.length} total`,
              },
              {
                key: 'offers',
                label: 'active offers',
                value: activeOffers,
                hint: selectedJob ? `on ${selectedJob.title}` : 'pick a job',
              },
              {
                key: 'settlements',
                label: 'settlements',
                value: settlementsCount,
                hint: 'this job',
              },
              {
                key: 'disputes',
                label: 'dispute rate',
                value: disputeRate,
                unit: '%',
              },
            ]}
          />
        </Panel>

        <Toolbar>
          <Icon name="bolt" />
          <span className="bn-eyebrow">active job</span>
          <div style={{ flex: 1, maxWidth: 420 }}>
            <PopoverCommandSelect
              id="market-active-job"
              value={selectedJobId}
              onChange={(value) => setSelectedJobId(value)}
              placeholder={jobs.length ? 'select a job…' : 'no jobs yet'}
              options={jobOptions}
            />
          </div>
          {selectedJob ? (
            <>
              <Chip tone="accent">{selectedJob.job_class}</Chip>
              <Chip tone="ghost">{selectedJob.repo_full_name}</Chip>
              <Chip
                tone={
                  selectedJob.status === 'open'
                    ? 'green'
                    : selectedJob.status === 'awarded'
                      ? 'yellow'
                      : 'red'
                }
              >
                {selectedJob.status || 'open'}
              </Chip>
            </>
          ) : (
            <span className="bn-meta">No job selected.</span>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <Button
              size="sm"
              variant="primary"
              icon="bolt"
              disabled={!selectedJob || busy === `auto-${selectedJobId}`}
              onClick={() => autopilot(selectedJobId)}
            >
              Autopilot
            </Button>
          </div>
        </Toolbar>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'jobs', label: 'Jobs', icon: 'bolt' },
            { id: 'repos', label: 'Repos', icon: 'repo' },
            { id: 'deals', label: 'Deals', icon: 'shield' },
            { id: 'supply', label: 'Supply', icon: 'cpu' },
          ]}
        >
          {(current) => (
            <>
              {current === 'jobs' && (
                <JobsTab
                  jobs={jobs}
                  selectedJobId={selectedJobId}
                  onSelect={setSelectedJobId}
                  onAutopilot={autopilot}
                  busy={busy}
                  form={jobForm}
                  setForm={setJobForm}
                  repos={repos}
                  onCreate={createJob}
                  output={jobOutput}
                />
              )}
              {current === 'repos' && (
                <ReposTab
                  repos={repos}
                  form={repoForm}
                  setForm={setRepoForm}
                  onSave={saveRepo}
                  onApplyPreset={applyPreset}
                  output={repoOutput}
                  busy={busy}
                />
              )}
              {current === 'deals' && (
                <DealsTab
                  selectedJob={selectedJob}
                  offers={offers}
                  settlements={settlements}
                  disputes={disputes}
                  operators={operators}
                  offerForm={offerForm}
                  setOfferForm={setOfferForm}
                  awardOfferId={awardOfferId}
                  setAwardOfferId={setAwardOfferId}
                  disputeForm={disputeForm}
                  setDisputeForm={setDisputeForm}
                  onCreateOffer={createOffer}
                  onAward={award}
                  onSettlementAction={settlementAction}
                  onOpenDispute={openDispute}
                  offerOutput={offerOutput}
                  settlementOutput={settlementOutput}
                  disputeOutput={disputeOutput}
                  busy={busy}
                />
              )}
              {current === 'supply' && (
                <SupplyTab
                  operators={operators}
                  onSeed={seed}
                  seedOutput={seedOutput}
                  busy={busy}
                />
              )}
            </>
          )}
        </Tabs>
      </div>
    </PageLayout>
  );
};

const JobsTab = ({
  jobs,
  selectedJobId,
  onSelect,
  onAutopilot,
  busy,
  form,
  setForm,
  repos,
  onCreate,
  output,
}) => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)',
    }}
  >
    <Panel
      eyebrow="bounty board"
      title="Open jobs"
      meta={`${jobs.length} total`}
    >
      {jobs.length === 0 ? (
        <EmptyState
          icon="bolt"
          title="No jobs yet."
          description="Create the first bounty on the right."
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {jobs.map((job) => {
            const id = job.id || job.job_id;
            const active = id === selectedJobId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className="bn-panel"
                style={{
                  padding: 12,
                  display: 'grid',
                  gap: 4,
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: active
                    ? 'var(--bn-inset)'
                    : 'var(--bn-surface-1)',
                  boxShadow: active ? 'inset 3px 0 0 var(--bn-accent)' : 'none',
                }}
              >
                <div
                  className="bn-row"
                  style={{ justifyContent: 'space-between', gap: 8 }}
                >
                  <span
                    style={{
                      color: 'var(--bn-text)',
                      fontFamily: 'var(--bn-font-display)',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {job.title || id}
                  </span>
                  <Chip
                    tone={
                      job.status === 'open'
                        ? 'green'
                        : job.status === 'awarded'
                          ? 'yellow'
                          : 'purple'
                    }
                  >
                    {job.status || 'open'}
                  </Chip>
                </div>
                <div className="bn-row" style={{ gap: 6 }}>
                  <Chip tone="accent">{job.job_class}</Chip>
                  <Chip tone="ghost">{job.repo_full_name}</Chip>
                  {job.risk_level ? (
                    <Chip
                      tone={
                        job.risk_level === 'high'
                          ? 'red'
                          : job.risk_level === 'low'
                            ? 'green'
                            : 'yellow'
                      }
                    >
                      risk: {job.risk_level}
                    </Chip>
                  ) : null}
                </div>
                <div className="bn-row" style={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="bolt"
                    disabled={busy === `auto-${id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAutopilot(id);
                    }}
                  >
                    autopilot
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>

    <Panel eyebrow="new bounty" title="Create job" bodyClassName="bn-stack">
      <Field label="Repo" htmlFor="market-job-repo">
        <PopoverCommandSelect
          id="market-job-repo"
          value={form.repo}
          onChange={(value) => setForm({ ...form, repo: value })}
          placeholder="pick a repo…"
          options={repos.map((r) => ({
            label: r.repo_full_name,
            value: r.repo_full_name,
            icon: 'repo',
          }))}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Class" htmlFor="market-job-class">
          <PopoverCommandSelect
            id="market-job-class"
            value={form.jobClass}
            onChange={(value) => setForm({ ...form, jobClass: value })}
            options={JOB_CLASSES}
          />
        </Field>
        <Field label="Risk" htmlFor="market-job-risk">
          <PopoverCommandSelect
            id="market-job-risk"
            value={form.risk}
            onChange={(value) => setForm({ ...form, risk: value })}
            options={RISKS}
          />
        </Field>
      </div>
      <Field label="Title">
        <Input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Repair failing CI on main"
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Pod">
          <PopoverCommandSelect
            id="market-job-pod"
            value={form.pod}
            onChange={(value) => setForm({ ...form, pod: value })}
            options={PODS}
          />
        </Field>
        <Field label="Lane">
          <Input
            value={form.lane}
            onChange={(event) => setForm({ ...form, lane: event.target.value })}
          />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Package (optional)">
          <Input
            value={form.packageName}
            onChange={(event) =>
              setForm({ ...form, packageName: event.target.value })
            }
          />
        </Field>
        <Field label="Target version">
          <Input
            value={form.targetVersion}
            onChange={(event) =>
              setForm({ ...form, targetVersion: event.target.value })
            }
          />
        </Field>
      </div>
      <Button
        variant="primary"
        icon="plus"
        onClick={onCreate}
        disabled={busy === 'job' || !form.repo || !form.title}
      >
        Create job
      </Button>
      <Terminal title="job response" content={output} />
    </Panel>
  </div>
);

const ReposTab = ({
  repos,
  form,
  setForm,
  onSave,
  onApplyPreset,
  output,
  busy,
}) => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 1.4fr)',
    }}
  >
    <Panel
      eyebrow="connect"
      title="Register repository"
      bodyClassName="bn-stack"
    >
      <Field label="Repo (owner/name)">
        <Input
          value={form.repo}
          onChange={(event) => setForm({ ...form, repo: event.target.value })}
          placeholder="acme/backend"
        />
      </Field>
      <Field label="Installation ID">
        <Input
          value={form.installationId}
          onChange={(event) =>
            setForm({ ...form, installationId: event.target.value })
          }
          placeholder="12345678"
        />
      </Field>
      <Field label="Local path">
        <Input
          value={form.localPath}
          onChange={(event) =>
            setForm({ ...form, localPath: event.target.value })
          }
          placeholder="/code/backend"
        />
      </Field>
      <Field label="Preset">
        <PopoverCommandSelect
          id="market-repo-preset"
          value={form.preset}
          onChange={(value) => setForm({ ...form, preset: value })}
          options={PRESETS}
        />
      </Field>
      <div className="bn-row" style={{ gap: 8 }}>
        <Button
          variant="primary"
          icon="plus"
          disabled={busy === 'repo'}
          onClick={onSave}
        >
          Save repo
        </Button>
        <Button
          icon="bolt"
          disabled={busy === 'preset'}
          onClick={onApplyPreset}
        >
          Apply preset
        </Button>
      </div>
      <Terminal title="repo response" content={output} />
    </Panel>

    <Panel
      eyebrow="supply side"
      title="Repository stream"
      meta={`${repos.length} repos`}
    >
      {repos.length === 0 ? (
        <EmptyState icon="repo" title="No repos registered." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {repos.slice(0, 10).map((repo) => (
            <RepoCard
              key={repo.repo_full_name}
              owner={repo.repo_full_name?.split('/')[0]}
              repo={repo.repo_full_name?.split('/')[1]}
              description={`Installation #${repo.installation_id ?? '—'}`}
              language={repo.language || 'TypeScript'}
              stars={repo.stars ?? 0}
              forks={repo.forks ?? 0}
              visibility={repo.visibility || 'Public'}
              updated={repo.updated_at || 'recently'}
              topics={repo.topics || [repo.status || 'active']}
              extra={
                <Sparkline
                  values={Array.from(
                    { length: 12 },
                    (_, i) =>
                      ((repo.repo_full_name || 'x').charCodeAt(
                        i % (repo.repo_full_name || 'x').length,
                      ) *
                        (i + 3)) %
                      24,
                  )}
                />
              }
            />
          ))}
        </div>
      )}
    </Panel>
  </div>
);

const DealsTab = ({
  selectedJob,
  offers,
  settlements,
  disputes,
  operators,
  offerForm,
  setOfferForm,
  awardOfferId,
  setAwardOfferId,
  disputeForm,
  setDisputeForm,
  onCreateOffer,
  onAward,
  onSettlementAction,
  onOpenDispute,
  offerOutput,
  settlementOutput,
  disputeOutput,
  busy,
}) => {
  if (!selectedJob) {
    return (
      <EmptyState
        icon="shield"
        title="Pick a job to manage its deals."
        description="Use the selector in the context rail above."
      />
    );
  }
  const offerOptions = offers.map((offer) => ({
    label: `${offer.agent_id || offer.id} · $${offer.amount} · ${offer.status || 'open'}`,
    value: offer.id,
    icon: 'cpu',
  }));
  const agentOptions = operators.flatMap((op) =>
    (op.agents || []).map((agent) => ({
      label: `${agent.slug} (${op.slug})`,
      value: agent.id || agent.slug,
      icon: 'cpu',
    })),
  );
  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      }}
    >
      <Panel eyebrow="offers" title="Offer board" bodyClassName="bn-stack">
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <Field label="Agent">
            <PopoverCommandSelect
              id="market-offer-agent"
              value={offerForm.agentId}
              onChange={(value) =>
                setOfferForm({ ...offerForm, agentId: value })
              }
              placeholder="pick agent…"
              options={
                agentOptions.length
                  ? agentOptions
                  : [{ label: 'seed a fleet first', value: '', icon: 'cpu' }]
              }
            />
          </Field>
          <Field label="Amount (USD)">
            <Input
              value={offerForm.amount}
              onChange={(event) =>
                setOfferForm({ ...offerForm, amount: event.target.value })
              }
              placeholder="250"
            />
          </Field>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}
        >
          <Field label="ETA (seconds)">
            <Input
              value={offerForm.etaSeconds}
              onChange={(event) =>
                setOfferForm({ ...offerForm, etaSeconds: event.target.value })
              }
            />
          </Field>
          <Field label="Notes">
            <Input
              value={offerForm.notes}
              onChange={(event) =>
                setOfferForm({ ...offerForm, notes: event.target.value })
              }
            />
          </Field>
        </div>
        <Button
          variant="primary"
          icon="plus"
          disabled={busy === 'offer'}
          onClick={onCreateOffer}
        >
          Submit offer
        </Button>
        <Separator />
        <span className="bn-eyebrow">current offers</span>
        {offers.length === 0 ? (
          <EmptyState icon="shield" title="No offers yet." />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="bn-panel"
                style={{ padding: 10, display: 'grid', gap: 4 }}
              >
                <div
                  className="bn-row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <strong style={{ color: 'var(--bn-text)' }}>
                    {offer.agent_id}
                  </strong>
                  <span className="bn-row" style={{ gap: 6 }}>
                    <Chip tone="accent">
                      <AnimatedNumber value={offer.amount} /> {offer.currency}
                    </Chip>
                    <Chip tone="yellow">ETA {offer.eta_seconds}s</Chip>
                  </span>
                </div>
                {offer.notes ? (
                  <span className="bn-meta">{offer.notes}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <Separator />
        <Field label="Award offer">
          <PopoverCommandSelect
            id="market-award-offer"
            value={awardOfferId}
            onChange={setAwardOfferId}
            options={offerOptions}
            placeholder="pick offer to award…"
          />
        </Field>
        <Button
          variant="primary"
          icon="check"
          disabled={!awardOfferId || busy === 'award'}
          onClick={onAward}
        >
          Award
        </Button>
        <Terminal title="offer / award" content={offerOutput} />
      </Panel>

      <div style={{ display: 'grid', gap: 16 }}>
        <Panel eyebrow="money" title="Settlements">
          {settlements.length === 0 ? (
            <EmptyState icon="bolt" title="No settlements." />
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {settlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="bn-panel"
                  style={{
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <strong style={{ color: 'var(--bn-text)' }}>
                      {settlement.id}
                    </strong>
                    <span className="bn-meta">
                      {settlement.amount} {settlement.currency} ·{' '}
                      {settlement.status}
                      {settlement.frozen ? ' · frozen' : ''}
                    </span>
                  </div>
                  <div className="bn-row" style={{ gap: 6 }}>
                    <Button
                      size="sm"
                      icon="check"
                      disabled={busy === `sa-${settlement.id}-pay`}
                      onClick={() => onSettlementAction(settlement.id, 'pay')}
                    >
                      pay
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon="x"
                      disabled={busy === `sa-${settlement.id}-refund`}
                      onClick={() =>
                        onSettlementAction(settlement.id, 'refund')
                      }
                    >
                      refund
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Terminal title="settlement response" content={settlementOutput} />
        </Panel>

        <Panel eyebrow="conflict" title="Disputes" bodyClassName="bn-stack">
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            <Field label="Settlement id (optional)">
              <Input
                value={disputeForm.settlementId}
                onChange={(event) =>
                  setDisputeForm({
                    ...disputeForm,
                    settlementId: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="Reason code">
              <Input
                value={disputeForm.reasonCode}
                onChange={(event) =>
                  setDisputeForm({
                    ...disputeForm,
                    reasonCode: event.target.value,
                  })
                }
              />
            </Field>
          </div>
          <Field label="Reason">
            <Input
              value={disputeForm.reason}
              onChange={(event) =>
                setDisputeForm({ ...disputeForm, reason: event.target.value })
              }
            />
          </Field>
          <Button
            icon="shield"
            variant="danger"
            disabled={busy === 'dispute'}
            onClick={onOpenDispute}
          >
            Open dispute
          </Button>
          {disputes.length === 0 ? (
            <EmptyState icon="shield" title="No disputes." />
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {disputes.map((dispute) => (
                <div
                  key={dispute.id}
                  className="bn-panel"
                  style={{ padding: 10, display: 'grid', gap: 2 }}
                >
                  <span
                    className="bn-row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <strong style={{ color: 'var(--bn-text)' }}>
                      {dispute.id}
                    </strong>
                    <Chip tone="red">{dispute.status}</Chip>
                  </span>
                  <span className="bn-meta">
                    {dispute.reason_code}: {dispute.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Terminal title="dispute response" content={disputeOutput} />
        </Panel>
      </div>
    </div>
  );
};

const SupplyTab = ({ operators, onSeed, seedOutput, busy }) => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.5fr)',
    }}
  >
    <Panel eyebrow="fleet" title="Seed managed fleet" bodyClassName="bn-stack">
      <p className="bn-body">
        Spin up the default operator roster with managed agents covering
        TypeScript, Rust, and GitHub Actions lanes.
      </p>
      <Button
        variant="primary"
        icon="bolt"
        disabled={busy === 'seed'}
        onClick={onSeed}
      >
        Seed managed fleet
      </Button>
      <Terminal title="seed output" content={seedOutput} />
    </Panel>

    <Panel
      eyebrow="humans + agents"
      title="Operator stream"
      meta={`${operators.length} operators`}
    >
      {operators.length === 0 ? (
        <EmptyState
          icon="cpu"
          title="No operators yet."
          description="Seed a fleet to populate."
        />
      ) : (
        <Section>
          <div
            style={{
              display: 'grid',
              gap: 8,
              gridTemplateColumns:
                'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
            }}
          >
            {operators.slice(0, 12).map((operator) => (
              <div
                key={operator.id || operator.slug}
                className="bn-panel"
                style={{ padding: 12, display: 'grid', gap: 6 }}
              >
                <div
                  className="bn-row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <strong style={{ color: 'var(--bn-text)' }}>
                    {operator.display_name || operator.slug}
                  </strong>
                  <StatusDot
                    tone={operator.status === 'active' ? 'green' : 'yellow'}
                    pulse={operator.status === 'active'}
                  />
                </div>
                <span className="bn-meta">{operator.contact_email}</span>
                <div className="bn-row" style={{ gap: 6 }}>
                  {(operator.agents || []).slice(0, 3).map((agent) => (
                    <Chip key={agent.id || agent.slug} tone="accent">
                      {agent.slug}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </Panel>
  </div>
);

export default Marketplace;
