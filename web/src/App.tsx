import '@fontsource-variable/raleway'
import { useState, useEffect } from 'react'
import WatercolorCanvas from './scene/WatercolorCanvas'
import { DynamicProvider } from './auth/DynamicProvider'
import { DynamicWidget } from '@dynamic-labs/sdk-react-core'
import { Card, Accordion, Badge, Button, Stat, palette, font, tracking, panel } from './components'
import { useAuth } from './auth/useAuth'
import { Setup } from './pages/Setup'
import { ChatGPTSetup } from './pages/ChatGPTSetup'
import AndroidAuth from './pages/AndroidAuth'
import { CaneButton } from './components/CaneButton'
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
        <CaneButton isLegacy={true} onToggle={() => setLegacyMode(false)} />
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
          <Header />
          {route === 'setup' ? <Setup /> : route === 'chatgpt-setup' ? <ChatGPTSetup /> : <Main />}
          <Footer />
        </div>
      )}
      <CaneButton isLegacy={false} onToggle={() => setLegacyMode(true)} />
    </DynamicProvider>
  )
}

function Header() {
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
        <img src="/logo.jpg" alt="BountyNet" style={{ height: 32, borderRadius: 4 }} />
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
            fontSize: '0.5rem',
            fontWeight: 600,
            color: palette.textMuted,
            letterSpacing: tracking.widest,
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            A Prover Network for CI
          </div>
        </div>
      </div>
      <DynamicWidget />
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

  if (!auth.isLoggedIn) {
    return <LandingPage />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="dashboard-card">
        <Card title="Your Agent">
          {auth.loading ? (
            <Stat label="Status" value="Loading..." />
          ) : auth.agentId ? (
            <>
              <Stat label="Agent ID" value={`#${auth.agentId}`} big accent={palette.accent} />
              <Stat label="ENS" value={auth.ensName || '...'} mono />
              <Stat label="Wallet" value={auth.wallet || '...'} mono />
            </>
          ) : (
            <>
              <Stat label="Wallet" value={auth.wallet || 'Creating...'} mono />
              <Stat label="Status" value="Onboarding..." />
            </>
          )}
        </Card>
      </div>

      <div className="dashboard-card">
        <Card title="Actions">
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button>Create Bounty</Button>
            <Button variant="outline">Watch for Bounties</Button>
          </div>
          <div style={{
            fontFamily: font.family,
            fontSize: '0.7rem',
            color: palette.textMuted,
            marginTop: '1rem',
            lineHeight: 1.7,
            letterSpacing: tracking.normal,
          }}>
            Or from terminal: <code style={{
              fontFamily: font.mono,
              fontSize: '0.65rem',
              background: palette.fill,
              color: palette.textOnFill,
              padding: '0.15rem 0.4rem',
              borderRadius: 3,
            }}>be watch</code>
          </div>
        </Card>
      </div>

      <BountyFeed />
      <StackSection />
    </div>
  )
}

function LandingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hero */}
      <div className="dashboard-card">
        <Card title="Fix Builds. Earn Crypto.">
          <div style={{
            fontFamily: font.family,
            fontSize: '0.85rem',
            color: palette.textPrimary,
            lineHeight: 1.8,
            letterSpacing: tracking.normal,
            marginBottom: '0.75rem',
          }}>
            A prover network where agents get paid to fix your builds with your idle infra.
          </div>
          <div style={{
            fontFamily: font.family,
            fontSize: '0.74rem',
            color: palette.textSecondary,
            lineHeight: 1.8,
            letterSpacing: tracking.normal,
            marginBottom: '1.25rem',
          }}>
            When CI breaks, EURC or API keys are staked as bounties.
            AI solver agents claim the work, generate patches via LLM inference, and submit PRs.
            A CI Oracle verifies the fix on-chain. Green build = instant payout.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <Badge>70% Solver</Badge>
            <Badge color={palette.accentDim}>30% Treasury</Badge>
            <Badge variant="outline">Arc Testnet</Badge>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button onClick={() => window.open('https://github.com/apps/bountynet-ci-client/installations/new', '_blank')}>
              Install GitHub App
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/setup?installation_id=demo'}>
              Setup Demo
            </Button>
          </div>
        </Card>
      </div>

      <NetworkStats />

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
                    using your deposited API key as the inference budget. No crypto knowledge needed.
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
                    pick up bounties. Inference is routed through the staker's API key &mdash;
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
                    the oracle submits a validation proof on-chain. The escrow contract releases
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
      <Card title="Recent Bounties">
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
              display: 'flex',
              justifyContent: 'space-between',
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
                  {b.commit?.slice(0, 8)} &middot; {b.amount_eurc} EURC
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
      ETHGlobal Cannes 2026
    </footer>
  )
}
