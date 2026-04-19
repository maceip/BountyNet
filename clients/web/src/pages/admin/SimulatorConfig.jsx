import { useEffect, useState } from 'react';
import { PageLayout } from '../../layouts/page-layout.jsx';

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
          <h2>Journey manifest</h2>
          <pre>{JSON.stringify(journeys, null, 2)}</pre>
        </article>
        <article className="bn-market-card">
          <h2>Run commands</h2>
          <pre>{`npm run dev:full\nnpm run dev:test:webmcp\nnpm run dev:test:full`}</pre>
          <p>Output:</p>
          <pre>{output || 'idle'}</pre>
        </article>
      </section>
    </PageLayout>
  );
};

export default SimulatorConfig;
