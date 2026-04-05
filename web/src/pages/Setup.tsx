/**
 * Setup page — Joe lands here after installing the GitHub App.
 *
 * URL: /setup?installation_id=X
 *
 * Design: Familiar GitHub-like layout. Joe just came from github.com —
 * this should feel like he's still in a settings page. Same density,
 * repo list with checkboxes, status dots, monospace hashes.
 */
import { useState, useEffect, useCallback } from 'react'
import { Badge, Button, palette, font, tracking, panel, panelInner } from '../components'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

interface Failure {
  run_id: number
  name: string
  head_sha: string
  branch: string
  created_at: string
  url: string
}

interface Insight {
  type: string
  severity: string
  title: string
  description: string
  auto_fixable: boolean
}

interface RepoScan {
  repo: string
  failures: Failure[]
  insights: Insight[]
  bounties_created: { context_hash: string; check: string; sha: string }[]
  ci_healthy: boolean
}

interface ScanResult {
  repos_scanned: number
  total_failures: number
  total_bounties_created: number
  total_insights: number
  results: RepoScan[]
}

type Phase = 'loading' | 'configure' | 'testing' | 'activating' | 'done'

// ── GitHub-like style primitives ──────────────────────────────

const sectionStyle: React.CSSProperties = {
  ...panel(),
  borderRadius: 6,
  marginBottom: '1rem',
  overflow: 'hidden',
}

const sectionHeader = (borderColor = palette.border): React.CSSProperties => ({
  padding: '0.75rem 1rem',
  borderBottom: `1px solid ${borderColor}`,
  fontFamily: font.family,
  fontSize: '0.78rem',
  fontWeight: 600,
  color: palette.textPrimary,
  letterSpacing: tracking.wide,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

const rowStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  borderBottom: `1px solid ${palette.border}`,
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  fontSize: '0.78rem',
  fontFamily: font.family,
  color: palette.textPrimary,
}

const labelStyle: React.CSSProperties = {
  fontFamily: font.family,
  fontSize: '0.65rem',
  fontWeight: 600,
  color: palette.textMuted,
  textTransform: 'uppercase',
  letterSpacing: tracking.wider,
  marginBottom: '0.3rem',
}

const helpText: React.CSSProperties = {
  fontFamily: font.family,
  fontSize: '0.68rem',
  color: palette.textMuted,
  lineHeight: 1.6,
}

const dot = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
})


export function Setup() {
  const params = new URLSearchParams(window.location.search)
  const installationId = params.get('installation_id')

  const [phase, setPhase] = useState<Phase>('loading')
  const [repos, setRepos] = useState<string[]>([])
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [budgetTokens, setBudgetTokens] = useState(100_000)
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [setupResult, setSetupResult] = useState<any>(null)
  const [testState, setTestState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  // 1. Fetch repos
  useEffect(() => {
    if (!installationId) return
    fetch(`${GATEWAY}/github/repos/${installationId}`)
      .then(r => r.json())
      .then(data => {
        const r = data.repos || []
        setRepos(r)
        setSelectedRepos(new Set(r))
        setPhase('configure')
      })
      .catch(() => {
        setRepos([])
        setPhase('configure')
      })
  }, [installationId])

  // 3. Activate
  const activate = useCallback(() => {
    if (!installationId) return
    setError('')
    setPhase('activating')
    fetch(`${GATEWAY}/github/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installation_id: parseInt(installationId),
        repos: [...selectedRepos],
        api_key: apiKey,
        budget_tokens: budgetTokens,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setSetupResult(data)
        return fetch(`${GATEWAY}/github/scan/${installationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repos: [...selectedRepos] }),
        })
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setScan(data)
        setPhase('done')
      })
      .catch(e => {
        setError(e.message)
        setPhase('configure')
      })
  }, [installationId, selectedRepos, apiKey, budgetTokens])

  const testApiKey = useCallback(() => {
    if (!apiKey) return
    setError('')
    setTestState('idle')
    setTestMessage('')
    setPhase('testing')
    fetch(`${GATEWAY}/github/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || data.error) {
          throw new Error(data.error || 'Key test failed')
        }
        setTestState('ok')
        setTestMessage(`${data.provider}: ${data.text}`)
        setPhase('configure')
      })
      .catch(e => {
        setTestState('error')
        setTestMessage(e.message || 'Key test failed')
        setPhase('configure')
      })
  }, [apiKey])

  const toggleRepo = (repo: string) => {
    setSelectedRepos(prev => {
      const next = new Set(prev)
      next.has(repo) ? next.delete(repo) : next.add(repo)
      return next
    })
  }

  if (!installationId) {
    return (
      <div style={sectionStyle}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ ...helpText, marginBottom: '1rem' }}>
            Missing installation_id. Install the BountyNet GitHub App to get started.
          </div>
          <Button onClick={() => window.location.href = '/'}>Go Home</Button>
        </div>
      </div>
    )
  }

  // ── Done ────────────────────────────────────────────────────
  if (phase === 'done' && setupResult) {
    return (
      <div>
        <div style={{
          ...panel(),
          borderRadius: 6,
          padding: '0.7rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <Badge color={palette.accent}>ENS agent identities</Badge>
          <Badge color={palette.accentDim}>Arc escrow settlement</Badge>
          <Badge variant="outline">GitHub install → fund → bounty</Badge>
        </div>

        {/* Success banner */}
        <div style={{
          ...panel(true),
          borderRadius: 6,
          borderLeft: `3px solid ${palette.green}`,
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontFamily: font.family, fontSize: '0.85rem', fontWeight: 600, color: palette.green, marginBottom: '0.25rem' }}>
            BountyNet is active
          </div>
          <div style={helpText}>
            Monitoring {setupResult.repos?.length || 0} repo{(setupResult.repos?.length || 0) !== 1 ? 's' : ''}.
            When CI fails, ENS-named solver agents will claim the bounty and Arc escrow will settle the result.
          </div>
        </div>

        {/* Already working */}
        {scan && scan.total_failures > 0 && (
          <div style={{
            ...panel(),
            borderRadius: 6,
            borderLeft: `3px solid ${palette.accent}`,
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
          }}>
            <div style={{ fontFamily: font.family, fontSize: '0.78rem', fontWeight: 600, color: palette.accent, marginBottom: '0.25rem' }}>
              Working on {scan.total_failures} existing failure{scan.total_failures !== 1 ? 's' : ''}
            </div>
            <div style={helpText}>
              Solver agents are already picking up your existing CI failures. Check back shortly for pull requests.
            </div>
          </div>
        )}

        {/* Config summary */}
        <div style={sectionStyle}>
          <div style={sectionHeader()}>Configuration</div>
          <div style={rowStyle}>
            <span style={{ color: palette.textMuted, width: 120 }}>Repos</span>
            <span style={{ fontFamily: font.mono, fontSize: '0.72rem' }}>
              {(setupResult.repos || []).join(', ')}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: palette.textMuted, width: 120 }}>Budget</span>
            <span>{(setupResult.budget_tokens / 1000).toFixed(0)}k tokens per Arc-settled bounty</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: palette.textMuted, width: 120 }}>API Key</span>
            <span>{setupResult.has_api_key ? 'Deposited' : 'None'}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: palette.textMuted, width: 120 }}>Identity</span>
            <span>Solver agents resolve as ENS names like <code style={{ fontFamily: font.mono, fontSize: '0.7rem', background: palette.fill, padding: '0.1rem 0.3rem', borderRadius: 3, color: palette.textOnFill }}>agent-1.maceip.eth</code></span>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={{ color: palette.textMuted, width: 120 }}>CLI</span>
            <span style={helpText}>
              Run{' '}
              <code style={{ fontFamily: font.mono, fontSize: '0.7rem', background: palette.fill, padding: '0.1rem 0.3rem', borderRadius: 3, color: palette.textOnFill }}>
                be join
              </code>{' '}
              to become a solver and earn EURC fixing others' builds
            </span>
          </div>
        </div>

        <Button onClick={() => window.location.href = '/'}>Go to Dashboard</Button>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        ...panel(),
        borderRadius: 6,
        padding: '0.7rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <Badge color={palette.accent}>ENS agent identities</Badge>
        <Badge color={palette.accentDim}>Arc escrow settlement</Badge>
        <Badge variant="outline">Repo install → fund → bounty</Badge>
      </div>

      {/* Progress banner */}
      <div style={{
        ...panel(),
        borderRadius: 6,
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <ProgressDots phase={phase} />
        <div>
          <div style={{ fontFamily: font.family, fontSize: '0.78rem', fontWeight: 600, color: palette.textPrimary }}>
            {phase === 'loading' ? 'Loading repositories...' :
             phase === 'testing' ? 'Testing API key...' :
             phase === 'activating' ? 'Activating...' :
             'Configure BountyNet'}
          </div>
          <div style={{ ...helpText, fontSize: '0.62rem' }}>
            Installation #{installationId}
          </div>
        </div>
      </div>

      {/* Scan results */}
      {scan && (
        <div style={sectionStyle}>
          <div style={sectionHeader()}>
            <span>CI Analysis</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {scan.total_failures > 0 && (
                <Badge color={palette.red}>{scan.total_failures} failure{scan.total_failures !== 1 ? 's' : ''}</Badge>
              )}
              {scan.total_insights > 0 && (
                <Badge color={palette.amber}>{scan.total_insights} suggestion{scan.total_insights !== 1 ? 's' : ''}</Badge>
              )}
              {scan.total_failures === 0 && scan.total_insights === 0 && (
                <Badge color={palette.green}>All clear</Badge>
              )}
            </div>
          </div>

          {scan.results.map(repo => (
            <RepoBlock key={repo.repo} repo={repo} />
          ))}
        </div>
      )}

      {/* Repo selection */}
      {phase === 'configure' && repos.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeader()}>
            <span>Repository access</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setSelectedRepos(new Set())}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  fontFamily: font.family,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: palette.textSecondary,
                  letterSpacing: tracking.wide,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Deselect all
              </button>
              <span style={{ ...helpText, fontSize: '0.62rem' }}>{selectedRepos.size} of {repos.length} selected</span>
            </div>
          </div>
          {repos.map((repo, i) => {
            const repoScan = scan?.results.find(r => r.repo === repo)
            return (
              <label key={repo} style={{
                ...rowStyle,
                cursor: 'pointer',
                borderBottom: i < repos.length - 1 ? `1px solid ${palette.border}` : 'none',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${palette.accent}08` }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <input
                  type="checkbox"
                  checked={selectedRepos.has(repo)}
                  onChange={() => toggleRepo(repo)}
                  style={{ accentColor: palette.accent, width: 14, height: 14 }}
                />
                <span style={dot(
                  repoScan ? (repoScan.failures.length > 0 ? palette.red : palette.green) : palette.textMuted
                )} />
                <span style={{ fontFamily: font.mono, fontSize: '0.75rem', flex: 1 }}>
                  {repo}
                </span>
                {repoScan && repoScan.failures.length > 0 && (
                  <span style={{ ...helpText, fontSize: '0.6rem' }}>
                    {repoScan.failures.length} failing
                  </span>
                )}
                {repoScan && repoScan.insights.length > 0 && (
                  <span style={{ ...helpText, fontSize: '0.6rem' }}>
                    {repoScan.insights.length} suggestion{repoScan.insights.length !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* API key + budget */}
      {phase === 'configure' && (
        <div style={sectionStyle}>
          <div style={sectionHeader()}>Inference budget</div>
          <div style={{ padding: '1rem' }}>
            <div style={{ ...helpText, marginBottom: '1rem' }}>
              Deposit an API key so solver agents can use LLM inference to fix your builds.
              You only pay for successful fixes.
            </div>

            {/* API Key */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={labelStyle}>API Key</div>
              <input
                type="password"
                placeholder="sk-ant-... or sk-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: palette.panelLight,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 4,
                  fontFamily: font.mono,
                  fontSize: '0.75rem',
                  color: palette.textPrimary,
                  outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = palette.accent }}
                onBlur={e => { e.target.style.borderColor = palette.border }}
              />
              <div style={{ ...helpText, fontSize: '0.6rem', marginTop: '0.25rem' }}>
                Anthropic or OpenAI key. Used only for bounty inference. Never shared.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <Button
                onClick={testApiKey}
                disabled={!apiKey || phase === 'testing' || phase === 'activating'}
                variant="outline"
              >
                {phase === 'testing' ? 'Testing key...' : 'Test key with prompt'}
              </Button>
              {testState === 'ok' && (
                <Badge color={palette.green}>Key verified</Badge>
              )}
              {testState === 'error' && (
                <Badge color={palette.red}>Key failed</Badge>
              )}
            </div>
            {testMessage && (
              <div style={{ ...helpText, marginBottom: '1rem', color: testState === 'error' ? palette.red : palette.green }}>
                {testMessage}
              </div>
            )}

            {/* Budget slider */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={labelStyle}>Token budget per bounty</div>
                <span style={{ fontFamily: font.mono, fontSize: '0.78rem', fontWeight: 700, color: palette.accent }}>
                  {(budgetTokens / 1000).toFixed(0)}k
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={500000}
                step={10000}
                value={budgetTokens}
                onChange={e => setBudgetTokens(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: palette.accent }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', ...helpText, fontSize: '0.55rem', marginTop: '0.15rem' }}>
                <span>10k tokens</span>
                <span>~${(budgetTokens * 0.000015).toFixed(2)} per bounty</span>
                <span>500k tokens</span>
              </div>
            </div>

            {/* Activate */}
            <Button
              onClick={activate}
              disabled={!apiKey || selectedRepos.size === 0}
              fullWidth
              size="lg"
            >
              {selectedRepos.size > 0
                ? `Activate ${selectedRepos.size} repo${selectedRepos.size !== 1 ? 's' : ''} and scan`
                : 'Select repos to activate'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          ...panel(),
          borderRadius: 6,
          borderLeft: `3px solid ${palette.red}`,
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontFamily: font.family, fontSize: '0.75rem', color: palette.red }}>{error}</div>
        </div>
      )}
    </div>
  )
}


function RepoBlock({ repo }: { repo: RepoScan }) {
  const [expanded, setExpanded] = useState(repo.failures.length > 0 || repo.insights.length > 0)

  return (
    <div style={{ borderBottom: `1px solid ${palette.border}` }}>
      {/* Repo row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          ...rowStyle,
          borderBottom: expanded ? `1px solid ${palette.border}` : 'none',
          cursor: 'pointer',
        }}
      >
        <span style={dot(repo.failures.length > 0 ? palette.red : palette.green)} />
        <span style={{ fontFamily: font.mono, fontSize: '0.75rem', flex: 1 }}>
          {repo.repo}
        </span>
        {repo.failures.length > 0 && (
          <Badge color={palette.red}>{repo.failures.length} failure{repo.failures.length !== 1 ? 's' : ''}</Badge>
        )}
        {repo.insights.length > 0 && (
          <Badge color={palette.amber}>{repo.insights.length}</Badge>
        )}
        {repo.failures.length === 0 && repo.insights.length === 0 && (
          <Badge color={palette.green}>Passing</Badge>
        )}
        <span style={{ fontSize: '0.55rem', color: palette.textMuted, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : '' }}>
          &#9660;
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 1rem 0.5rem', background: `${palette.accent}04` }}>
          {/* Failures */}
          {repo.failures.map((f, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0',
              borderBottom: i < repo.failures.length - 1 ? `1px solid ${palette.border}` : 'none',
              fontSize: '0.72rem',
            }}>
              <span style={{ color: palette.red, fontSize: '0.6rem' }}>&#x2716;</span>
              <span style={{ fontFamily: font.family, color: palette.textPrimary, flex: 1 }}>
                {f.name}
              </span>
              <code style={{ fontFamily: font.mono, fontSize: '0.65rem', color: palette.textMuted }}>
                {f.head_sha}
              </code>
              <span style={{ fontFamily: font.family, fontSize: '0.62rem', color: palette.textMuted }}>
                {f.branch}
              </span>
              <Badge color={palette.accent} variant="outline">bounty</Badge>
            </div>
          ))}

          {/* Insights */}
          {repo.insights.map((insight, i) => (
            <div key={`i-${i}`} style={{
              padding: '0.5rem 0',
              borderTop: (i === 0 && repo.failures.length > 0) ? `1px solid ${palette.border}` : 'none',
              borderBottom: i < repo.insights.length - 1 ? `1px solid ${palette.border}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{
                  fontSize: '0.6rem',
                  color: insight.severity === 'high' ? palette.red : insight.severity === 'medium' ? palette.amber : palette.accent,
                }}>
                  {insight.severity === 'high' ? '!' : insight.severity === 'medium' ? '~' : 'i'}
                </span>
                <span style={{ fontFamily: font.family, fontSize: '0.72rem', fontWeight: 600, color: palette.textPrimary }}>
                  {insight.title}
                </span>
                {insight.auto_fixable && <Badge color={palette.accent}>auto-fixable</Badge>}
              </div>
              <div style={{ fontFamily: font.family, fontSize: '0.68rem', color: palette.textMuted, paddingLeft: '1.1rem', lineHeight: 1.5 }}>
                {insight.description}
              </div>
            </div>
          ))}

          {repo.failures.length === 0 && repo.insights.length === 0 && (
            <div style={{ padding: '0.5rem 0', ...helpText }}>
              No issues found. CI is healthy.
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function ProgressDots({ phase }: { phase: Phase }) {
  const steps = ['loading', 'scanning', 'configure', 'done']
  const current = steps.indexOf(phase === 'activating' ? 'configure' : phase)

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {steps.map((step, i) => (
        <div key={step} style={{
          width: i <= current ? 10 : 6,
          height: i <= current ? 10 : 6,
          borderRadius: '50%',
          background: i < current ? palette.green : i === current ? palette.accent : palette.textMuted,
          transition: 'all 0.3s',
          opacity: i <= current ? 1 : 0.3,
        }} />
      ))}
    </div>
  )
}
