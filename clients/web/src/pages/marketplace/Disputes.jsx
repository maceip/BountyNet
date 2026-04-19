import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { PopoverCommandSelect, Terminal } from '../../components/smui/index.jsx';

const Disputes = () => {
  const [jobId, setJobId] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [output, setOutput] = useState('idle');
  const [resolve, setResolve] = useState({
    disputeId: '',
    ruling: 'refund_buyer',
  });

  const load = async (targetJobId) => {
    if (!targetJobId) return;
    const resp = await fetch(`/api/bountynet/market/jobs/${encodeURIComponent(targetJobId)}/disputes`, {
      headers: { accept: 'application/json' },
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(payload.error || `disputes failed (${resp.status})`);
    }
    setDisputes(payload.disputes || []);
  };

  useEffect(() => {
    if (!jobId) return;
    load(jobId).catch((e) => setOutput(e instanceof Error ? e.message : String(e)));
  }, [jobId]);

  const resolveDispute = async () => {
    const resp = await fetch(
      `/api/bountynet/market/disputes/${encodeURIComponent(resolve.disputeId)}/resolve`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ ruling: resolve.ruling, resolved_by: 'admin' }),
      },
    );
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setOutput(payload.error || `resolve failed (${resp.status})`);
      return;
    }
    setOutput(JSON.stringify(payload, null, 2));
    await load(jobId);
  };

  return (
    <PageLayout fallback={<p>Loading disputes...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">marketplace</p>
        <h1>dispute resolution</h1>
      </section>
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <label htmlFor="dispute-job-id">Job ID</label>
          <input
            id="dispute-job-id"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
          />
          {disputes.map((item) => (
            <article key={item.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{item.id}</strong>
              </p>
              <p>
                {item.status} - {item.reason_code}
              </p>
            </article>
          ))}
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">resolve dispute</h2>
          <label htmlFor="resolve-dispute-id">Dispute ID</label>
          <input
            id="resolve-dispute-id"
            value={resolve.disputeId}
            onChange={(event) => setResolve((s) => ({ ...s, disputeId: event.target.value }))}
          />
          <PopoverCommandSelect
            id="resolve-ruling"
            label="Ruling"
            value={resolve.ruling}
            onChange={(ruling) => setResolve((s) => ({ ...s, ruling }))}
            options={[
              { value: 'refund_buyer', label: 'refund_buyer' },
              { value: 'uphold_agent', label: 'uphold_agent' },
              { value: 'split', label: 'split' },
            ]}
          />
          <button type="button" onClick={resolveDispute}>
            resolve
          </button>
          <Terminal title="dispute output" content={output} />
        </article>
      </section>
    </PageLayout>
  );
};

export default Disputes;
