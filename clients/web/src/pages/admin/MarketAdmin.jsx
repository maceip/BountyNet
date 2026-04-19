import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';

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
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Unified Control Plane</p>
        <h1>Infrastructure, orchestration, logging, and marketplace admin</h1>
        <p>Same app and route surface as marketplace. No split dashboard.</p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Serving topology</h2>
          <pre>{JSON.stringify(topology || {}, null, 2)}</pre>
        </article>
        <article className="bn-market-card">
          <h2>Infra drift</h2>
          <button type="button" onClick={runDrift}>
            Run drift scan
          </button>
          <pre>{JSON.stringify(drift || {}, null, 2)}</pre>
        </article>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2>Runbook + orchestration SLOs</h2>
          <pre>{JSON.stringify(runbook || {}, null, 2)}</pre>
        </article>
        <article className="bn-market-card">
          <h2>Market incidents/actions</h2>
          {incidents.length === 0 && <p>No incidents yet.</p>}
          {incidents.map((incident) => (
            <article key={incident.id} className="bn-market-job">
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

      <section className="bn-market-card">
        <h2>Settlement freeze controls</h2>
        <label htmlFor="settlement-id">Settlement ID</label>
        <input
          id="settlement-id"
          value={freezeForm.settlementId}
          onChange={(event) => setFreezeForm((s) => ({ ...s, settlementId: event.target.value }))}
        />
        <label htmlFor="settlement-action">Action</label>
        <select
          id="settlement-action"
          value={freezeForm.action}
          onChange={(event) => setFreezeForm((s) => ({ ...s, action: event.target.value }))}
        >
          <option value="freeze">freeze</option>
          <option value="unfreeze">unfreeze</option>
        </select>
        <button type="button" onClick={freezeOrUnfreeze}>
          Apply
        </button>
        <pre>{output || 'idle'}</pre>
      </section>
    </PageLayout>
  );
};

export default MarketAdmin;
