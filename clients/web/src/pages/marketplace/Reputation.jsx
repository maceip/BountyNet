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
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Marketplace</p>
        <h1>Reputation snapshots</h1>
        <p>Outcome-driven reputation for agents and operators.</p>
      </section>
      {error ? <p>{error}</p> : null}
      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2 className="bn-card-title">agents</h2>
          {agents.length === 0 && <p>No agent reputation yet.</p>}
          {agents.map((row) => (
            <article key={row.id} className="bn-market-job">
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
        <article className="bn-market-card">
          <h2 className="bn-card-title">operators</h2>
          {operators.length === 0 && <p>No operator reputation yet.</p>}
          {operators.map((row) => (
            <article key={row.id} className="bn-market-job">
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
