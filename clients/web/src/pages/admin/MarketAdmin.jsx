/**
 * Copyright IBM Corp. 2025, 2026
 *
 * Control plane — unified ops surface (topology, drift, runbook, incidents)
 * plus settlement freeze controls.
 */

import { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  Button,
  Chip,
  CodeLine,
  DataTable,
  EmptyState,
  Field,
  Input,
  Panel,
  PopoverCommandSelect,
  StatusDot,
  Terminal,
  Toolbar,
} from '../../components/cs16/index.js';

const ACTIONS = [
  { value: 'freeze', label: 'freeze', icon: 'shield' },
  { value: 'unfreeze', label: 'unfreeze', icon: 'bolt' },
];

const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'ok' || s === 'healthy' || s === 'green') return 'green';
  if (s === 'warn' || s === 'warning' || s === 'yellow') return 'yellow';
  if (s === 'fail' || s === 'critical' || s === 'red' || s === 'failed')
    return 'red';
  return 'ghost';
};

const MarketAdmin = () => {
  const [topology, setTopology] = useState(null);
  const [drift, setDrift] = useState(null);
  const [runbook, setRunbook] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState('');
  const [freezeForm, setFreezeForm] = useState({
    settlementId: '',
    action: 'freeze',
  });

  const loadAll = async () => {
    const [t, d, r, i] = await Promise.all([
      fetch('/api/bountynet/ops/serving/topology', {
        headers: { accept: 'application/json' },
      }),
      fetch('/api/bountynet/ops/infra/drift', {
        headers: { accept: 'application/json' },
      }),
      fetch('/api/bountynet/ops/observability/runbook', {
        headers: { accept: 'application/json' },
      }),
      fetch('/api/bountynet/ops/market/incidents', {
        headers: { accept: 'application/json' },
      }),
    ]);
    const tPayload = await t.json().catch(() => ({}));
    const dPayload = await d.json().catch(() => ({}));
    const rPayload = await r.json().catch(() => ({}));
    const iPayload = await i.json().catch(() => ({}));
    setTopology(tPayload);
    setDrift(dPayload);
    setRunbook(rPayload);
    setIncidents(iPayload.incidents || []);
  };

  useEffect(() => {
    loadAll().catch((e) =>
      setOutput(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const runDrift = async () => {
    setBusy('drift');
    try {
      const resp = await fetch('/api/bountynet/ops/infra/drift/run', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ trigger: 'web-admin' }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setOutput(payload.error || `drift run failed (${resp.status})`);
        return;
      }
      setOutput(JSON.stringify(payload, null, 2));
      await loadAll();
    } finally {
      setBusy('');
    }
  };

  const freezeOrUnfreeze = async () => {
    if (!freezeForm.settlementId) return;
    setBusy('freeze');
    try {
      const path =
        freezeForm.action === 'freeze'
          ? `/api/bountynet/ops/market/settlements/${encodeURIComponent(freezeForm.settlementId)}/freeze`
          : `/api/bountynet/ops/market/settlements/${encodeURIComponent(freezeForm.settlementId)}/unfreeze`;
      const resp = await fetch(path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ actor: 'admin-ui', notes: 'manual control' }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setOutput(
          payload.error || `settlement control failed (${resp.status})`,
        );
        return;
      }
      setOutput(JSON.stringify(payload, null, 2));
      await loadAll();
    } finally {
      setBusy('');
    }
  };

  const healthStatus = useMemo(
    () => ({
      topology: topology ? topology.status || 'ok' : 'pending',
      drift: drift ? drift.status || (drift.diff ? 'warn' : 'ok') : 'pending',
      runbook: runbook ? runbook.status || 'ok' : 'pending',
      incidents: incidents.length ? 'warn' : 'ok',
    }),
    [topology, drift, runbook, incidents],
  );

  return (
    <PageLayout
      fallback={<div className="bn-empty">Loading control plane…</div>}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          eyebrow="unified control plane"
          title="Infrastructure, orchestration, logging, and marketplace admin"
          actions={
            <Button size="sm" icon="arrow" onClick={loadAll}>
              Refresh
            </Button>
          }
        >
          <Toolbar>
            <StatusDot
              tone={statusTone(healthStatus.topology)}
              pulse
              label={`topology: ${healthStatus.topology}`}
            />
            <StatusDot
              tone={statusTone(healthStatus.drift)}
              pulse={healthStatus.drift !== 'ok'}
              label={`drift: ${healthStatus.drift}`}
            />
            <StatusDot
              tone={statusTone(healthStatus.runbook)}
              label={`runbook: ${healthStatus.runbook}`}
            />
            <StatusDot
              tone={statusTone(healthStatus.incidents)}
              pulse={incidents.length > 0}
              label={`incidents: ${incidents.length}`}
            />
            <span className="bn-meta" style={{ marginLeft: 'auto' }}>
              same surface as marketplace · no split dashboard
            </span>
          </Toolbar>
        </Panel>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          }}
        >
          <Panel eyebrow="serving" title="Topology">
            <Terminal title="topology" content={topology || {}} />
          </Panel>
          <Panel
            eyebrow="infra"
            title="Drift"
            actions={
              <Button
                size="sm"
                icon="bolt"
                variant="primary"
                disabled={busy === 'drift'}
                onClick={runDrift}
              >
                run drift
              </Button>
            }
          >
            <Terminal title="drift report" content={drift || {}} />
          </Panel>
          <Panel eyebrow="observability" title="Runbook + SLOs">
            <Terminal title="runbook" content={runbook || {}} />
          </Panel>
        </div>

        <Panel
          eyebrow="market incidents"
          title="Recent actions"
          meta={`${incidents.length} incidents`}
        >
          {incidents.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No incidents yet."
              description="Marketplace ops actions will land here."
            />
          ) : (
            <DataTable
              rowKey={(row) => row.id}
              columns={[
                {
                  key: 'action',
                  label: 'action',
                  render: (row) => (
                    <strong style={{ color: 'var(--bn-text)' }}>
                      {row.action_type}
                    </strong>
                  ),
                },
                {
                  key: 'target',
                  label: 'target',
                  render: (row) => (
                    <span className="bn-meta">
                      {row.target_type}:{row.target_id}
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
                  key: 'at',
                  label: 'at',
                  render: (row) => (
                    <span className="bn-meta">{row.created_at || '—'}</span>
                  ),
                },
              ]}
              rows={incidents}
            />
          )}
        </Panel>

        <Panel eyebrow="settlement freeze" title="Freeze / unfreeze controls">
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto',
              }}
            >
              <Field label="Settlement ID" htmlFor="settlement-id">
                <Input
                  id="settlement-id"
                  value={freezeForm.settlementId}
                  onChange={(event) =>
                    setFreezeForm((s) => ({
                      ...s,
                      settlementId: event.target.value,
                    }))
                  }
                  placeholder="stl-…"
                />
              </Field>
              <Field label="Action" htmlFor="settlement-action">
                <PopoverCommandSelect
                  id="settlement-action"
                  value={freezeForm.action}
                  onChange={(action) =>
                    setFreezeForm((s) => ({ ...s, action }))
                  }
                  options={ACTIONS}
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  variant="primary"
                  icon="shield"
                  disabled={busy === 'freeze' || !freezeForm.settlementId}
                  onClick={freezeOrUnfreeze}
                >
                  Apply
                </Button>
              </div>
            </div>
            <CodeLine lang="sh" file="hint">
              {`curl -X POST /api/bountynet/ops/market/settlements/${freezeForm.settlementId || ':id'}/${freezeForm.action}`}
            </CodeLine>
            <Terminal title="control output" content={output || 'idle'} />
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
};

export default MarketAdmin;
