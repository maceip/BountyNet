import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { Terminal } from '../../components/smui/index.jsx';

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
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">marketplace</p>
        <h1>settlement lifecycle</h1>
      </section>
      <section className="mx-auto w-full max-w-6xl border border-border bg-card p-4">
        <h2 className="text-label">all settlements</h2>
        {settlements.length === 0 && <p>No settlements yet.</p>}
        {settlements.map((item) => (
          <article key={item.id} className="mt-3 border-t border-border pt-3">
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
        <Terminal title="settlement output" content={output || 'idle'} />
      </section>
    </PageLayout>
  );
};

export default Settlement;
