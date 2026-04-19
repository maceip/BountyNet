import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { CodeLine, Terminal } from '../../components/smui/index.jsx';

const SimulatorConfig = () => {
  const [journeys, setJourneys] = useState({});
  const [output, setOutput] = useState('');

  useEffect(() => {
    fetch('/api/bountynet/webmcp/journeys', { headers: { accept: 'application/json' } })
      .then(async (resp) => {
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(payload.error || `journey load failed (${resp.status})`);
        }
        setJourneys(payload);
      })
      .catch((e) => setOutput(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <PageLayout fallback={<p>Loading simulator config...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Simulator</p>
        <h1>Simulator configuration and eval alignment</h1>
        <p>
          Unified surface for configuring simulator journeys and validating WebMCP coverage.
        </p>
      </section>
      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2 className="bn-card-title">journey manifest</h2>
          <Terminal title="journey manifest" content={journeys} />
        </article>
        <article className="bn-market-card">
          <h2 className="bn-card-title">run commands</h2>
          <CodeLine>npm run dev:full</CodeLine>
          <CodeLine>npm run dev:test:webmcp</CodeLine>
          <CodeLine>npm run dev:test:full</CodeLine>
          <p>Output:</p>
          <Terminal title="simulator output" content={output || 'idle'} />
        </article>
      </section>
    </PageLayout>
  );
};

export default SimulatorConfig;
