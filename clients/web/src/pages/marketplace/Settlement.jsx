/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Settlement — lifecycle dashboard with inline Pay/Refund per row and a
 * terminal tape for the last response.
 */

import { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  Button,
  Chip,
  DataTable,
  EmptyState,
  Panel,
  StatsGrid,
  StatusDot,
  Terminal,
} from '../../components/cs16/index.js';

const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'green';
  if (s === 'pending' || s === 'held') return 'yellow';
  if (s === 'refunded' || s === 'disputed') return 'red';
  if (s === 'frozen') return 'purple';
  return 'ghost';
};

const Settlement = () => {
  const [settlements, setSettlements] = useState([]);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const resp = await fetch('/api/bountynet/market/settlements', {
        headers: { accept: 'application/json' },
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok)
        throw new Error(payload.error || `settlements failed (${resp.status})`);
      setSettlements(payload.settlements || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (id, action) => {
    setBusy(`${id}-${action}`);
    try {
      const resp = await fetch(
        `/api/bountynet/market/settlements/${encodeURIComponent(id)}/${action}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ notes: `manual ${action}` }),
        },
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setOutput(payload.error || `action failed (${resp.status})`);
        return;
      }
      setOutput(JSON.stringify(payload, null, 2));
      await load();
    } finally {
      setBusy('');
    }
  };

  const counts = useMemo(() => {
    const acc = { paid: 0, pending: 0, disputed: 0, frozen: 0 };
    for (const s of settlements) {
      if (s.frozen) acc.frozen += 1;
      const status = String(s.status || '').toLowerCase();
      if (status === 'paid') acc.paid += 1;
      else if (status === 'pending' || status === 'held') acc.pending += 1;
      else if (status === 'disputed' || status === 'refunded')
        acc.disputed += 1;
    }
    return acc;
  }, [settlements]);

  return (
    <PageLayout fallback={<div className="bn-empty">Loading settlements…</div>}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="marketplace"
          title="Settlement lifecycle"
          meta={
            <StatusDot
              tone={error ? 'red' : 'green'}
              pulse={!error}
              label={
                error ? 'request failed' : `${settlements.length} settlements`
              }
            />
          }
          actions={
            <Button size="sm" icon="arrow" onClick={load}>
              Refresh
            </Button>
          }
        >
          <StatsGrid
            tiles={[
              {
                key: 'paid',
                label: 'paid',
                value: counts.paid,
                hint: 'closed out',
              },
              {
                key: 'pending',
                label: 'pending',
                value: counts.pending,
                hint: 'awaiting action',
              },
              {
                key: 'disputed',
                label: 'disputed',
                value: counts.disputed,
                hint: 'needs review',
              },
              {
                key: 'frozen',
                label: 'frozen',
                value: counts.frozen,
                hint: 'ops hold',
              },
            ]}
          />
        </Panel>

        <Panel
          eyebrow="ledger"
          title="All settlements"
          meta={`${settlements.length} rows`}
        >
          {settlements.length === 0 ? (
            <EmptyState
              icon="bolt"
              title="No settlements yet."
              description="New settlements will appear here once jobs are awarded."
            />
          ) : (
            <DataTable
              rowKey={(row) => row.id}
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
                  key: 'amount',
                  label: 'amount',
                  align: 'right',
                  render: (row) => (
                    <span style={{ fontFamily: 'var(--bn-font-mono)' }}>
                      {row.amount} {row.currency || 'USD'}
                    </span>
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
                  key: 'frozen',
                  label: 'frozen',
                  render: (row) =>
                    row.frozen ? (
                      <Chip tone="purple">frozen</Chip>
                    ) : (
                      <span className="bn-meta">—</span>
                    ),
                },
                {
                  key: 'actions',
                  label: 'actions',
                  align: 'right',
                  width: 200,
                  render: (row) => (
                    <div
                      className="bn-row"
                      style={{ gap: 6, justifyContent: 'flex-end' }}
                    >
                      <Button
                        size="sm"
                        icon="check"
                        disabled={busy === `${row.id}-pay`}
                        onClick={() => runAction(row.id, 'pay')}
                      >
                        pay
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon="x"
                        disabled={busy === `${row.id}-refund`}
                        onClick={() => runAction(row.id, 'refund')}
                      >
                        refund
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={settlements}
            />
          )}
        </Panel>

        <Terminal
          title="settlement response"
          content={error ? `error: ${error}` : output || 'idle'}
        />
      </div>
    </PageLayout>
  );
};

export default Settlement;
