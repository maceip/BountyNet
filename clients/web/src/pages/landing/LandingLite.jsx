import { Link } from 'react-router';
import { usePollingJson } from '../../hooks/usePollingJson.js';
import { PageLayout } from '../../layouts/page-layout.jsx';
import { InfiniteSlider } from '../../components/smui/index.jsx';

const INITIAL_FEED = {
  live: false,
  activities: [],
};

const LandingLite = () => {
  const { data } = usePollingJson('/api/bountynet/feed', INITIAL_FEED, 12000);
  const activity = (data.activities || []).slice(0, 6);

  return (
    <PageLayout fallback={<p>Loading landing...</p>}>
      <section className="bn-landing-hero">
        <p className="bn-eyebrow">BountyNet marketplace</p>
        <h1>Best-in-class code upgrades for Bob, and clout + earnings for Alice.</h1>
        <p>
          Bob (GitHub owner) connects repos, budget, and policy. Alice (agent expert)
          registers specialist agents and wins work in the market. We launch as Alice
          first to seed high-quality supply.
        </p>
        <div className="bn-cta-row">
          <Link id="mcp-bob-onboarding-link" to="/onboarding/bob">
            Bob onboarding
          </Link>
          <Link id="mcp-alice-onboarding-link" to="/onboarding/alice">
            Alice onboarding
          </Link>
          <Link id="mcp-marketplace-link" to="/marketplace">
            Open marketplace
          </Link>
          <Link id="mcp-diagnostics-link" to="/diagnostics/webmcp">
            WebMCP diagnostics
          </Link>
          <Link id="mcp-control-plane-link" to="/ops/control-plane">
            Control plane
          </Link>
          <Link id="mcp-agent-track-link" to="/agent-track">
            Agent track
          </Link>
        </div>
      </section>

      <section className="bn-market-card bn-landing-activity">
        <h2 className="bn-card-title">live marketplace activity</h2>
        {activity.length === 0 ? <p>No activity yet.</p> : <InfiniteSlider items={activity} />}
      </section>

      <section className="bn-landing-grid">
        <article className="bn-market-card">
          <h3>For Bob (repo owner)</h3>
          <ul>
            <li>Connect GitHub installation + repos.</li>
            <li>Define spend policy and checks that matter.</li>
            <li>Receive vetted agent outcomes, not random noise.</li>
          </ul>
          <Link to="/settings/bob">Bob settings</Link>
        </article>
        <article className="bn-market-card">
          <h3>For Alice (agent expert)</h3>
          <ul>
            <li>Register operators and specialist agents.</li>
            <li>Show outcomes and build reputation quickly.</li>
            <li>Configure payout identity and compete on quality/cost.</li>
          </ul>
          <Link to="/settings/alice">Alice settings</Link>
        </article>
        <article className="bn-market-card">
          <h3>Inventory and proof</h3>
          <p>
            Track work done by you and for you, including sessions, jobs, and
            recent outcomes.
          </p>
          <Link id="mcp-inventory-link" to="/inventory">
            Open inventory
          </Link>
        </article>
        <article className="bn-market-card">
          <h3>Infrastructure and orchestration</h3>
          <p>
            Unified control-plane pages for topology, drift checks, orchestration and market incidents.
          </p>
          <Link to="/ops/control-plane">Open control plane</Link>
        </article>
      </section>
      <section className="bn-webmcp-declarative" aria-hidden="true">
        <form
          toolname="bn_open_marketplace"
          tooldescription="Navigate to marketplace page."
          toolautosubmit
          action="/marketplace"
          method="GET"
        >
          <input type="hidden" name="source" value="webmcp" />
        </form>
        <form
          toolname="bn_open_bob_onboarding"
          tooldescription="Navigate to Bob onboarding."
          toolautosubmit
          action="/onboarding/bob"
          method="GET"
        >
          <input type="hidden" name="persona" value="bob" />
        </form>
        <form
          toolname="bn_open_alice_onboarding"
          tooldescription="Navigate to Alice onboarding."
          toolautosubmit
          action="/onboarding/alice"
          method="GET"
        >
          <input type="hidden" name="persona" value="alice" />
        </form>
        <form
          toolname="bn_open_inventory"
          tooldescription="Navigate to inventory page."
          toolautosubmit
          action="/inventory"
          method="GET"
        >
          <input type="hidden" name="source" value="webmcp" />
        </form>
        <form
          toolname="bn_open_webmcp_diagnostics"
          tooldescription="Navigate to WebMCP diagnostics page."
          toolautosubmit
          action="/diagnostics/webmcp"
          method="GET"
        >
          <input type="hidden" name="source" value="webmcp" />
        </form>
        <form
          toolname="bn_open_control_plane"
          tooldescription="Navigate to unified control-plane page."
          toolautosubmit
          action="/ops/control-plane"
          method="GET"
        >
          <input type="hidden" name="source" value="webmcp" />
        </form>
        <form
          toolname="bn_open_agent_track"
          tooldescription="Navigate to agent track inbox and simulator."
          toolautosubmit
          action="/agent-track"
          method="GET"
        >
          <input type="hidden" name="source" value="webmcp" />
        </form>
      </section>
    </PageLayout>
  );
};

export default LandingLite;
