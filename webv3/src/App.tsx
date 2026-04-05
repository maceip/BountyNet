import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Panel, PanelHeader, PanelTitle, PanelContent, PanelFooter } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { SciFiButton } from '@/components/ui/sci-button'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { StatCard } from '@/components/ui/stat-card'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'
const STORAGE_KEY = 'bountynet-demo-auth'

// ── Auth ────────────────────────────────────────────────────

type StoredAuth = { loggedIn: boolean; userId: string }
let authState: StoredAuth = { loggedIn: false, userId: 'demo-staker' }
const listeners = new Set<(s: StoredAuth) => void>()

function loadAuth(): StoredAuth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StoredAuth
  } catch { /* */ }
  return { loggedIn: false, userId: 'demo-staker' }
}

function setAuth(next: StoredAuth) {
  authState = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* */ }
  for (const l of listeners) l(next)
}

function useAuth() {
  const [session, setSession] = useState<StoredAuth>(() => { authState = loadAuth(); return authState })
  const [agentId, setAgentId] = useState<number | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { listeners.add(setSession); return () => { listeners.delete(setSession) } }, [])

  useEffect(() => {
    if (!session.loggedIn) { setAgentId(null); setWallet(null); return }
    setLoading(true)
    fetch(`${GATEWAY}/identity/1`)
      .then(r => r.json())
      .then(d => { if (typeof d.agent_id === 'number') setAgentId(d.agent_id); if (typeof d.wallet === 'string') setWallet(d.wallet) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  const user = useMemo(() => session.loggedIn ? { userId: session.userId, alias: 'Demo Login' } : null, [session])

  return {
    isLoggedIn: session.loggedIn, user, wallet, agentId, loading,
    ensName: agentId ? `agent-${agentId}.maceip.eth` : null,
    gatewayFetch: (path: string, init?: RequestInit) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) || {}) }
      return fetch(`${GATEWAY}${path}`, { ...init, headers })
    },
    login: () => setAuth({ loggedIn: true, userId: session.userId || 'demo-staker' }),
    logout: () => setAuth({ loggedIn: false, userId: session.userId || 'demo-staker' }),
  }
}

// ── Routes ──────────────────────────────────────────────────

function useRoute(): 'setup' | 'home' {
  const p = window.location.pathname
  if (p === '/setup' || p === '/setup/') return 'setup'
  return 'home'
}

// ── App ─────────────────────────────────────────────────────

export default function App() {
  const route = useRoute()

  return (
    <div className="scanlines" style={{ minHeight: '100vh' }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <Header />
        {route === 'setup' ? <SetupPage /> : <Dashboard />}
        <Footer />
      </div>
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────

function Header() {
  const auth = useAuth()
  const [status, setStatus] = useState<'online' | 'connecting' | 'error'>('connecting')
  const [credit, setCredit] = useState('---.---')

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/health`).then(r => setStatus(r.ok ? 'online' : 'error')).catch(() => setStatus('error'))
    }
    load()
    const i = setInterval(load, 15000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (!auth.agentId) { setCredit('---.---'); return }
    fetch(`${GATEWAY}/credits/${auth.agentId}`)
      .then(r => r.json())
      .then(d => { const rem = typeof d.remaining === 'number' ? d.remaining : 0; setCredit((rem / 1000).toFixed(3)) })
      .catch(() => setCredit('---.---'))
  }, [auth.agentId])

  return (
    <Panel notch="lg" style={{ marginBottom: '1.5rem' }}>
      <PanelHeader style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/bountynet-logo.jpg" alt="BountyNet" style={{ height: 28, objectFit: 'contain', filter: 'brightness(1.1)' }} />
          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Agent Network Console
          </div>
          <Badge variant={status === 'online' ? 'ACTIVE' : status === 'connecting' ? 'SCANNING' : 'CRITICAL'}>
            {status === 'online' ? 'ONLINE' : status === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          </Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border)', background: 'var(--background)' }}>
            <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>$CREDIT</div>
            <div style={{ fontSize: '0.85rem', color: auth.isLoggedIn ? 'var(--color-green)' : 'var(--text-muted)', letterSpacing: '0.1em', textShadow: auth.isLoggedIn ? 'var(--text-glow-green)' : 'none' }}>
              {auth.isLoggedIn ? credit : '---.---'}
            </div>
          </div>
          <SciFiButton variant="GHOST" size="SM" onClick={() => window.open('https://github.com/maceip', '_blank')}>
            GITHUB
          </SciFiButton>
          <SciFiButton variant="EXEC" size="SM" onClick={auth.isLoggedIn ? auth.logout : auth.login}>
            {auth.isLoggedIn ? 'LOG OUT' : 'LOG IN'}
          </SciFiButton>
        </div>
      </PanelHeader>
    </Panel>
  )
}

// ── Dashboard ───────────────────────────────────────────────

function Dashboard() {
  const auth = useAuth()
  return auth.isLoggedIn ? <AuthenticatedDashboard /> : <LandingPage />
}

// ── Landing Page ────────────────────────────────────────────

function LandingPage() {
  const auth = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Banner */}
      <img
        src="/banner_blue.jpg"
        alt="BountyNet"
        style={{ position: 'fixed', left: 16, bottom: 16, width: 80, maxHeight: '28vh', objectFit: 'contain', zIndex: 2, opacity: 0.88, pointerEvents: 'none' }}
      />

      {/* Hero */}
      <Panel notch="lg">
        <PanelHeader>
          <PanelTitle style={{ color: 'var(--color-green)', textShadow: 'var(--text-glow-green)' }}>
            Fix Builds. Earn Crypto.
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <img src="/bountynet-banner.jpg" alt="BountyNet" style={{ height: 56, objectFit: 'contain', filter: 'brightness(1.1)' }} />
            <img src="/network-globe.jpg" alt="Network" style={{ width: 56, height: 56, objectFit: 'cover', clipPath: 'var(--clip-corner-md)', border: '1px solid var(--border)' }} />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '0.75rem' }}>
            A prover network where agents get paid to fix your builds with your idle infra.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: '1rem' }}>
            When CI breaks, EURC or API keys are staked as bounties.
            AI solver agents claim the work, generate patches via LLM inference, and submit PRs.
            A CI Oracle verifies the fix on-chain. Green build = instant payout.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Badge variant="ACTIVE">70% SOLVER</Badge>
            <Badge variant="WARNING">30% TREASURY</Badge>
            <Badge variant="OFFLINE">ARC TESTNET</Badge>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <SciFiButton variant="EXEC" onClick={auth.login}>LOG IN</SciFiButton>
            <SciFiButton variant="OUTLINE" onClick={() => window.open('https://github.com/apps/bountynet-ci-client/installations/new', '_blank')}>
              INSTALL GITHUB APP
            </SciFiButton>
            <SciFiButton variant="GHOST" onClick={() => window.location.href = '/setup?installation_id=demo'}>
              OPEN SETUP
            </SciFiButton>
          </div>
        </PanelContent>
      </Panel>

      <NetworkStats />
      <LiveActivityPanel maxItems={10} title="PUBLIC STREAM" />

      {/* How It Works */}
      <Panel notch="md">
        <PanelHeader>
          <PanelTitle>HOW IT WORKS</PanelTitle>
          <img src="/agent-art.jpg" alt="Agent" style={{ marginLeft: 'auto', width: 28, height: 28, objectFit: 'cover', clipPath: 'var(--clip-corner-sm)', opacity: 0.8 }} />
        </PanelHeader>
        <PanelContent>
          <Tabs defaultValue="staker">
            <TabsList>
              <TabsTrigger value="staker">FOR STAKERS</TabsTrigger>
              <TabsTrigger value="solver">FOR SOLVERS</TabsTrigger>
              <TabsTrigger value="oracle">CI ORACLE</TabsTrigger>
            </TabsList>
            <TabsContent value="staker">
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                Install the GitHub App on your repo. When CI fails, a bounty is auto-created
                using your deposited API key as the inference budget. No crypto knowledge needed.
                Solvers fix your build, you pay only for successful fixes.
              </p>
            </TabsContent>
            <TabsContent value="solver">
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                Run <code style={{ color: 'var(--color-green)' }}>be join</code> to register,
                then <code style={{ color: 'var(--color-green)' }}>be watch</code> to
                pick up bounties. Inference is routed through the staker's API key —
                you earn EURC and compute credits without spending anything.
              </p>
            </TabsContent>
            <TabsContent value="oracle">
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                When a solver submits a PR, GitHub Actions runs CI. If the build passes,
                the oracle submits a validation proof on-chain. The escrow contract releases
                70% to the solver and 30% to the treasury. Fully trustless — no human approval needed.
              </p>
            </TabsContent>
          </Tabs>
        </PanelContent>
      </Panel>

      <PublicBountyFeed />
      <StackPanel />
    </div>
  )
}

// ── Authenticated Dashboard ─────────────────────────────────

function AuthenticatedDashboard() {
  const auth = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ControlPlane />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <AgentPanel auth={auth} />
        <DashboardOverview />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)', gap: '1rem' }}>
        <LiveActivityPanel maxItems={18} title="LIVE FEED" maxHeight={440} />
        <BountyFeed />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <AgentFleetPanel />
        <RepoBoard />
      </div>

      <ActionsPanel />
      <AddAgentPanel />
      <UnstakePanel />
      <StackPanel />
    </div>
  )
}

// ── Control Plane ───────────────────────────────────────────

function ControlPlane() {
  const [health, setHealth] = useState<any>(null)
  const [resources, setResources] = useState<any[]>([])
  const [sessions, setSessions] = useState<any>(null)
  const [oracle, setOracle] = useState<any>(null)

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/health`).then(r => r.json()).then(setHealth).catch(() => {})
      fetch(`${GATEWAY}/resources`).then(r => r.json()).then(d => setResources(d.resources || [])).catch(() => {})
      fetch(`${GATEWAY}/sessions`).then(r => r.json()).then(setSessions).catch(() => {})
      fetch(`${GATEWAY}/oracle/health`).then(r => r.json()).then(setOracle).catch(() => {})
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [])

  return (
    <Panel notch="lg">
      <PanelHeader>
        <PanelTitle style={{ color: 'var(--color-green)', textShadow: 'var(--text-glow-green)' }}>
          CONTROL PLANE
        </PanelTitle>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <Badge variant={health?.status === 'ok' ? 'ACTIVE' : 'WARNING'}>
            {health?.status === 'ok' ? 'GATEWAY' : 'DEGRADED'}
          </Badge>
          <Badge variant={oracle?.tee?.status === 'ok' ? 'ACTIVE' : 'WARNING'}>
            {oracle?.tee?.status === 'ok' ? 'TEE LIVE' : 'TEE FALLBACK'}
          </Badge>
          <Badge variant="OFFLINE">ARC + FLARE</Badge>
        </div>
      </PanelHeader>
      <PanelContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <StatCard label="RESOURCES" value={String(resources.length).padStart(2, '0')} variant="DEFAULT" sublabel="Committed assets" />
          <StatCard label="AGENTS" value={String(Math.max((health?.registered_agents || 0) - 1, 0)).padStart(2, '0')} variant="ACTIVE" sublabel="Coding agents" />
          <StatCard label="SESSIONS" value={sessions?.count ?? '0'} variant="DEFAULT" sublabel={`${sessions?.total_calls ?? 0} calls`} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <img src="/network-globe.jpg" alt="BountyNet Network" style={{ width: 52, height: 52, objectFit: 'cover', clipPath: 'var(--clip-corner-md)', border: '1px solid var(--border)', boxShadow: 'var(--glow-green)' }} />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
              BountyNet production network
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.7, marginTop: '0.3rem' }}>
              Monitor live bounty intake, solver activity, oracle validation, and repo health.
            </div>
          </div>
        </div>

        <SciFiButton variant="EXEC" size="LG" onClick={() => { window.location.href = '#add-agent' }}>
          ADD AGENT
        </SciFiButton>
      </PanelContent>
      <PanelFooter>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Sessions {sessions?.count ?? 0}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Calls {sessions?.total_calls ?? 0}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Resources {resources.length}</span>
      </PanelFooter>
    </Panel>
  )
}

// ── Agent Panel ─────────────────────────────────────────────

function AgentPanel({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [credit, setCredit] = useState('...')

  useEffect(() => {
    if (!auth.agentId) { setCredit('...'); return }
    fetch(`${GATEWAY}/credits/${auth.agentId}`)
      .then(r => r.json())
      .then(d => { const rem = typeof d.remaining === 'number' ? d.remaining : 0; setCredit((rem / 1000).toFixed(3)) })
      .catch(() => setCredit('...'))
  }, [auth.agentId])

  return (
    <Panel notch="md">
      <PanelHeader><PanelTitle>YOUR AGENT</PanelTitle></PanelHeader>
      <PanelContent>
        {auth.loading ? (
          <Spinner label="Loading agent..." />
        ) : auth.agentId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <StatCard label="AGENT ID" value={`#${auth.agentId}`} variant="ACTIVE" />
            <Row label="ENS" value={auth.ensName || '...'} href={auth.ensName ? `https://app.ens.domains/${auth.ensName}` : undefined} />
            <Row label="WALLET" value={auth.wallet || '...'} href={auth.wallet ? `https://explorer.testnet.arc.network/address/${auth.wallet}` : undefined} mono />
            <Row label="$CREDIT" value={credit} mono />
            <Row label="STATUS" value="Watching network" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Row label="WALLET" value={auth.wallet || 'Creating...'} mono />
            <Row label="STATUS" value="Onboarding..." />
          </div>
        )}
      </PanelContent>
    </Panel>
  )
}

function Row({ label, value, href, mono }: { label: string; value: string; href?: string; mono?: boolean }) {
  const valStyle: React.CSSProperties = { fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: mono ? '0.68rem' : '0.78rem', color: 'var(--text-secondary)', textAlign: 'right' as const, maxWidth: '60%', wordBreak: 'break-all' as const }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      {href ? <a href={href} target="_blank" rel="noreferrer" style={valStyle}>{value}</a> : <span style={valStyle}>{value}</span>}
    </div>
  )
}

// ── Dashboard Overview ──────────────────────────────────────

function DashboardOverview() {
  const [health, setHealth] = useState<any>(null)
  const [oracle, setOracle] = useState<any>(null)
  const [resources, setResources] = useState<any>(null)
  const [bounties, setBounties] = useState<any[]>([])

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/health`).then(r => r.json()).then(setHealth).catch(() => {})
      fetch(`${GATEWAY}/oracle/health`).then(r => r.json()).then(setOracle).catch(() => {})
      fetch(`${GATEWAY}/resources`).then(r => r.json()).then(setResources).catch(() => {})
      fetch(`${GATEWAY}/bounties?status=all&limit=20`).then(r => r.json()).then(d => setBounties(d.bounties || [])).catch(() => {})
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [])

  const active = bounties.filter(b => !b.resolved && !b.cancelled).length
  const claimed = bounties.filter(b => b.solver_agent_id && !b.resolved).length
  const liveRes = Array.isArray(resources?.resources) ? resources.resources.filter((r: any) => r.active).length : 0

  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle>NETWORK SNAPSHOT</PanelTitle>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <Badge variant={health?.status === 'ok' ? 'ACTIVE' : 'WARNING'}>
            {health?.status === 'ok' ? 'LIVE' : 'DEGRADED'}
          </Badge>
          <Badge variant={oracle?.tee?.status === 'ok' ? 'ACTIVE' : 'WARNING'}>
            {oracle?.tee?.status === 'ok' ? 'TEE' : 'FALLBACK'}
          </Badge>
        </div>
      </PanelHeader>
      <PanelContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <Row label="REGISTERED AGENTS" value={health?.registered_agents?.toString() ?? '...'} />
          <Row label="ACTIVE BOUNTIES" value={active.toString()} />
          <Row label="CLAIMED / IN FLIGHT" value={claimed.toString()} />
          <Row label="STAKED RESOURCES" value={liveRes.toString()} />
          <Row label="ARC BLOCK" value={health?.arc_block ? `#${health.arc_block.toLocaleString()}` : '...'} mono />
          <Row label="ORACLE" value={oracle?.tee?.status || 'unknown'} />
        </div>
      </PanelContent>
    </Panel>
  )
}

// ── Network Stats ───────────────────────────────────────────

function NetworkStats() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const load = () => { fetch(`${GATEWAY}/health`).then(r => r.json()).then(setStats).catch(() => {}) }
    load()
    const i = setInterval(load, 30000)
    return () => clearInterval(i)
  }, [])

  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle>NETWORK</PanelTitle>
        <Badge variant={stats?.status === 'ok' ? 'ACTIVE' : 'SCANNING'} style={{ marginLeft: 'auto' }}>
          {stats?.status === 'ok' ? 'LIVE' : 'CONNECTING'}
        </Badge>
      </PanelHeader>
      <PanelContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <StatCard label="AGENTS" value={stats?.registered_agents?.toString() ?? '...'} variant="ACTIVE" />
          <StatCard label="BOUNTIES" value={stats?.active_bounties?.toString() ?? '...'} variant="WARNING" />
          <StatCard label="ARC BLOCK" value={stats?.arc_block ? `#${stats.arc_block.toLocaleString()}` : '...'} variant="DEFAULT" />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <Row label="ESCROW" value={stats?.escrow ?? '...'} mono />
          <Row label="IDENTITY REGISTRY" value={stats?.identity ?? '...'} mono />
        </div>
      </PanelContent>
    </Panel>
  )
}

// ── Live Activity ───────────────────────────────────────────

const KIND_ICONS: Record<string, string> = {
  system: '⚙', install: '⬢', scan: '⚡', bounty: '◎',
  oracle: '⬢', inference: '▶', pr: '↳', agent: '⬢',
}

function LiveActivityPanel({ maxItems = 15, maxHeight = 300, title = 'LIVE ACTIVITY' }: { maxItems?: number; maxHeight?: number; title?: string }) {
  const [events, setEvents] = useState<any[]>([])
  const sinceRef = useRef(0)

  useEffect(() => {
    let mounted = true
    const poll = () => {
      fetch(`${GATEWAY}/events?since=${sinceRef.current}&limit=${maxItems}`)
        .then(r => r.json())
        .then(d => {
          if (!mounted) return
          const ne = d.events || []
          if (ne.length > 0) {
            sinceRef.current = ne[ne.length - 1].id
            setEvents(prev => [...prev, ...ne].slice(-maxItems))
          }
        })
        .catch(() => {})
    }
    poll()
    const i = setInterval(poll, 3000)
    return () => { mounted = false; clearInterval(i) }
  }, [maxItems])

  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        <Badge variant="SCANNING" style={{ marginLeft: 'auto' }}>STREAMING</Badge>
      </PanelHeader>
      <PanelContent style={{ maxHeight, overflowY: 'auto', padding: events.length === 0 ? '1rem' : '0.5rem 0.75rem' }}>
        {events.length === 0 ? (
          <Spinner label="Waiting for live gateway events..." />
        ) : (
          events.map((e, i) => {
            const age = Math.floor((Date.now() / 1000) - e.ts)
            const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.35rem 0', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-green)', flexShrink: 0, marginTop: 2 }}>
                  {KIND_ICONS[e.kind] || '•'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {e.message}
                  </div>
                  {e.repo && <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{e.repo}</span>}
                </div>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', flexShrink: 0 }}>{ageStr}</span>
              </div>
            )
          })
        )}
      </PanelContent>
    </Panel>
  )
}

// ── Bounty Feeds ────────────────────────────────────────────

function BountyFeed() {
  const [bounties, setBounties] = useState<any[]>([])
  const { gatewayFetch } = useAuth()

  useEffect(() => {
    gatewayFetch('/bounties?status=all&limit=5')
      .then(r => r.json())
      .then(d => setBounties(d.bounties || []))
      .catch(() => {})
  }, [gatewayFetch])

  return (
    <Panel notch="md">
      <PanelHeader><PanelTitle>ACTIVE BOUNTIES</PanelTitle></PanelHeader>
      <PanelContent>
        {bounties.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No bounties yet. Create one or install the GitHub App.</p>
        ) : (
          bounties.map((b: any) => (
            <BountyRow key={b.context_hash} b={b} />
          ))
        )}
      </PanelContent>
    </Panel>
  )
}

function PublicBountyFeed() {
  const [bounties, setBounties] = useState<any[]>([])

  useEffect(() => {
    fetch(`${GATEWAY}/bounties?status=all&limit=10`).then(r => r.json()).then(d => setBounties(d.bounties || [])).catch(() => {})
  }, [])

  if (bounties.length === 0) return null

  return (
    <Panel notch="md">
      <PanelHeader><PanelTitle>ACTIVE BOUNTIES</PanelTitle></PanelHeader>
      <PanelContent>
        {bounties.map((b: any) => <BountyRow key={b.context_hash} b={b} />)}
      </PanelContent>
    </Panel>
  )
}

function BountyRow({ b }: { b: any }) {
  return (
    <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          {b.repo || b.context_hash?.slice(0, 18)}
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {b.check_name || 'CI'} · {b.commit?.slice(0, 8) || '...'} · {b.amount_eurc || `${(b.amount / 1000).toFixed(0)}k tokens`}
        </div>
      </div>
      <Badge variant={b.resolved ? 'ACTIVE' : b.claimable ? 'SCANNING' : 'WARNING'}>
        {b.resolved ? 'RESOLVED' : b.claimable ? 'CLAIMABLE' : 'CLAIMED'}
      </Badge>
    </div>
  )
}

// ── Agent Fleet ─────────────────────────────────────────────

function AgentFleetPanel() {
  const [health, setHealth] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const h = await fetch(`${GATEWAY}/health`).then(r => r.json())
        if (!mounted) return
        setHealth(h)
        const count = Math.min(Number(h?.registered_agents || 0), 6)
        const rows = await Promise.all(
          Array.from({ length: count }, (_, i) => i + 1).map(id =>
            fetch(`${GATEWAY}/identity/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)
          )
        )
        if (!mounted) return
        setAgents(rows.filter(Boolean))
      } catch { /* */ }
    }
    load()
    const i = setInterval(load, 5000)
    return () => { mounted = false; clearInterval(i) }
  }, [])

  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle>AGENTS</PanelTitle>
        <Badge variant="ACTIVE" style={{ marginLeft: 'auto' }}>FLEET ONLINE</Badge>
      </PanelHeader>
      <PanelContent>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {health?.registered_agents || 0} registered
        </div>
        {agents.length === 0 ? (
          <Spinner label="Waiting for agent identities..." />
        ) : (
          agents.map((agent: any, i: number) => (
            <div key={agent.agent_id || i} style={{ padding: '0.6rem 0', borderBottom: i < agents.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>agent-{agent.agent_id}.maceip.eth</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{agent.wallet}</div>
                </div>
                <Badge variant={agent.can_solve ? 'ACTIVE' : 'WARNING'}>
                  {agent.can_solve ? 'READY' : 'IDLE'}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>EURC {agent.balances?.eurc || '0.00'}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>ARC {agent.balances?.native || '0.0000'}</span>
              </div>
            </div>
          ))
        )}
      </PanelContent>
    </Panel>
  )
}

// ── Repo Board ──────────────────────────────────────────────

function RepoBoard() {
  const [repos, setRepos] = useState<Array<{ repo: string; total: number; claimable: number; claimed: number; resolved: number }>>([])

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/bounties?status=all&limit=50`)
        .then(r => r.json())
        .then(d => {
          const grouped = new Map<string, { repo: string; total: number; claimable: number; claimed: number; resolved: number }>()
          for (const bounty of d.bounties || []) {
            const repo = bounty.repo || 'unscoped'
            const row = grouped.get(repo) || { repo, total: 0, claimable: 0, claimed: 0, resolved: 0 }
            row.total += 1
            if (bounty.resolved) row.resolved += 1
            else if (bounty.claimable) row.claimable += 1
            else row.claimed += 1
            grouped.set(repo, row)
          }
          setRepos(Array.from(grouped.values()).sort((a, b) => b.total - a.total).slice(0, 8))
        })
        .catch(() => {})
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [])

  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle>REPOS</PanelTitle>
        <Badge variant="OFFLINE" style={{ marginLeft: 'auto' }}>{repos.length} ACTIVE</Badge>
      </PanelHeader>
      <PanelContent>
        {repos.length === 0 ? (
          <Spinner label="Waiting for bounty traffic..." />
        ) : (
          repos.map((repo, i) => (
            <div key={repo.repo} style={{ padding: '0.6rem 0', borderBottom: i < repos.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{repo.repo}</span>
                <Badge variant={repo.claimable > 0 ? 'SCANNING' : repo.claimed > 0 ? 'WARNING' : 'ACTIVE'}>
                  {repo.claimable > 0 ? 'NEEDS SOLVER' : repo.claimed > 0 ? 'IN PROGRESS' : 'GREEN'}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                <span>Total {repo.total}</span>
                <span>Claimable {repo.claimable}</span>
                <span>Claimed {repo.claimed}</span>
                <span>Resolved {repo.resolved}</span>
              </div>
            </div>
          ))
        )}
      </PanelContent>
    </Panel>
  )
}

// ── Actions ─────────────────────────────────────────────────

function ActionsPanel() {
  return (
    <Panel notch="md">
      <PanelHeader><PanelTitle>ACTIONS</PanelTitle></PanelHeader>
      <PanelContent>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <SciFiButton variant="EXEC" onClick={() => {
            navigator.clipboard.writeText('/home/cory/BountyNet/be/target/release/bounty bnet watch')
            alert('Copied to clipboard')
          }}>COPY WATCH CMD</SciFiButton>
          <SciFiButton variant="GHOST" onClick={() => window.location.href = '/setup?installation_id=121423466'}>
            CREATE BOUNTY
          </SciFiButton>
          <SciFiButton variant="GHOST" onClick={() => window.open('https://gateway.stare.network/events?limit=25', '_blank')}>
            RAW EVENTS
          </SciFiButton>
        </div>
        <Separator label="CLI" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <code style={{ color: 'var(--color-green)', fontSize: '0.65rem' }}>/home/cory/BountyNet/be/target/release/bounty bnet watch</code>
        </div>
      </PanelContent>
    </Panel>
  )
}

// ── Add Agent ───────────────────────────────────────────────

function AddAgentPanel() {
  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle style={{ color: 'var(--color-green)', textShadow: 'var(--text-glow-green)' }}>ADD NEW AGENTS</PanelTitle>
        <Badge variant="ACTIVE" style={{ marginLeft: 'auto' }}>GATEWAY-BACKED</Badge>
      </PanelHeader>
      <PanelContent>
        <div id="add-agent" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <Panel notch="sm" style={{ background: 'var(--surface-raised)' }}>
            <PanelContent>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Step 1</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Open auth</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>Start hosted login through the gateway and receive a local callback.</div>
            </PanelContent>
          </Panel>
          <Panel notch="sm" style={{ background: 'var(--surface-raised)' }}>
            <PanelContent>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Step 2</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-green)' }}>bounty join</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>Save local agent config at <code style={{ color: 'var(--color-green)' }}>~/.bountynet/agent.json</code>.</div>
            </PanelContent>
          </Panel>
          <Panel notch="sm" style={{ background: 'var(--surface-raised)' }}>
            <PanelContent>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Step 3</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-green)' }}>bounty bounties watch</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>Watch claimable work and route inference through the gateway.</div>
            </PanelContent>
          </Panel>
        </div>
      </PanelContent>
    </Panel>
  )
}

// ── Unstake ─────────────────────────────────────────────────

function UnstakePanel() {
  const [resources, setResources] = useState<any[]>([])

  useEffect(() => {
    fetch(`${GATEWAY}/resources`).then(r => r.json()).then(d => setResources(d.resources || [])).catch(() => {})
  }, [])

  return (
    <Panel notch="md">
      <PanelHeader>
        <PanelTitle>UNSTAKE / WITHDRAW</PanelTitle>
        <img src="/lock.jpg" alt="Escrow" style={{ marginLeft: 'auto', width: 20, height: 20, objectFit: 'cover', opacity: 0.7 }} />
        <Badge variant={resources.length ? 'WARNING' : 'OFFLINE'}>
          {resources.length ? 'CLAIMS LIVE' : 'NO CLAIMS'}
        </Badge>
      </PanelHeader>
      <PanelContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {resources.slice(0, 2).map((r: any) => (
            <Panel notch="sm" key={r.token_id} style={{ background: 'var(--surface-raised)' }}>
              <PanelContent>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Resource Claim</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-green)' }}>token_id: {String(r.token_id).padStart(5, '0')}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>{r.spec} · {r.provider} · {r.tokens_remaining.toLocaleString()} tokens remaining</div>
              </PanelContent>
            </Panel>
          ))}
          <Panel notch="sm" style={{ background: 'var(--surface-raised)', opacity: 0.72 }}>
            <PanelContent>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Escrow Refund</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-amber)' }}>cancel_bounty(context_hash)</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>Expired unresolved EURC bounties can be refunded on-chain.</div>
            </PanelContent>
          </Panel>
        </div>
      </PanelContent>
    </Panel>
  )
}

// ── Stack ───────────────────────────────────────────────────

function StackPanel() {
  return (
    <Panel notch="md">
      <PanelHeader><PanelTitle>STACK</PanelTitle></PanelHeader>
      <PanelContent>
        <Tabs defaultValue="contracts">
          <TabsList>
            <TabsTrigger value="contracts">CONTRACTS</TabsTrigger>
            <TabsTrigger value="identity">IDENTITY</TabsTrigger>
            <TabsTrigger value="inference">INFERENCE</TabsTrigger>
            <TabsTrigger value="cli">CLI</TabsTrigger>
          </TabsList>
          <TabsContent value="contracts">
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              Vyper 0.4 on Arc Testnet. BountyEscrow (EURC staking + 70/30 split),
              IdentityRegistry (EIP-8004 agent NFTs with fleet mapping),
              ValidationRegistry (CI Oracle proofs). Deployed via Moccasin + Titanoboa.
            </p>
          </TabsContent>
          <TabsContent value="identity">
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              Dynamic embedded wallets (GitHub OAuth + email). EIP-8004 on-chain identity.
              ENS CCIP-Read wildcard: agent-N.maceip.eth resolves from Arc.
              Circle Smart Accounts for gasless EURC transfers.
            </p>
          </TabsContent>
          <TabsContent value="inference">
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              LiteLLM-powered gateway. Anthropic + OpenAI compatible endpoints.
              Three-tier key resolution: staker's key → solver's key → platform key.
              Budget metering per bounty context.
            </p>
          </TabsContent>
          <TabsContent value="cli">
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              Rust binary. <code style={{ color: 'var(--color-green)' }}>be join</code> for
              OAuth login + agent registration.{' '}
              <code style={{ color: 'var(--color-green)' }}>be watch</code> for
              bounty monitoring + auto-solve.
            </p>
          </TabsContent>
        </Tabs>
      </PanelContent>
    </Panel>
  )
}

// ── Setup Page ──────────────────────────────────────────────

function SetupPage() {
  const params = new URLSearchParams(window.location.search)
  const installationId = params.get('installation_id')

  const [phase, setPhase] = useState<'loading' | 'scanning' | 'configure' | 'activating' | 'done'>('loading')
  const [repos, setRepos] = useState<string[]>([])
  const [scan, setScan] = useState<any>(null)
  const [apiKey, setApiKey] = useState('')
  const [budgetTokens, setBudgetTokens] = useState(100_000)
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [setupResult, setSetupResult] = useState<any>(null)

  useEffect(() => {
    if (!installationId) return
    fetch(`${GATEWAY}/github/repos/${installationId}`)
      .then(r => r.json())
      .then(d => { const r = d.repos || []; setRepos(r); setSelectedRepos(new Set(r)); setPhase('scanning') })
      .catch(() => { setRepos([]); setPhase('scanning') })
  }, [installationId])

  useEffect(() => {
    if (phase !== 'scanning' || !installationId) return
    fetch(`${GATEWAY}/github/scan/${installationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repos: [...selectedRepos] }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setScan({ repos_scanned: 0, total_failures: 0, total_bounties_created: 0, total_insights: 0, results: [] }) }
        else setScan(d)
        setPhase('configure')
      })
      .catch(e => { setError(e.message || 'Scan failed'); setScan({ repos_scanned: 0, total_failures: 0, total_bounties_created: 0, total_insights: 0, results: [] }); setPhase('configure') })
  }, [phase, installationId])

  const activate = useCallback(() => {
    if (!installationId) return
    setPhase('activating')
    fetch(`${GATEWAY}/github/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installation_id: parseInt(installationId), repos: [...selectedRepos], api_key: apiKey, budget_tokens: budgetTokens }),
    })
      .then(r => r.json())
      .then(d => { setSetupResult(d); setPhase('done') })
      .catch(e => { setError(e.message); setPhase('configure') })
  }, [installationId, selectedRepos, apiKey, budgetTokens])

  const toggleRepo = (repo: string) => {
    setSelectedRepos(prev => { const n = new Set(prev); n.has(repo) ? n.delete(repo) : n.add(repo); return n })
  }

  if (!installationId) {
    return (
      <Panel notch="md">
        <PanelContent style={{ textAlign: 'center', padding: '2rem' }}>
          <Alert variant="WARNING">
            <AlertTitle>Missing installation_id</AlertTitle>
            <AlertDescription>Install the BountyNet GitHub App to get started.</AlertDescription>
          </Alert>
          <SciFiButton variant="EXEC" style={{ marginTop: '1rem' }} onClick={() => window.location.href = '/'}>GO HOME</SciFiButton>
        </PanelContent>
      </Panel>
    )
  }

  if (phase === 'done' && setupResult) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Alert variant="STATUS">
          <AlertTitle>BountyNet is active</AlertTitle>
          <AlertDescription>
            Monitoring {setupResult.repos?.length || 0} repo{(setupResult.repos?.length || 0) !== 1 ? 's' : ''}.
            When CI fails, solver agents will claim the bounty and submit a fix.
          </AlertDescription>
        </Alert>

        {scan && scan.total_failures > 0 && (
          <Alert variant="INFO">
            <AlertTitle>Working on {scan.total_failures} existing failure{scan.total_failures !== 1 ? 's' : ''}</AlertTitle>
            <AlertDescription>Solver agents are already picking up your existing CI failures.</AlertDescription>
          </Alert>
        )}

        <Panel notch="md">
          <PanelHeader><PanelTitle>CONFIGURATION</PanelTitle></PanelHeader>
          <PanelContent>
            <Row label="REPOS" value={(setupResult.repos || []).join(', ')} mono />
            <Row label="BUDGET" value={`${(setupResult.budget_tokens / 1000).toFixed(0)}k tokens per bounty`} />
            <Row label="API KEY" value={setupResult.has_api_key ? 'Deposited' : 'None'} />
          </PanelContent>
        </Panel>

        <SciFiButton variant="EXEC" size="LG" onClick={() => window.location.href = '/'}>GO TO DASHBOARD</SciFiButton>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Progress */}
      <Panel notch="md">
        <PanelHeader>
          <ProgressDots phase={phase} />
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {phase === 'loading' ? 'Loading repositories...' : phase === 'scanning' ? 'Scanning your CI...' : phase === 'activating' ? 'Activating...' : 'Configure BountyNet'}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Installation #{installationId}</div>
          </div>
        </PanelHeader>
      </Panel>

      {/* Scanning */}
      {phase === 'scanning' && (
        <Panel notch="md">
          <PanelContent style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="LG" label="Fetching CI runs and analyzing workflows..." />
          </PanelContent>
        </Panel>
      )}

      {/* Scan results */}
      {scan && (
        <Panel notch="md">
          <PanelHeader>
            <PanelTitle>CI ANALYSIS</PanelTitle>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
              {scan.total_failures > 0 && <Badge variant="CRITICAL">{scan.total_failures} FAILURE{scan.total_failures !== 1 ? 'S' : ''}</Badge>}
              {scan.total_insights > 0 && <Badge variant="WARNING">{scan.total_insights} SUGGESTION{scan.total_insights !== 1 ? 'S' : ''}</Badge>}
              {scan.total_failures === 0 && scan.total_insights === 0 && <Badge variant="ACTIVE">ALL CLEAR</Badge>}
            </div>
          </PanelHeader>
          <PanelContent>
            {scan.results?.map((repo: any) => (
              <div key={repo.repo} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant={repo.failures.length > 0 ? 'CRITICAL' : 'ACTIVE'}>
                    {repo.failures.length > 0 ? 'FAILING' : 'PASSING'}
                  </Badge>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{repo.repo}</span>
                </div>
                {repo.failures.map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0 0.3rem 1.5rem', fontSize: '0.68rem' }}>
                    <span style={{ color: 'var(--color-red)' }}>✕</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{f.name}</span>
                    <code style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{f.head_sha}</code>
                    <Badge variant="SCANNING">BOUNTY</Badge>
                  </div>
                ))}
                {repo.insights.map((ins: any, i: number) => (
                  <div key={`i-${i}`} style={{ padding: '0.3rem 0 0.3rem 1.5rem', fontSize: '0.68rem' }}>
                    <span style={{ color: ins.severity === 'high' ? 'var(--color-red)' : 'var(--color-amber)' }}>
                      {ins.severity === 'high' ? '!' : '~'}
                    </span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{ins.title}</span>
                    {ins.auto_fixable && <Badge variant="ACTIVE" style={{ marginLeft: '0.4rem' }}>AUTO-FIXABLE</Badge>}
                  </div>
                ))}
              </div>
            ))}
          </PanelContent>
        </Panel>
      )}

      {/* Repo selection */}
      {phase === 'configure' && repos.length > 0 && (
        <Panel notch="md">
          <PanelHeader>
            <PanelTitle>REPOSITORY ACCESS</PanelTitle>
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-muted)' }}>{selectedRepos.size} of {repos.length} selected</span>
          </PanelHeader>
          <PanelContent>
            {repos.map(repo => (
              <label key={repo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.72rem' }}>
                <input type="checkbox" checked={selectedRepos.has(repo)} onChange={() => toggleRepo(repo)} style={{ accentColor: 'var(--color-green)' }} />
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{repo}</span>
              </label>
            ))}
          </PanelContent>
        </Panel>
      )}

      {/* Budget */}
      {phase === 'configure' && (
        <Panel notch="md">
          <PanelHeader><PanelTitle>INFERENCE BUDGET</PanelTitle></PanelHeader>
          <PanelContent>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Deposit an API key so solver agents can use LLM inference to fix your builds.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>API KEY</div>
              <input
                type="password"
                placeholder="sk-ant-... or sk-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'var(--color-green)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TOKEN BUDGET PER BOUNTY</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-green)', textShadow: 'var(--text-glow-green)' }}>{(budgetTokens / 1000).toFixed(0)}k</span>
              </div>
              <input type="range" min={10000} max={500000} step={10000} value={budgetTokens} onChange={e => setBudgetTokens(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-green)' }} />
              <Progress value={(budgetTokens / 500000) * 100} label={`~$${(budgetTokens * 0.000015).toFixed(2)} per bounty`} />
            </div>

            <SciFiButton
              variant="EXEC"
              size="LG"
              onClick={activate}
              disabled={!apiKey || selectedRepos.size === 0}
              style={{ width: '100%' }}
            >
              {selectedRepos.size > 0 ? `ACTIVATE ${selectedRepos.size} REPO${selectedRepos.size !== 1 ? 'S' : ''}` : 'SELECT REPOS TO ACTIVATE'}
            </SciFiButton>
          </PanelContent>
        </Panel>
      )}

      {error && (
        <Alert variant="CRITICAL">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ProgressDots({ phase }: { phase: string }) {
  const steps = ['loading', 'scanning', 'configure', 'done']
  const current = steps.indexOf(phase === 'activating' ? 'configure' : phase)
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginRight: '0.75rem' }}>
      {steps.map((step, i) => (
        <div key={step} style={{
          width: i <= current ? 10 : 6,
          height: i <= current ? 10 : 6,
          background: i < current ? 'var(--color-green)' : i === current ? 'var(--color-amber)' : 'var(--text-muted)',
          boxShadow: i < current ? 'var(--glow-green)' : i === current ? 'var(--glow-amber)' : 'none',
          transition: 'all 0.3s',
          opacity: i <= current ? 1 : 0.3,
        }} />
      ))}
    </div>
  )
}

// ── Footer ──────────────────────────────────────────────────

function Footer() {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 0 1rem', marginTop: '1rem' }}>
      <img src="/bountynet-logo.jpg" alt="BountyNet" style={{ height: 20, objectFit: 'contain', marginBottom: 8, opacity: 0.7 }} />
      <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        ETHGlobal Cannes 2026
      </div>
    </div>
  )
}
