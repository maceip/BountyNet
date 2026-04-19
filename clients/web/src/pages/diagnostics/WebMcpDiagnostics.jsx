import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { Terminal } from '../../components/smui/index.jsx';
import { getWebMcpDiagnostics } from '../../webmcp/registerTools.js';

const INITIAL_JOURNEYS = {
  kind: '',
  journeys: {},
};

const WebMcpDiagnostics = () => {
  const [diag, setDiag] = useState(getWebMcpDiagnostics());
  const [journeys, setJourneys] = useState(INITIAL_JOURNEYS);
  const [journeyError, setJourneyError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDiag(getWebMcpDiagnostics());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/bountynet/webmcp/journeys', {
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `journey fetch failed (${response.status})`);
        }
        setJourneys(payload);
      })
      .catch((error) => {
        setJourneyError(error instanceof Error ? error.message : String(error));
      });
  }, []);

  return (
    <PageLayout fallback={<p>Loading diagnostics...</p>}>
      <section className="mx-auto w-full max-w-6xl px-3 py-6 fold:px-6 desktop:px-8">
        <p className="text-label">diagnostics</p>
        <h1>webmcp capability and tool telemetry.</h1>
        <p>
          Confirms browser support, registered tools, last tool call, and journey
          manifest availability for Bob/Alice automation.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 desktop:grid-cols-3 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">runtime status</h2>
          <Terminal
            title="runtime"
            content={{
              webmcpAvailable: diag.webmcpAvailable,
              registered: diag.registered,
              initError: diag.initError,
              toolCount: (diag.registeredTools || []).length,
            }}
          />
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">registered tools</h2>
          {(diag.registeredTools || []).length === 0 && <p>No tools registered.</p>}
          {(diag.registeredTools || []).map((tool) => (
            <p key={tool}>
              <code>{tool}</code>
            </p>
          ))}
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">last tool call</h2>
          <Terminal title="last tool call" content={diag.lastCall || {}} />
        </article>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-4 px-3 fold:grid-cols-2 fold:px-6 desktop:px-8">
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">journey manifest</h2>
          {journeyError ? <p>{journeyError}</p> : null}
          {!journeyError && <Terminal title="manifest" content={journeys} />}
        </article>
        <article className="border border-border bg-card p-4">
          <h2 className="text-label">quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/onboarding/bob">Bob onboarding</Link>
            <Link to="/onboarding/alice">Alice onboarding</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/inventory">Inventory</Link>
            <Link to="/ops/control-plane">Control plane</Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
};

export default WebMcpDiagnostics;
