import { usePollingJson } from '../../hooks/usePollingJson.js';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { AnimatedNumber, Gauge } from '../../components/smui/index.jsx';

const INITIAL_DASHBOARD = {
  agent: {},
  sessions: [],
  repos: [],
};

const INITIAL_JOBS = {
  jobs: [],
};

const INITIAL_AGENTS = {
  agents: [],
};

const Inventory = () => {
  const dashboard = usePollingJson('/api/bountynet/dashboard', INITIAL_DASHBOARD, 12000);
  const jobs = usePollingJson('/api/bountynet/market/jobs', INITIAL_JOBS, 12000);
  const agents = usePollingJson('/api/bountynet/market/agents', INITIAL_AGENTS, 20000);

  const sessions = dashboard.data.sessions || [];
  const recentJobs = jobs.data.jobs || [];
  const registeredAgents = agents.data.agents || [];

  return (
    <PageLayout fallback={<p>Loading inventory...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">Inventory</p>
        <h1>Previous work done by you and for you.</h1>
        <p>
          Unified view of claimed sessions, market jobs, and registered agents/outcomes.
        </p>
      </section>

      <section className="bn-market-grid">
        <article className="bn-market-card">
          <h2 className="bn-card-title">work done for you (bob)</h2>
          <Gauge value={recentJobs.length} max={30} label="job throughput" />
          {recentJobs.length === 0 && <p>No jobs yet.</p>}
          {recentJobs.slice(0, 12).map((job) => (
            <article key={job.id} className="bn-market-job">
              <p>
                <strong>{job.title}</strong>
              </p>
              <p>{job.repo_full_name}</p>
              <p>
                <span>{job.job_class}</span> <span>{job.status}</span>
              </p>
            </article>
          ))}
        </article>

        <article className="bn-market-card">
          <h2 className="bn-card-title">work done by you (alice)</h2>
          <Gauge value={sessions.length} max={40} label="session volume" />
          {sessions.length === 0 && <p>No session history yet.</p>}
          {sessions.slice(0, 12).map((session) => (
            <article key={session.context_hash || `${session.repo}-${session.check_name}`} className="bn-market-job">
              <p>
                <strong>{session.repo || 'repo-unknown'}</strong>
              </p>
              <p>{session.check_name || 'check'}</p>
              <p>
                <span>{session.status || 'unknown'}</span>{' '}
                <span><AnimatedNumber value={session.tokens_total || 0} /> tokens</span>
              </p>
            </article>
          ))}
        </article>

        <article className="bn-market-card">
          <h2 className="bn-card-title">registered agent inventory</h2>
          <Gauge value={registeredAgents.length} max={40} label="agent count" />
          {registeredAgents.length === 0 && <p>No agents registered yet.</p>}
          {registeredAgents.slice(0, 12).map((agent) => (
            <article key={agent.id || agent.slug} className="bn-market-job">
              <p>
                <strong>{agent.display_name || agent.slug}</strong>
              </p>
              <p>
                <span>{agent.pod || 'pod-unknown'}</span> <span>{agent.lane || 'lane-unknown'}</span>
              </p>
              <p>{agent.status || 'unknown'}</p>
            </article>
          ))}
        </article>
      </section>
    </PageLayout>
  );
};

export default Inventory;
