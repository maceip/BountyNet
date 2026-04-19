import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import {
  CodeLine,
  Pane,
  PaneGroup,
  PopoverCommandSelect,
  Terminal,
} from '../../components/smui/index.jsx';

const MarketAdmin = () => {
  const [topology, setTopology] = useState(null);
  const [drift, setDrift] = useState(null);
  const [runbook, setRunbook] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [output, setOutput] = useState('');
  const [freezeForm, setFreezeForm] = useState({
    settlementId: '',
    action: 'freeze',
  });

  const loadAll = async () => {
    const [t, d, r, i] = await Promise.all([
      fetch('/api/bountynet/ops/serving/topology', { headers: { accept: 'application/json' } }),
      fetch('/api/bountynet/ops/infra/drift', { headers: { accept: 'application/json' } }),
      fetch('/api/bountynet/ops/observability/runbook', { headers: { accept: 'application/json' } }),
      fetch('/api/bountynet/ops/market/incidents', { headers: { accept: 'application/json' } }),
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
    loadAll().catch((e) => setOutput(e instanceof Error ? e.message : String(e)));
  }, []);

  const runDrift = async () => {
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
  };

  const freezeOrUnfreeze = async () => {
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
      setOutput(payload.error || `settlement control failed (${resp.status})`);
      return;
    }
    setOutput(JSON.stringify(payload, null, 2));
    await loadAll();
  };

  return (
    <PageLayout fallback={<p>Loading control plane...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">unified control plane</p>
        <h1>infrastructure, orchestration, logging, and marketplace admin</h1>
        <p>Same app and route surface as marketplace. No split dashboard.</p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-3 fold:px-6 desktop:px-8">
        <PaneGroup persistKey="admin-topology-drift-runbook">
          <Pane>
            <article className="border border-border bg-card p-4">
              <h2 className="text-label">serving topology</h2>
              <Terminal title="topology" content={topology || {}} />
            </article>
          </Pane>
          <Pane>
            <article className="border border-border bg-card p-4">
              <h2 className="text-label">infra drift</h2>
              <button type="button" onClick={runDrift}>
                run drift scan
              </button>
              <Terminal title="drift report" content={drift || {}} />
            </article>
          </Pane>
          <Pane>
            <article className="border border-border bg-card p-4">
              <h2 className="text-label">runbook + orchestration slos</h2>
              <Terminal title="runbook" content={runbook || {}} />
            </article>
          </Pane>
        </PaneGroup>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">market incidents/actions</h2>
          {incidents.length === 0 && <p>No incidents yet.</p>}
          {incidents.map((incident) => (
            <article key={incident.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{incident.action_type}</strong>
              </p>
              <p>
                {incident.target_type}:{incident.target_id}
              </p>
              <p>{incident.status}</p>
            </article>
          ))}
        </article>
      </section>

      <section className="mx-auto mt-4 w-full max-w-6xl border border-border bg-card p-4">
        <h2 className="text-label">settlement freeze controls</h2>
        <label htmlFor="settlement-id">Settlement ID</label>
        <input
          id="settlement-id"
          value={freezeForm.settlementId}
          onChange={(event) => setFreezeForm((s) => ({ ...s, settlementId: event.target.value }))}
        />
        <PopoverCommandSelect
          id="settlement-action"
          label="Action"
          value={freezeForm.action}
          onChange={(action) => setFreezeForm((s) => ({ ...s, action }))}
          options={[
            { label: 'freeze', value: 'freeze' },
            { label: 'unfreeze', value: 'unfreeze' },
          ]}
        />
        <button type="button" onClick={freezeOrUnfreeze}>
          apply
        </button>
        <CodeLine>{`curl -X POST /api/bountynet/ops/market/settlements/:id/${freezeForm.action}`}</CodeLine>
        <Terminal title="control output" content={output || 'idle'} />
      </section>
    </PageLayout>
  );
};

export default MarketAdmin;
