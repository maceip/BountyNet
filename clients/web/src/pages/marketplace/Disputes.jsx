/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Disputes — pick a job, inspect its dispute queue, resolve with a ruling.
 */

import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  Field,
  Input,
  Panel,
  PopoverCommandSelect,
  StatsGrid,
  StatusDot,
  Terminal,
} from '../../components/cs16/index.js';

const RULINGS = [
  { label: 'refund_buyer', value: 'refund_buyer', icon: 'arrow' },
  { label: 'uphold_agent', value: 'uphold_agent', icon: 'shield' },
  { label: 'split', value: 'split', icon: 'bolt' },
];

const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') return 'green';
  if (s === 'open' || s === 'pending') return 'yellow';
  if (s === 'escalated') return 'red';
  return 'ghost';
};

const Disputes = () => {
  const [jobId, setJobId] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [output, setOutput] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [resolve, setResolve] = useState({
    disputeId: '',
    ruling: 'refund_buyer',
  });

  const load = async (targetJobId) => {
    if (!targetJobId) return;
    const resp = await fetch(
      `/api/bountynet/market/jobs/${encodeURIComponent(targetJobId)}/disputes`,
      { headers: { accept: 'application/json' } },
    );
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok)
      throw new Error(payload.error || `disputes failed (${resp.status})`);
    setDisputes(payload.disputes || []);
  };

  useEffect(() => {
    if (!jobId) return;
    load(jobId).catch((e) =>
      setOutput(e instanceof Error ? e.message : String(e)),
    );
  }, [jobId]);

  const resolveDispute = async () => {
    setBusy(true);
    try {
      const resp = await fetch(
        `/api/bountynet/market/disputes/${encodeURIComponent(resolve.disputeId)}/resolve`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            ruling: resolve.ruling,
            resolved_by: 'admin',
          }),
        },
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setOutput(payload.error || `resolve failed (${resp.status})`);
        return;
      }
      setOutput(JSON.stringify(payload, null, 2));
      await load(jobId);
    } finally {
      setBusy(false);
    }
  };

  const openCount = disputes.filter(
    (d) => String(d.status || '').toLowerCase() === 'open',
  ).length;
  const resolvedCount = disputes.filter(
    (d) => String(d.status || '').toLowerCase() === 'resolved',
  ).length;

  return (
    <PageLayout fallback={<div className="bn-empty">Loading disputes…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="marketplace"
          title="Dispute resolution"
          meta={
            <StatusDot
              tone={openCount > 0 ? 'yellow' : 'green'}
              pulse={openCount > 0}
              label={jobId ? `job ${jobId}` : 'no job selected'}
            />
          }
          actions={
            <Button
              size="sm"
              icon="arrow"
              onClick={() =>
                jobId && load(jobId).catch((e) => setOutput(String(e)))
              }
            >
              Reload
            </Button>
          }
        >
          <StatsGrid
            tiles={[
              {
                key: 'total',
                label: 'disputes found',
                value: disputes.length,
                hint: jobId ? `on ${jobId}` : '—',
              },
              {
                key: 'open',
                label: 'open',
                value: openCount,
                hint: 'awaiting ruling',
              },
              { key: 'resolved', label: 'resolved', value: resolvedCount },
              {
                key: 'selected',
                label: 'target dispute',
                value: resolve.disputeId ? 1 : 0,
                hint: resolve.disputeId || 'none picked',
              },
            ]}
          />
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          }}
        >
          <Panel
            eyebrow="queue"
            title="Job disputes"
            meta={jobId ? `job ${jobId}` : 'pick a job'}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Job ID" htmlFor="dispute-job-id">
                <Input
                  id="dispute-job-id"
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  placeholder="job-abc123"
                />
              </Field>
              {!jobId ? (
                <EmptyState
                  icon="search"
                  title="Enter a job id to inspect its disputes."
                />
              ) : (
                <DataTable
                  empty={{ icon: 'shield', title: 'No disputes for this job.' }}
                  rowKey={(row) => row.id}
                  onRowClick={(row) =>
                    setResolve((s) => ({ ...s, disputeId: row.id }))
                  }
                  columns={[
                    {
                      key: 'id',
                      label: 'id',
                      render: (row) => (
                        <strong style={{ color: 'var(--bn-text)' }}>
                          {row.id}
                        </strong>
                      ),
                    },
                    {
                      key: 'status',
                      label: 'status',
                      render: (row) => (
                        <Chip tone={statusTone(row.status)}>
                          {row.status || 'open'}
                        </Chip>
                      ),
                    },
                    {
                      key: 'reason',
                      label: 'reason',
                      render: (row) => (
                        <span className="bn-meta">
                          {row.reason_code || '—'}
                        </span>
                      ),
                    },
                  ]}
                  rows={disputes}
                />
              )}
            </div>
          </Panel>

          <Panel eyebrow="ruling" title="Resolve dispute">
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Dispute ID" htmlFor="resolve-dispute-id">
                <Input
                  id="resolve-dispute-id"
                  value={resolve.disputeId}
                  onChange={(event) =>
                    setResolve((s) => ({ ...s, disputeId: event.target.value }))
                  }
                  placeholder="disp-…"
                />
              </Field>
              <Field label="Ruling">
                <PopoverCommandSelect
                  id="resolve-ruling"
                  value={resolve.ruling}
                  onChange={(ruling) => setResolve((s) => ({ ...s, ruling }))}
                  options={RULINGS}
                />
              </Field>
              <Button
                variant="primary"
                icon="check"
                disabled={!resolve.disputeId || busy}
                onClick={resolveDispute}
              >
                Resolve
              </Button>
              <Terminal title="dispute output" content={output} />
            </div>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
};

export default Disputes;
