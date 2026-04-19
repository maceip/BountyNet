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
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Diagnostics</p>
        <h1>WebMCP capability and tool telemetry.</h1>
        <p>
          Confirms browser support, registered tools, last tool call, and journey
          manifest availability for Bob/Alice automation.
        </p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2 className="bn-card-title">runtime status</h2>
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
        <article className="bn-market-card">
          <h2 className="bn-card-title">registered tools</h2>
          {(diag.registeredTools || []).length === 0 && <p>No tools registered.</p>}
          {(diag.registeredTools || []).map((tool) => (
            <p key={tool}>
              <code>{tool}</code>
            </p>
          ))}
        </article>
        <article className="bn-market-card">
          <h2 className="bn-card-title">last tool call</h2>
          <Terminal title="last tool call" content={diag.lastCall || {}} />
        </article>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2 className="bn-card-title">journey manifest</h2>
          {journeyError ? <p>{journeyError}</p> : null}
          {!journeyError && <Terminal title="manifest" content={journeys} />}
        </article>
        <article className="bn-market-card">
          <h2>Quick actions</h2>
          <div className="bn-cta-row">
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
