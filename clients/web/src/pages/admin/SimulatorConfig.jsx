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
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">simulator</p>
        <h1>simulator configuration and eval alignment</h1>
        <p>
          Unified surface for configuring simulator journeys and validating WebMCP coverage.
        </p>
      </section>
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">journey manifest</h2>
          <Terminal title="journey manifest" content={journeys} />
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">run commands</h2>
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
