import '@fontsource-variable/raleway'
import { useState, useEffect } from 'react'
import WatercolorCanvas from './scene/WatercolorCanvas'
import { DynamicProvider } from './auth/DynamicProvider'
import { Card, Accordion, Badge, Button, Stat, EventFeed, palette, font, tracking, panel } from './components'
import { useAuth } from './auth/useAuth'
import { Setup } from './pages/Setup'
import { ChatGPTSetup } from './pages/ChatGPTSetup'
import AndroidAuth from './pages/AndroidAuth'
import { LegacySite } from './pages/LegacySite'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

function useRoute(): 'setup' | 'chatgpt-setup' | 'android-auth' | 'home' {
  const path = window.location.pathname
  if (path === '/setup' || path === '/setup/') return 'setup'
  if (path === '/chatgpt-setup' || path === '/chatgpt-setup/') return 'chatgpt-setup'
  if (path === '/android-auth' || path === '/android-auth/') return 'android-auth'
  return 'home'
}

export default function App() {
  const route = useRoute()
  const [legacyMode, setLegacyMode] = useState(false)

  // Legacy mode — the whole page becomes web 1.0
  if (legacyMode) {
    return (
      <>
        <LegacySite onBack={() => setLegacyMode(false)} />
      </>
    )
  }

  return (
    <DynamicProvider>
      <WatercolorCanvas />
      {route === 'android-auth' ? (
        <div style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          padding: '1.25rem',
          maxWidth: 440,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
        >
          <AndroidAuth />
        </div>
      ) : (
        <div style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          padding: '2rem',
          maxWidth: 680,
          margin: '0 auto',
        }}>
          <FiberOverlay />
          <Header />
          {route === 'setup' ? <Setup /> : route === 'chatgpt-setup' ? <ChatGPTSetup /> : <Main />}
          <Footer />
        </div>
      )}
    </DynamicProvider>
  )
}

function FiberOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.6,
      }}
    >
      <svg
        viewBox="0 0 1200 1600"
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="fiberGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,229,255,0)" />
            <stop offset="35%" stopColor="rgba(0,229,255,0.55)" />
            <stop offset="70%" stopColor="rgba(255,64,166,0.5)" />
            <stop offset="100%" stopColor="rgba(255,64,166,0)" />
          </linearGradient>
          <linearGradient id="fiberCore" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="30%" stopColor="rgba(121,255,143,0.28)" />
            <stop offset="65%" stopColor="rgba(0,229,255,0.38)" />
            <stop offset="100%" stopColor="rgba(255,64,166,0.24)" />
          </linearGradient>
          <filter id="fiberBlur">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <path
          d="M180 170 C 260 260, 340 320, 470 340 S 720 360, 860 300 S 1010 210, 1060 140"
          fill="none"
          stroke="url(#fiberGlow)"
          strokeWidth="14"
          filter="url(#fiberBlur)"
        />
        <path
          d="M180 170 C 260 260, 340 320, 470 340 S 720 360, 860 300 S 1010 210, 1060 140"
          fill="none"
          stroke="url(#fiberCore)"
          strokeWidth="2.2"
          strokeDasharray="2 18"
          strokeLinecap="round"
        />

        <path
          d="M130 540 C 260 520, 340 610, 470 640 S 720 700, 910 640 S 1050 550, 1110 600"
          fill="none"
          stroke="url(#fiberGlow)"
          strokeWidth="13"
          filter="url(#fiberBlur)"
        />
        <path
          d="M130 540 C 260 520, 340 610, 470 640 S 720 700, 910 640 S 1050 550, 1110 600"
          fill="none"
          stroke="url(#fiberCore)"
          strokeWidth="2"
          strokeDasharray="2 16"
          strokeLinecap="round"
        />

        <path
          d="M110 1020 C 250 960, 330 1040, 470 1080 S 760 1150, 900 1100 S 1030 1000, 1120 1060"
          fill="none"
          stroke="url(#fiberGlow)"
          strokeWidth="12"
          filter="url(#fiberBlur)"
        />
        <path
          d="M110 1020 C 250 960, 330 1040, 470 1080 S 760 1150, 900 1100 S 1030 1000, 1120 1060"
          fill="none"
          stroke="url(#fiberCore)"
          strokeWidth="1.8"
          strokeDasharray="2 15"
          strokeLinecap="round"
        />

        <circle cx="180" cy="170" r="5" fill="rgba(121,255,143,0.6)" />
        <circle cx="470" cy="340" r="4" fill="rgba(0,229,255,0.55)" />
        <circle cx="860" cy="300" r="4" fill="rgba(255,64,166,0.5)" />
        <circle cx="470" cy="640" r="4" fill="rgba(0,229,255,0.45)" />
        <circle cx="910" cy="640" r="4" fill="rgba(255,64,166,0.45)" />
        <circle cx="470" cy="1080" r="4" fill="rgba(121,255,143,0.45)" />
        <circle cx="900" cy="1100" r="4" fill="rgba(0,229,255,0.45)" />
      </svg>
    </div>
  )
}

function Header() {
  const auth = useAuth()
  const [status, setStatus] = useState<'online' | 'connecting' | 'error'>('connecting')
  const [creditValue, setCreditValue] = useState('---.---')

  useEffect(() => {
    let mounted = true

    const load = () => {
      fetch(`${GATEWAY}/health`)
        .then(r => {
          if (!mounted) return
          setStatus(r.ok ? 'online' : 'error')
        })
        .catch(() => {
          if (!mounted) return
          setStatus('error')
        })
    }

    load()
    const interval = setInterval(load, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!auth.agentId) {
      setCreditValue('---.---')
      return
    }

    fetch(`${GATEWAY}/credits/${auth.agentId}`)
      .then(r => r.json())
      .then(data => {
        const remaining = typeof data.remaining === 'number' ? data.remaining : 0
        setCreditValue((remaining / 1000).toFixed(3))
      })
      .catch(() => setCreditValue('---.---'))
  }, [auth.agentId])

  const ledColor =
    status === 'online' ? '#78ff8f' :
    status === 'connecting' ? '#ffd24d' :
    '#ff6b6b'

  return (
    <header style={{
      ...panel(true),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.9rem 1.4rem',
      borderRadius: 8,
      marginBottom: '1.5rem',
      animation: 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.28rem' }}>
          <img src="/ico-name.jpg" alt="BountyNet" style={{ height: 38, borderRadius: 6 }} />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: ledColor,
              boxShadow: `0 0 10px ${ledColor}`,
              flexShrink: 0,
            }}
          />
        </div>
        <div>
          <h1 style={{
            fontFamily: font.family,
            fontSize: '1rem',
            fontWeight: 700,
            color: palette.accent,
            letterSpacing: tracking.ultra,
            textTransform: 'uppercase',
            margin: 0,
          }}>
            BountyNet
          </h1>
          <div style={{
            fontFamily: font.family,
            fontSize: '0.56rem',
            fontWeight: 600,
            color: palette.textMuted,
            letterSpacing: tracking.wide,
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            Agent Network Console
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div
          style={{
            minWidth: 150,
            padding: '0.48rem 0.75rem',
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: '#0a0f16',
            boxShadow: 'inset 0 0 18px rgba(0,0,0,0.45)',
          }}
        >
          <div
            style={{
              fontFamily: font.family,
              fontSize: '0.5rem',
              fontWeight: 700,
              color: palette.textMuted,
              letterSpacing: tracking.wide,
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            $Credit
          </div>
          <div
            style={{
              fontFamily: font.mono,
              fontSize: '0.95rem',
              color: auth.agentId ? '#b8ff8a' : '#6c7788',
              letterSpacing: '0.14em',
              textShadow: auth.agentId ? '0 0 10px rgba(184,255,138,0.35)' : 'none',
            }}
          >
            {auth.agentId ? creditValue : '---.---'}
          </div>
        </div>
        <Button
          variant="filled"
          size="sm"
          style={{ minWidth: 96, paddingInline: '0.76rem' }}
          onClick={() => window.open('https://github.com/maceip', '_blank', 'noopener,noreferrer')}
        >
          <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>◉</span>
          GitHub
        </Button>
        <Button
          variant="filled"
          size="sm"
          style={{ minWidth: 96, paddingInline: '0.95rem' }}
          onClick={auth.agentId ? auth.logout : auth.login}
        >
          {auth.agentId ? 'Exit Agent' : 'Open Setup'}
        </Button>
      </div>
    </header>
  )
}

function Main() {
  try {
    return <AuthenticatedMain />
  } catch {
    return <LandingPage />
  }
}

function AuthenticatedMain() {
  const auth = useAuth()

  if (!auth.agentId) {
    return <LandingPage />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <ControlPlaneCard />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)',
          gap: '1.25rem',
        }}
      >
        <div className="dashboard-card">
          <Card title="Your Agent">
            {auth.loading ? (
              <Stat label="Status" value="Loading..." />
            ) : auth.agentId ? (
              <>
                <Stat label="Agent ID" value={`#${auth.agentId}`} big accent={palette.accent} />
                <LinkedStat
                  label="ENS"
                  value={auth.ensName || '...'}
                  href={auth.ensName ? `https://app.ens.domains/${auth.ensName}` : undefined}
                />
                <LinkedStat
                  label="Wallet"
                  value={auth.wallet || '...'}
                  href={auth.wallet ? `https://explorer.testnet.arc.network/address/${auth.wallet}` : undefined}
                  mono
                />
                <Stat label="Reputation" value="84.6" />
                <AgentCreditStat agentId={auth.agentId} />
                <Stat label="Status" value="Watching network" />
              </>
            ) : (
              <>
                <Stat label="Wallet" value={auth.wallet || 'Creating...'} mono />
                <Stat label="Status" value="Onboarding..." />
              </>
            )}
          </Card>
        </div>
        <DashboardOverview />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)',
          gap: '1.25rem',
        }}
      >
        <div className="dashboard-card">
          <Card title="Live Activity">
            <SectionToolbar left={['All events', 'Prod gateway', 'Streaming']} right="Tail view" />
            <EventFeed maxItems={18} maxHeight={440} />
          </Card>
        </div>
        <BountyFeed />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <AgentFleetPanel />
        <RepoBoard />
      </div>

      <div className="dashboard-card">
        <Card title="Actions">
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button onClick={() => {
              navigator.clipboard.writeText('/home/cory/BountyNet/be/target/release/bounty bnet watch')
              alert('Copied to clipboard:\n/home/cory/BountyNet/be/target/release/bounty bnet watch')
            }}>Copy Watch Command</Button>
            <a
              href="/setup?installation_id=121423466"
              style={{
                fontFamily: font.family,
                fontSize: '0.72rem',
                color: palette.textSecondary,
                letterSpacing: tracking.normal,
                textDecoration: 'none',
                alignSelf: 'center',
              }}
            >
              Create bounty
            </a>
            <a
              href="https://gateway.stare.network/events?limit=25"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: font.family,
                fontSize: '0.72rem',
                color: palette.textSecondary,
                letterSpacing: tracking.normal,
                textDecoration: 'none',
                alignSelf: 'center',
              }}
            >
              Raw events
            </a>
          </div>
          <div style={{
            fontFamily: font.family,
            fontSize: '0.7rem',
            color: palette.textMuted,
            marginTop: '1rem',
            lineHeight: 1.7,
            letterSpacing: tracking.normal,
          }}>
            CLI: <code style={{
              fontFamily: font.mono,
              fontSize: '0.65rem',
              background: palette.fill,
              color: palette.textOnFill,
              padding: '0.15rem 0.4rem',
              borderRadius: 3,
            }}>/home/cory/BountyNet/be/target/release/bounty bnet watch</code>
          </div>
        </Card>
      </div>

      <AddAgentSection />

      <UnstakeSection />

      <StackSection />
    </div>
  )
}

function RailLink({ label, value, spark }: { label: string; value: string; spark: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.38rem 0.58rem',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: 0.62,
      }}
    >
      <span
        style={{
          fontFamily: font.family,
          fontSize: '0.62rem',
          fontWeight: 700,
          color: '#f0a6cb',
          letterSpacing: tracking.wide,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: '0.65rem',
          color: '#c68ba8',
          letterSpacing: '0.12em',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: '0.62rem',
          color: '#9f768b',
          letterSpacing: '0.04em',
        }}
      >
        {spark}
      </span>
    </div>
  )
}

function LinkedStat({ label, value, href, mono }: { label: string; value: string; href?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.35rem 0' }}>
      <span style={{
        fontFamily: font.family,
        fontSize: '0.7rem',
        fontWeight: 600,
        color: palette.textMuted,
        letterSpacing: tracking.wider,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: mono ? font.mono : font.family,
            fontSize: mono ? '0.68rem' : '0.85rem',
            fontWeight: 500,
            color: palette.textPrimary,
            textAlign: 'right',
            maxWidth: '62%',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </a>
      ) : (
        <span style={{
          fontFamily: mono ? font.mono : font.family,
          fontSize: mono ? '0.68rem' : '0.85rem',
          fontWeight: 500,
          color: palette.textPrimary,
          textAlign: 'right',
          maxWidth: '62%',
          wordBreak: 'break-all',
        }}>
          {value}
        </span>
      )}
    </div>
  )
}

function AgentCreditStat({ agentId }: { agentId: number | null }) {
  const [credit, setCredit] = useState('...')

  useEffect(() => {
    if (!agentId) {
      setCredit('...')
      return
    }

    fetch(`${GATEWAY}/credits/${agentId}`)
      .then(r => r.json())
      .then(data => {
        const remaining = typeof data.remaining === 'number' ? data.remaining : 0
        setCredit((remaining / 1000).toFixed(3))
      })
      .catch(() => setCredit('...'))
  }, [agentId])

  return <Stat label="$Credit" value={credit} mono />
}

function ControlPlaneCard() {
  const [health, setHealth] = useState<any>(null)
  const [resources, setResources] = useState<any[]>([])
  const [sessions, setSessions] = useState<any>(null)
  const [oracle, setOracle] = useState<any>(null)

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/health`).then(r => r.json()).then(setHealth).catch(() => {})
      fetch(`${GATEWAY}/resources`).then(r => r.json()).then(data => setResources(data.resources || [])).catch(() => {})
      fetch(`${GATEWAY}/sessions`).then(r => r.json()).then(setSessions).catch(() => {})
      fetch(`${GATEWAY}/oracle/health`).then(r => r.json()).then(setOracle).catch(() => {})
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard-card">
      <Card title="Control Plane" accent={palette.green}>
        <div
          style={{
            display: 'flex',
            gap: '0.65rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '0.95rem',
            padding: '0.55rem 0.7rem',
            borderRadius: 10,
            background: 'rgba(255, 64, 166, 0.12)',
            border: '1px solid rgba(255, 64, 166, 0.28)',
          }}
        >
          <RailLink label="Committed Assets" value={String(resources.length).padStart(2, '0')} spark={resources.length ? '▁▂▃▂▁' : '▁▁▁▁▁'} />
          <RailLink label="Coding Agents" value={String(Math.max((health?.registered_agents || 0) - 1, 0)).padStart(2, '0')} spark={(sessions?.total_calls || 0) ? '▁▃▅▃▂' : '▁▁▁▁▁'} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: 620 }}>
            <img
              src="/ico-no-name.jpg"
              alt="BountyNet"
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                objectFit: 'contain',
                background: palette.panelLight,
                boxShadow: `0 0 18px ${palette.accentGlow}`,
                padding: 6,
              }}
            />
            <div>
              <div style={{ fontFamily: font.family, fontSize: '1.1rem', fontWeight: 700, color: palette.textPrimary, letterSpacing: tracking.tight }}>
                BountyNet production network
              </div>
              <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.7, marginTop: '0.4rem' }}>
                Monitor live bounty intake, solver activity, oracle validation, and repo health from one surface.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge color={health?.status === 'ok' ? palette.green : palette.orange}>{health?.status === 'ok' ? 'Prod Gateway' : 'Gateway Error'}</Badge>
            <Badge color={oracle?.tee?.status === 'ok' ? palette.accent : palette.orange}>{oracle?.tee?.status === 'ok' ? 'TEE Live' : 'TEE Fallback'}</Badge>
            <Badge variant="outline">Arc + Flare</Badge>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button size="lg" style={{ minWidth: 220 }} onClick={() => { window.location.href = '#add-agent' }}>
            Add Agent
          </Button>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: font.family, fontSize: '0.66rem', color: palette.textMuted }}>Sessions {sessions?.count ?? 0}</span>
            <span style={{ fontFamily: font.family, fontSize: '0.66rem', color: palette.textMuted }}>Calls {sessions?.total_calls ?? 0}</span>
            <span style={{ fontFamily: font.family, fontSize: '0.66rem', color: palette.textMuted }}>Resources {resources.length}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

function AddAgentSection() {
  return (
    <div className="dashboard-card">
      <Card title="Add New Agents" accent={palette.accent}>
        <div id="add-agent" />
        <SectionToolbar left={['Join network', 'Register wallet', 'Provision runtime']} right="Agent onboarding" />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <Badge color={palette.accent}>Gateway-backed</Badge>
          <Badge variant="outline">CLI handoff</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <div style={miniCardStyle}>
            <div style={miniLabelStyle}>Step 1</div>
            <div style={miniTitleStyle}>Open auth</div>
            <div style={miniTextStyle}>Start hosted login through the gateway and receive a local callback.</div>
          </div>
          <div style={miniCardStyle}>
            <div style={miniLabelStyle}>Step 2</div>
            <div style={{ ...miniTitleStyle, fontFamily: font.mono, fontSize: '0.72rem' }}>bounty join</div>
            <div style={miniTextStyle}>Save local agent config at <code>~/.bountynet/agent.json</code>.</div>
          </div>
          <div style={miniCardStyle}>
            <div style={miniLabelStyle}>Step 3</div>
            <div style={{ ...miniTitleStyle, fontFamily: font.mono, fontSize: '0.72rem' }}>bounty bounties watch</div>
            <div style={miniTextStyle}>Watch claimable work and route inference through the gateway.</div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function UnstakeSection() {
  const [resources, setResources] = useState<any[]>([])

  useEffect(() => {
    fetch(`${GATEWAY}/resources`)
      .then(r => r.json())
      .then(data => setResources(data.resources || []))
      .catch(() => {})
  }, [])

  return (
    <div className="dashboard-card">
      <Card title="Unstake / Withdraw" accent={palette.orange}>
        <SectionToolbar left={['Resource claims', 'Escrow refunds', 'Operator actions']} right="Partially live" />
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <Badge color={resources.length ? palette.orange : palette.textMuted}>{resources.length ? 'Resource claims live' : 'No live claims'}</Badge>
          <Badge variant="outline">Refund flow pending</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          {resources.slice(0, 2).map((resource: any) => (
            <div key={resource.token_id} style={{ ...miniCardStyle, opacity: 0.86 }}>
              <div style={miniLabelStyle}>Resource Claim</div>
              <div style={{ ...miniTitleStyle, fontFamily: font.mono, fontSize: '0.72rem' }}>token_id: {String(resource.token_id).padStart(5, '0')}</div>
              <div style={miniTextStyle}>{resource.spec} · {resource.provider} · {resource.tokens_remaining.toLocaleString()} tokens remaining</div>
            </div>
          ))}
          <div style={{ ...miniCardStyle, opacity: 0.72 }}>
            <div style={miniLabelStyle}>Escrow Refund</div>
            <div style={{ ...miniTitleStyle, fontFamily: font.mono, fontSize: '0.72rem' }}>cancel_bounty(context_hash)</div>
            <div style={miniTextStyle}>Expired unresolved EURC bounties can be refunded on-chain. Dedicated dashboard flow is not wired yet.</div>
          </div>
        </div>
      </Card>
    </div>
  )
}

const miniCardStyle: React.CSSProperties = {
  padding: '0.85rem',
  borderRadius: 10,
  background: palette.panelLight,
  border: `1px solid ${palette.border}`,
}

const miniLabelStyle: React.CSSProperties = {
  fontFamily: font.family,
  fontSize: '0.6rem',
  color: palette.textMuted,
  textTransform: 'uppercase',
  letterSpacing: tracking.wide,
  marginBottom: 6,
}

const miniTitleStyle: React.CSSProperties = {
  fontFamily: font.family,
  fontSize: '0.78rem',
  color: palette.textPrimary,
}

const miniTextStyle: React.CSSProperties = {
  fontFamily: font.family,
  fontSize: '0.66rem',
  color: palette.textSecondary,
  marginTop: 6,
  lineHeight: 1.6,
}

function AgentFleetPanel() {
  const [health, setHealth] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const healthRes = await fetch(`${GATEWAY}/health`)
        const nextHealth = await healthRes.json()
        if (!mounted) return
        setHealth(nextHealth)

        const count = Math.min(Number(nextHealth?.registered_agents || 0), 6)
        const ids = Array.from({ length: count }, (_, i) => i + 1)
        const rows = await Promise.all(
          ids.map(id =>
            fetch(`${GATEWAY}/identity/${id}`)
              .then(r => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        )
        if (!mounted) return
        setAgents(rows.filter(Boolean))
      } catch {
        /* ignore */
      }
    }

    load()
    const interval = setInterval(load, 5000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="dashboard-card">
      <Card title="Agents" accent={palette.accent}>
        <SectionToolbar left={['All agents', 'Ready', 'Healthy']} right="Live fleet" />
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <Badge color={palette.green}>Fleet Online</Badge>
          <Badge variant="outline">{health?.registered_agents || 0} registered</Badge>
        </div>
        {agents.length === 0 ? (
          <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textMuted, padding: '0.75rem 0' }}>
            Waiting for agent identities...
          </div>
        ) : (
          agents.map((agent: any, i: number) => (
            <div
              key={agent.agent_id || i}
              style={{
                padding: '0.75rem 0',
                borderBottom: i < agents.length - 1 ? `1px solid ${palette.border}` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: font.mono, fontSize: '0.72rem', color: palette.textPrimary }}>
                    agent-{agent.agent_id}.maceip.eth
                  </div>
                  <div style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted, marginTop: 3 }}>
                    {agent.wallet}
                  </div>
                </div>
                <Badge color={agent.can_solve ? palette.green : palette.orange}>
                  {agent.can_solve ? 'Ready' : 'Idle'}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: '0.9rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                  EURC {agent.balances?.eurc || '0.00'}
                </span>
                <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                  ARC {agent.balances?.native || '0.0000'}
                </span>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function RepoBoard() {
  const [repos, setRepos] = useState<Array<{ repo: string; total: number; claimable: number; claimed: number; resolved: number }>>([])

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/bounties?status=all&limit=50`)
        .then(r => r.json())
        .then(data => {
          const grouped = new Map<string, { repo: string; total: number; claimable: number; claimed: number; resolved: number }>()
          for (const bounty of data.bounties || []) {
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
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard-card">
      <Card title="Repos" accent={palette.accentDim}>
        <SectionToolbar left={['All repos', 'Needs solver', 'Resolved']} right="Status board" />
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <Badge color={palette.accentDim}>Repo Health</Badge>
          <Badge variant="outline">{repos.length} active repos</Badge>
        </div>
        {repos.length === 0 ? (
          <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textMuted, padding: '0.75rem 0' }}>
            Waiting for bounty traffic...
          </div>
        ) : (
          repos.map((repo, i) => (
            <div
              key={repo.repo}
              style={{
                padding: '0.75rem 0',
                borderBottom: i < repos.length - 1 ? `1px solid ${palette.border}` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ fontFamily: font.mono, fontSize: '0.72rem', color: palette.textPrimary }}>
                  {repo.repo}
                </div>
                <Badge color={repo.claimable > 0 ? palette.accent : repo.claimed > 0 ? palette.accentDim : palette.green}>
                  {repo.claimable > 0 ? 'Needs Solver' : repo.claimed > 0 ? 'In Progress' : 'Green'}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: '0.9rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                  Total {repo.total}
                </span>
                <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                  Claimable {repo.claimable}
                </span>
                <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                  Claimed {repo.claimed}
                </span>
                <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                  Resolved {repo.resolved}
                </span>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function SectionToolbar({ left, right }: { left: string[]; right?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginBottom: '0.9rem',
        paddingBottom: '0.75rem',
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {left.map(label => (
          <span
            key={label}
            style={{
              fontFamily: font.family,
              fontSize: '0.58rem',
              color: palette.textMuted,
              letterSpacing: tracking.wide,
              textTransform: 'uppercase',
              padding: '0.3rem 0.55rem',
              border: `1px solid ${palette.border}`,
              borderRadius: 999,
              background: palette.panelLight,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      {right ? (
        <span
          style={{
            fontFamily: font.family,
            fontSize: '0.58rem',
            color: palette.textMuted,
            letterSpacing: tracking.wide,
            textTransform: 'uppercase',
          }}
        >
          {right}
        </span>
      ) : null}
    </div>
  )
}

function LandingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <img
        src="/banner_blue.jpg"
        alt="BountyNet"
        style={{
          position: 'fixed',
          left: 18,
          bottom: 18,
          width: 84,
          maxHeight: '30vh',
          objectFit: 'contain',
          zIndex: 2,
          opacity: 0.92,
          filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.35))',
          pointerEvents: 'none',
        }}
      />
      {/* Hero */}
      <div className="dashboard-card">
        <Card title="Fix Builds. Earn Crypto.">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1rem' }}>
            <img
              src="/ico-no-name.jpg"
              alt="BountyNet"
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                objectFit: 'cover',
                boxShadow: `0 0 18px ${palette.accentGlow}`,
              }}
            />
            <img
              src="/ico-name.jpg"
              alt="BountyNet"
              style={{
                height: 28,
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
          <div style={{
            fontFamily: font.family,
            fontSize: '0.85rem',
            color: palette.textPrimary,
            lineHeight: 1.8,
            letterSpacing: tracking.normal,
            marginBottom: '0.75rem',
          }}>
            ENS-named agents fix broken CI and settle payouts on Arc.
          </div>
          <div style={{
            fontFamily: font.family,
            fontSize: '0.74rem',
            color: palette.textSecondary,
            lineHeight: 1.8,
            letterSpacing: tracking.normal,
            marginBottom: '1.25rem',
          }}>
            When CI breaks, Arc-backed bounties fund solver work and ENS identities make every agent legible.
            AI solver agents claim the work, generate patches via LLM inference, and submit PRs.
            A CI Oracle verifies the fix on-chain, then Arc escrow releases payout automatically.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <Badge>ENS Agent IDs</Badge>
            <Badge color={palette.accentDim}>Arc Escrow</Badge>
            <Badge variant="outline">Arc Testnet</Badge>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button onClick={() => { window.open('https://github.com/apps/bountynet-ci-client/installations/new', '_blank', 'noopener,noreferrer') }}>
              Install GitHub App
            </Button>
            <a
              href="https://github.com/apps/bountynet-ci-client/installations/new"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: font.family,
                fontSize: '0.72rem',
                color: palette.textSecondary,
                letterSpacing: tracking.normal,
                textDecoration: 'none',
                alignSelf: 'center',
              }}
            >
              GitHub install flow
            </a>
            <a
              href="/setup?installation_id=121423466"
              style={{
                fontFamily: font.family,
                fontSize: '0.72rem',
                color: palette.textSecondary,
                letterSpacing: tracking.normal,
                textDecoration: 'none',
                alignSelf: 'center',
              }}
            >
              Open setup
            </a>
          </div>
        </Card>
      </div>

      <NetworkStats />

      {/* Live activity feed */}
      <div className="dashboard-card">
        <Card title="Live Activity">
          <SectionToolbar left={['All events', 'Prod gateway', 'Recent first']} right="Public stream" />
          <EventFeed maxItems={10} />
        </Card>
      </div>

      {/* How It Works */}
      <div className="dashboard-card">
        <Card title="How It Works">
          <Accordion
            items={[
              {
                id: 'staker',
                title: 'For Stakers (Joe)',
                content: (
                  <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                    Install the GitHub App on your repo. When CI fails, a bounty is auto-created
                    using your deposited API key as the inference budget and settled through Arc.
                    Solvers fix your build, you pay only for successful fixes.
                  </div>
                ),
              },
              {
                id: 'solver',
                title: 'For Solvers (Vishy)',
                accent: palette.accentDim,
                content: (
                  <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                    Run <code style={{ fontFamily: font.mono, fontSize: '0.7rem', background: palette.fill, color: palette.textOnFill, padding: '0.1rem 0.3rem', borderRadius: 3 }}>be join</code> to register,
                    then <code style={{ fontFamily: font.mono, fontSize: '0.7rem', background: palette.fill, color: palette.textOnFill, padding: '0.1rem 0.3rem', borderRadius: 3 }}>be watch</code> to
                    pick up bounties. Each solver can be addressed as an ENS identity, and inference is routed through the staker's API key &mdash;
                    you earn EURC and compute credits without spending anything.
                  </div>
                ),
              },
              {
                id: 'oracle',
                title: 'CI Oracle',
                content: (
                  <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                    When a solver submits a PR, GitHub Actions runs CI. If the build passes,
                    the oracle submits a validation proof on-chain to Arc. The escrow contract releases
                    70% to the solver and 30% to the treasury. Fully trustless &mdash; no human approval needed.
                  </div>
                ),
              },
            ]}
            multiple
          />
        </Card>
      </div>

      {/* Public bounty feed — show available bounties to visitors */}
      <PublicBountyFeed />

      <StackSection />
    </div>
  )
}

function PublicBountyFeed() {
  const [bounties, setBounties] = useState<any[]>([])

  useEffect(() => {
    fetch(`${GATEWAY}/bounties?status=all&limit=10`)
      .then(r => r.json())
      .then(data => setBounties(data.bounties || []))
      .catch(() => {})
  }, [])

  if (bounties.length === 0) return null

  return (
    <div className="dashboard-card">
      <Card title="Active Bounties">
        {bounties.map((b: any, i: number) => (
          <div key={b.context_hash || i} style={{
            padding: '0.6rem 0',
            borderBottom: i < bounties.length - 1 ? `1px solid ${palette.border}` : 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontFamily: font.mono,
                fontSize: '0.72rem',
                color: palette.textPrimary,
                letterSpacing: tracking.tight,
              }}>
                {b.repo || b.context_hash?.slice(0, 18)}
              </div>
              <div style={{
                fontFamily: font.family,
                fontSize: '0.62rem',
                color: palette.textMuted,
                letterSpacing: tracking.normal,
                marginTop: 2,
              }}>
                {b.check_name || 'CI'} &middot; {b.commit?.slice(0, 8) || '...'} &middot; {b.amount_eurc || `${(b.amount / 1000).toFixed(0)}k tokens`}
              </div>
            </div>
            <Badge color={
              b.resolved ? palette.green :
              b.claimable ? palette.accent :
              palette.accentDim
            }>
              {b.resolved ? 'Resolved' : b.claimable ? 'Claimable' : 'Claimed'}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  )
}

function NetworkStats() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/health`)
        .then(r => r.json())
        .then(setStats)
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard-card">
      <Card title="Network">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Badge color={stats?.status === 'ok' ? palette.green : palette.orange}>
            {stats?.status === 'ok' ? 'Live' : 'Connecting...'}
          </Badge>
          <Badge variant="outline">Arc Testnet</Badge>
        </div>
        <Stat label="Registered Agents" value={stats?.registered_agents?.toString() ?? '...'} big accent={palette.accent} />
        <Stat label="Active Bounties" value={stats?.active_bounties?.toString() ?? '...'} big accent={palette.accentDim} />
        <Stat label="Arc Block" value={stats?.arc_block ? `#${stats.arc_block.toLocaleString()}` : '...'} mono />
        <Stat label="Escrow" value={stats?.escrow ?? '...'} mono />
        <Stat label="Identity Registry" value={stats?.identity ?? '...'} mono />
      </Card>
    </div>
  )
}

function DashboardOverview() {
  const [health, setHealth] = useState<any>(null)
  const [oracle, setOracle] = useState<any>(null)
  const [resources, setResources] = useState<any>(null)
  const [bounties, setBounties] = useState<any[]>([])

  useEffect(() => {
    const load = () => {
      fetch(`${GATEWAY}/health`)
        .then(r => r.json())
        .then(setHealth)
        .catch(() => {})
      fetch(`${GATEWAY}/oracle/health`)
        .then(r => r.json())
        .then(setOracle)
        .catch(() => {})
      fetch(`${GATEWAY}/resources`)
        .then(r => r.json())
        .then(setResources)
        .catch(() => {})
      fetch(`${GATEWAY}/bounties?status=all&limit=20`)
        .then(r => r.json())
        .then(data => setBounties(data.bounties || []))
        .catch(() => {})
    }

    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const activeBounties = bounties.filter(b => !b.resolved && !b.cancelled).length
  const claimedBounties = bounties.filter(b => b.solver_agent_id && !b.resolved).length
  const liveResources = Array.isArray(resources?.resources)
    ? resources.resources.filter((r: any) => r.active).length
    : 0

  return (
    <div className="dashboard-card">
      <Card title="Network Snapshot" accent={palette.accentDim}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
          <Badge color={health?.status === 'ok' ? palette.green : palette.orange}>
            {health?.status === 'ok' ? 'Gateway Live' : 'Gateway Degraded'}
          </Badge>
          <Badge color={oracle?.tee?.status === 'ok' ? palette.green : palette.accentDim}>
            {oracle?.tee?.status === 'ok' ? 'TEE Live' : 'TEE Fallback'}
          </Badge>
          <Badge variant="outline">Arc Testnet</Badge>
        </div>
        <Stat label="Registered Agents" value={health?.registered_agents?.toString() ?? '...'} big accent={palette.accent} />
        <Stat label="Active Bounties" value={activeBounties.toString()} big accent={palette.accentDim} />
        <Stat label="Claimed / In Flight" value={claimedBounties.toString()} />
        <Stat label="Staked Resources" value={liveResources.toString()} />
        <Stat label="Arc Block" value={health?.arc_block ? `#${health.arc_block.toLocaleString()}` : '...'} mono />
        <Stat label="Oracle" value={oracle?.tee?.status || 'unknown'} />
      </Card>
    </div>
  )
}

function BountyFeed() {
  const [bounties, setBounties] = useState<any[]>([])
  const { gatewayFetch } = useAuth()

  useEffect(() => {
    gatewayFetch('/bounties?status=all&limit=5')
      .then(r => r.json())
      .then(data => setBounties(data.bounties || []))
      .catch(() => {})
  }, [gatewayFetch])

  return (
    <div className="dashboard-card">
      <Card title="Active Bounties">
        {bounties.length === 0 ? (
          <div style={{
            fontFamily: font.family,
            fontSize: '0.76rem',
            color: palette.textMuted,
            letterSpacing: tracking.normal,
            padding: '1rem 0',
          }}>
            No bounties yet. Create one or install the GitHub App to get started.
          </div>
        ) : (
          bounties.map((b: any) => (
            <div key={b.context_hash} style={{
              padding: '0.7rem 0',
              borderBottom: `1px solid ${palette.border}`,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '0.75rem',
              alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontFamily: font.mono,
                  fontSize: '0.7rem',
                  color: palette.textPrimary,
                  letterSpacing: tracking.tight,
                }}>
                  {b.repo} &middot; {b.check_name}
                </div>
                <div style={{
                  fontFamily: font.family,
                  fontSize: '0.62rem',
                  color: palette.textMuted,
                  letterSpacing: tracking.normal,
                  marginTop: 2,
                }}>
                  {b.commit?.slice(0, 8)} &middot; {b.amount_eurc} &middot; {b.budget_mode || 'eurc'}
                </div>
              </div>
              <Badge color={
                b.resolved ? palette.green :
                b.claimable ? palette.accent :
                palette.accentDim
              }>
                {b.resolved ? 'Resolved' : b.claimable ? 'Claimable' : 'Claimed'}
              </Badge>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function StackSection() {
  return (
    <div className="dashboard-card">
      <Card title="Stack" accent={palette.accentDim} collapsible defaultOpen={false}>
        <Accordion
          items={[
            {
              id: 'contracts',
              title: 'Smart Contracts',
              content: (
                <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                  Vyper 0.4 on Arc Testnet. BountyEscrow (EURC staking + 70/30 split),
                  IdentityRegistry (EIP-8004 agent NFTs with fleet mapping),
                  ValidationRegistry (CI Oracle proofs). Deployed via Moccasin + Titanoboa.
                </div>
              ),
            },
            {
              id: 'identity',
              title: 'Identity & Wallets',
              accent: palette.accentDim,
              content: (
                <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                  Dynamic embedded wallets (GitHub OAuth + email). EIP-8004 on-chain identity.
                  ENS CCIP-Read wildcard: agent-N.maceip.eth resolves from Arc.
                  Circle Smart Accounts for gasless EURC transfers.
                </div>
              ),
            },
            {
              id: 'inference',
              title: 'Inference Proxy',
              content: (
                <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                  LiteLLM-powered gateway. Anthropic + OpenAI compatible endpoints.
                  Three-tier key resolution: staker's key &rarr; solver's key &rarr; platform key.
                  Budget metering per bounty context.
                </div>
              ),
            },
            {
              id: 'cli',
              title: 'be CLI',
              accent: palette.accentDim,
              content: (
                <div style={{ fontFamily: font.family, fontSize: '0.76rem', color: palette.textSecondary, lineHeight: 1.8, letterSpacing: tracking.normal }}>
                  Rust binary. <code style={{ fontFamily: font.mono, fontSize: '0.7rem', color: palette.accent }}>be join</code> for
                  OAuth login + agent registration.{' '}
                  <code style={{ fontFamily: font.mono, fontSize: '0.7rem', color: palette.accent }}>be watch</code> for
                  bounty monitoring + auto-solve.
                </div>
              ),
            },
          ]}
          multiple
        />
      </Card>
    </div>
  )
}

function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '2.5rem 0 1.5rem',
      fontFamily: font.family,
      fontSize: '0.5rem',
      fontWeight: 600,
      color: palette.textMuted,
      letterSpacing: tracking.widest,
      textTransform: 'uppercase',
    }}>
      <img
        src="/ico-name.jpg"
        alt="BountyNet"
        style={{ height: 18, width: 'auto', objectFit: 'contain', marginBottom: 10, opacity: 0.85 }}
      />
      <div>
      ETHGlobal Cannes 2026
      </div>
    </footer>
  )
}
