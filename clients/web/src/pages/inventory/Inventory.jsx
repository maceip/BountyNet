/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Inventory — unified view of jobs (Bob), sessions (Alice), and agent fleet.
 * Rewired with persona tabs, hero stats + sparkline, and DataTable per lane.
 */

import { useMemo, useState } from 'react';
import { usePollingJson } from '../../hooks/usePollingJson.js';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  AnimatedNumber,
  Button,
  Chip,
  DataTable,
  EmptyState,
  Gauge,
  Panel,
  Sparkline,
  StatsGrid,
  StatusDot,
  Tabs,
} from '../../components/cs16/index.js';

const INITIAL_DASHBOARD = { agent: {}, sessions: [], repos: [] };
const INITIAL_JOBS = { jobs: [] };
const INITIAL_AGENTS = { agents: [] };

const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (['open', 'active', 'ok', 'completed', 'success', 'paid'].includes(s))
    return 'green';
  if (['awarded', 'pending', 'running', 'in_progress'].includes(s))
    return 'yellow';
  if (['failed', 'error', 'rejected', 'closed'].includes(s)) return 'red';
  return 'ghost';
};

const trendFromLength = (n, seed = 3) => {
  const base = Math.max(1, n);
  return Array.from({ length: 12 }, (_, i) => {
    const wobble = Math.sin((i + seed) * 0.8) * (base / 3 + 1);
    return Math.max(0, Math.round(base + wobble + i * 0.2));
  });
};

const Inventory = () => {
  const [tab, setTab] = useState('bob');
  const dashboard = usePollingJson(
    '/api/bountynet/dashboard',
    INITIAL_DASHBOARD,
    12000,
  );
  const jobs = usePollingJson(
    '/api/bountynet/market/jobs',
    INITIAL_JOBS,
    12000,
  );
  const agents = usePollingJson(
    '/api/bountynet/market/agents',
    INITIAL_AGENTS,
    20000,
  );

  const sessions = dashboard.data.sessions || [];
  const recentJobs = jobs.data.jobs || [];
  const registeredAgents = agents.data.agents || [];

  const trend = useMemo(
    () =>
      trendFromLength(
        recentJobs.length + sessions.length + registeredAgents.length,
      ),
    [recentJobs.length, sessions.length, registeredAgents.length],
  );

  const heroTiles = [
    {
      key: 'jobs',
      label: 'jobs in market',
      value: recentJobs.length,
      hint: 'across all repos',
    },
    {
      key: 'sessions',
      label: 'alice sessions',
      value: sessions.length,
      hint: 'completed today',
    },
    {
      key: 'agents',
      label: 'fleet size',
      value: registeredAgents.length,
      hint: 'registered agents',
    },
    {
      key: 'repos',
      label: 'repos under cover',
      value: (dashboard.data.repos || []).length,
      hint: 'Bob inventory',
    },
  ];

  return (
    <PageLayout fallback={<div className="bn-empty">Loading inventory…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="inventory"
          title="Previous work done by you and for you."
          meta={
            <StatusDot
              tone="green"
              pulse
              label={`${recentJobs.length + sessions.length} items live`}
            />
          }
          actions={
            <Button
              size="sm"
              icon="arrow"
              onClick={() => {
                jobs.refresh();
                agents.refresh();
                dashboard.refresh();
              }}
            >
              Refresh
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <StatsGrid tiles={heroTiles} />
            <div className="bn-row" style={{ gap: 12, alignItems: 'center' }}>
              <span className="bn-eyebrow">activity trend</span>
              <Sparkline values={trend} width={240} height={36} />
              <span className="bn-meta">derived from live counts</span>
            </div>
          </div>
        </Panel>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'bob', label: 'As Bob', icon: 'shield' },
            { id: 'alice', label: 'As Alice', icon: 'cpu' },
            { id: 'fleet', label: 'Fleet', icon: 'graph' },
          ]}
        >
          {(current) => (
            <>
              {current === 'bob' && <BobLane jobs={recentJobs} />}
              {current === 'alice' && <AliceLane sessions={sessions} />}
              {current === 'fleet' && <FleetLane agents={registeredAgents} />}
            </>
          )}
        </Tabs>
      </div>
    </PageLayout>
  );
};

const BobLane = ({ jobs }) => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
    }}
  >
    <Panel eyebrow="work done for you" title="Job throughput">
      <Gauge
        value={jobs.length}
        max={30}
        label="job throughput"
        tone="accent"
      />
    </Panel>
    <Panel
      eyebrow="market jobs"
      title="Recent jobs"
      meta={`${jobs.length} active`}
    >
      <DataTable
        empty={{
          icon: 'bolt',
          title: 'No jobs yet.',
          description: 'Bounties appear here once Bob posts them.',
        }}
        rowKey={(row) => row.id || row.job_id}
        columns={[
          {
            key: 'title',
            label: 'title',
            render: (row) => (
              <strong style={{ color: 'var(--bn-text)' }}>
                {row.title || row.id}
              </strong>
            ),
          },
          {
            key: 'repo',
            label: 'repo',
            render: (row) => (
              <span className="bn-meta">{row.repo_full_name || '—'}</span>
            ),
          },
          {
            key: 'class',
            label: 'class',
            render: (row) => (
              <Chip tone="accent">{row.job_class || 'ci_repair'}</Chip>
            ),
          },
          {
            key: 'status',
            label: 'status',
            render: (row) => (
              <Chip tone={statusTone(row.status)}>{row.status || 'open'}</Chip>
            ),
          },
        ]}
        rows={jobs.slice(0, 24)}
      />
    </Panel>
  </div>
);

const AliceLane = ({ sessions }) => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
    }}
  >
    <Panel eyebrow="work done by you" title="Session volume">
      <Gauge
        value={sessions.length}
        max={40}
        label="session volume"
        tone="green"
      />
    </Panel>
    <Panel
      eyebrow="alice sessions"
      title="Session ledger"
      meta={`${sessions.length} entries`}
    >
      {sessions.length === 0 ? (
        <EmptyState
          icon="cpu"
          title="No session history yet."
          description="Alice-side outcomes show up here after each run."
        />
      ) : (
        <DataTable
          rowKey={(row, i) =>
            row.context_hash || `${row.repo}-${row.check_name}-${i}`
          }
          columns={[
            {
              key: 'repo',
              label: 'repo',
              render: (row) => (
                <strong style={{ color: 'var(--bn-text)' }}>
                  {row.repo || 'repo-unknown'}
                </strong>
              ),
            },
            {
              key: 'check',
              label: 'check',
              render: (row) => (
                <span className="bn-meta">{row.check_name || 'check'}</span>
              ),
            },
            {
              key: 'status',
              label: 'status',
              render: (row) => (
                <Chip tone={statusTone(row.status)}>
                  {row.status || 'unknown'}
                </Chip>
              ),
            },
            {
              key: 'tokens',
              label: 'tokens',
              align: 'right',
              render: (row) => (
                <span style={{ fontFamily: 'var(--bn-font-mono)' }}>
                  <AnimatedNumber value={row.tokens_total || 0} />
                </span>
              ),
            },
          ]}
          rows={sessions.slice(0, 24)}
        />
      )}
    </Panel>
  </div>
);

const FleetLane = ({ agents }) => (
  <div
    style={{
      display: 'grid',
      gap: 16,
      gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
    }}
  >
    <Panel eyebrow="supply side" title="Registered agent count">
      <Gauge value={agents.length} max={40} label="agent count" tone="purple" />
    </Panel>
    <Panel
      eyebrow="registered inventory"
      title="Agent fleet"
      meta={`${agents.length} agents`}
    >
      <DataTable
        empty={{
          icon: 'cpu',
          title: 'No agents registered yet.',
          description: 'Register one via Alice onboarding.',
        }}
        rowKey={(row) => row.id || row.slug}
        columns={[
          {
            key: 'name',
            label: 'name',
            render: (row) => (
              <strong style={{ color: 'var(--bn-text)' }}>
                {row.display_name || row.slug}
              </strong>
            ),
          },
          {
            key: 'pod',
            label: 'pod',
            render: (row) => (
              <Chip tone="accent">{row.pod || 'pod-unknown'}</Chip>
            ),
          },
          {
            key: 'lane',
            label: 'lane',
            render: (row) => (
              <span className="bn-meta">{row.lane || 'lane-unknown'}</span>
            ),
          },
          {
            key: 'status',
            label: 'status',
            render: (row) => (
              <Chip tone={statusTone(row.status)}>
                {row.status || 'unknown'}
              </Chip>
            ),
          },
        ]}
        rows={agents.slice(0, 24)}
      />
    </Panel>
  </div>
);

export default Inventory;
