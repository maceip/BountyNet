import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';

const Settlement = () => {
  const [settlements, setSettlements] = useState([]);
  const [output, setOutput] = useState('');

  const load = async () => {
    const resp = await fetch('/api/bountynet/market/settlements', {
      headers: { accept: 'application/json' },
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(payload.error || `settlements failed (${resp.status})`);
    }
    setSettlements(payload.settlements || []);
  };

  useEffect(() => {
    load().catch((e) => setOutput(e instanceof Error ? e.message : String(e)));
  }, []);

  const runAction = async (id, action) => {
    const resp = await fetch(`/api/bountynet/market/settlements/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ notes: `manual ${action}` }),
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setOutput(payload.error || `action failed (${resp.status})`);
      return;
    }
    setOutput(JSON.stringify(payload, null, 2));
    await load();
  };

  return (
    <PageLayout fallback={<p>Loading settlements...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Marketplace</p>
        <h1>Settlement lifecycle</h1>
      </section>
      <section className="bn-market-card">
        <h2>All settlements</h2>
        {settlements.length === 0 && <p>No settlements yet.</p>}
        {settlements.map((item) => (
          <article key={item.id} className="bn-market-job">
            <p>
              <strong>{item.id}</strong>
            </p>
            <p>
              {item.status} | {item.amount} {item.currency} | frozen {String(item.frozen)}
            </p>
            <button type="button" onClick={() => runAction(item.id, 'pay')}>
              Pay
            </button>
            <button type="button" onClick={() => runAction(item.id, 'refund')}>
              Refund
            </button>
          </article>
        ))}
        <pre>{output || 'idle'}</pre>
      </section>
    </PageLayout>
  );
};

export default Settlement;
