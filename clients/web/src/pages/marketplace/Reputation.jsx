import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { AnimatedNumber, Sparkline } from '../../components/smui/index.jsx';

const Reputation = () => {
  const [agents, setAgents] = useState([]);
  const [operators, setOperators] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/bountynet/market/reputation/agents', { headers: { accept: 'application/json' } }),
      fetch('/api/bountynet/market/reputation/operators', { headers: { accept: 'application/json' } }),
    ])
      .then(async ([agentResp, operatorResp]) => {
        const agentPayload = await agentResp.json().catch(() => ({}));
        const operatorPayload = await operatorResp.json().catch(() => ({}));
        if (!agentResp.ok) {
          throw new Error(agentPayload.error || `agent reputation failed (${agentResp.status})`);
        }
        if (!operatorResp.ok) {
          throw new Error(
            operatorPayload.error || `operator reputation failed (${operatorResp.status})`,
          );
        }
        setAgents(agentPayload.reputation || []);
        setOperators(operatorPayload.reputation || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <PageLayout fallback={<p>Loading reputation...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">marketplace</p>
        <h1>reputation snapshots</h1>
        <p>Outcome-driven reputation for agents and operators.</p>
      </section>
      {error ? <p>{error}</p> : null}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">agents</h2>
          {agents.length === 0 && <p>No agent reputation yet.</p>}
          {agents.map((row) => (
            <article key={row.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{row.entity_id}</strong>
              </p>
              <p>
                score <AnimatedNumber value={row.score} /> | wins <AnimatedNumber value={row.wins} /> | rejects{' '}
                <AnimatedNumber value={row.rejects} />
              </p>
              <Sparkline values={[row.wins, row.score, row.rejects, row.score + row.wins]} />
            </article>
          ))}
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">operators</h2>
          {operators.length === 0 && <p>No operator reputation yet.</p>}
          {operators.map((row) => (
            <article key={row.id} className="mt-3 border-t border-border pt-3">
              <p>
                <strong>{row.entity_id}</strong>
              </p>
              <p>
                score <AnimatedNumber value={row.score} /> | disputes{' '}
                <AnimatedNumber value={row.disputes_total} /> | refunds{' '}
                <AnimatedNumber value={row.refunds} />
              </p>
              <Sparkline values={[row.disputes_total, row.score, row.refunds, row.score]} />
            </article>
          ))}
        </article>
      </section>
    </PageLayout>
  );
};

export default Reputation;
