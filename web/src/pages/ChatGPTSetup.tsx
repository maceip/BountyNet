/**
 * Post-connector onboarding for ChatGPT Apps (MCP connector).
 *
 * parallels Setup.tsx (GitHub App):
 *   GitHub:  /setup?installation_id=X → gateway /github/setup
 *   ChatGPT: /chatgpt-setup?link=X   → gateway /chatgpt/setup
 *
 * ChatGPT itself runs OAuth inside the product when tools require it (see OpenAI Apps SDK auth).
 * This page only handles BountyNet-specific staker config (API key + token budget).
 */
import { useState, useEffect, useCallback } from 'react'
import { Badge, Button, palette, font, tracking, panel } from '../components'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

type Phase = 'loading' | 'configure' | 'activating' | 'done'

const helpText: React.CSSProperties = {
  fontFamily: font.family,
  fontSize: '0.68rem',
  color: palette.textMuted,
  lineHeight: 1.6,
}

const sectionStyle: React.CSSProperties = {
  ...panel(),
  borderRadius: 6,
  marginBottom: '1rem',
  overflow: 'hidden',
}

const sectionHeader: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: `1px solid ${palette.border}`,
  fontFamily: font.family,
  fontSize: '0.78rem',
  fontWeight: 600,
  color: palette.textPrimary,
  letterSpacing: tracking.wide,
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

export function ChatGPTSetup() {
  const params = new URLSearchParams(window.location.search)
  const linkId = params.get('link')

  const [phase, setPhase] = useState<Phase>('loading')
  const [linkMeta, setLinkMeta] = useState<{ label?: string; created_at?: number } | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [budgetTokens, setBudgetTokens] = useState(100_000)
  const [openaiSub, setOpenaiSub] = useState('')
  const [error, setError] = useState('')
  const [setupResult, setSetupResult] = useState<{ budget_tokens?: number; has_api_key?: boolean } | null>(null)

  useEffect(() => {
    if (!linkId) {
      setPhase('configure')
      return
    }
    fetch(`${GATEWAY}/chatgpt/link/${linkId}`)
      .then(r => {
        if (!r.ok) throw new Error('Invalid or expired link')
        return r.json()
      })
      .then(data => {
        setLinkMeta({ label: data.label, created_at: data.created_at })
        setPhase('configure')
      })
      .catch(e => {
        setError(e.message)
        setPhase('configure')
      })
  }, [linkId])

  const activate = useCallback(() => {
    if (!linkId) return
    setPhase('activating')
    fetch(`${GATEWAY}/chatgpt/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        link_id: linkId,
        api_key: apiKey,
        budget_tokens: budgetTokens,
        openai_sub: openaiSub,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setSetupResult(data)
        setPhase('done')
      })
      .catch(e => {
        setError(e.message)
        setPhase('configure')
      })
  }, [linkId, apiKey, budgetTokens, openaiSub])

  if (!linkId) {
    return (
      <div style={sectionStyle}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ ...helpText, marginBottom: '1rem' }}>
            Missing link. Create an onboarding link via{' '}
            <code style={{ fontFamily: font.mono, fontSize: '0.7rem' }}>POST {GATEWAY}/chatgpt/link</code>{' '}
            and open the returned setup path, or ask your admin for the full URL.
          </div>
          <Button onClick={() => { window.location.href = '/' }}>Go Home</Button>
        </div>
      </div>
    )
  }

  if (phase === 'done' && setupResult) {
    return (
      <div>
        <div style={{
          ...panel(true),
          borderRadius: 6,
          borderLeft: `3px solid ${palette.green}`,
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontFamily: font.family, fontSize: '0.85rem', fontWeight: 600, color: palette.green, marginBottom: '0.25rem' }}>
            ChatGPT connector linked
          </div>
          <div style={helpText}>
            Inference budget saved for this connector. Solver agents can use your deposited key under the same rules as GitHub stakers.
          </div>
        </div>
        <div style={sectionStyle}>
          <div style={sectionHeader}>Configuration</div>
          <div style={{ padding: '0.75rem 1rem', fontFamily: font.family, fontSize: '0.78rem', borderBottom: `1px solid ${palette.border}` }}>
            <span style={{ color: palette.textMuted, display: 'inline-block', width: 120 }}>Budget</span>
            <span>{((setupResult.budget_tokens ?? 0) / 1000).toFixed(0)}k tokens / bounty</span>
          </div>
          <div style={{ padding: '0.75rem 1rem', fontFamily: font.family, fontSize: '0.78rem' }}>
            <span style={{ color: palette.textMuted, display: 'inline-block', width: 120 }}>API Key</span>
            <span>{setupResult.has_api_key ? 'Deposited' : 'None'}</span>
          </div>
        </div>
        <Button onClick={() => { window.location.href = '/' }}>Go to Dashboard</Button>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        ...panel(),
        borderRadius: 6,
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ fontFamily: font.family, fontSize: '0.78rem', fontWeight: 600, color: palette.textPrimary }}>
          {phase === 'loading' ? 'Loading link…' : phase === 'activating' ? 'Saving…' : 'Configure ChatGPT connector'}
        </div>
        <div style={{ ...helpText, fontSize: '0.62rem', marginTop: '0.25rem' }}>
          Link <code style={{ fontFamily: font.mono }}>{linkId.slice(0, 12)}…</code>
          {linkMeta?.label ? (
            <Badge color={palette.accent} variant="outline">{linkMeta.label}</Badge>
          ) : null}
        </div>
      </div>

      {phase === 'configure' && (
        <div style={sectionStyle}>
          <div style={sectionHeader}>Inference budget</div>
          <div style={{ padding: '1rem' }}>
            <div style={{ ...helpText, marginBottom: '1rem' }}>
              OAuth for your users is handled inside ChatGPT when the MCP server requests it.
              This page only stores your LLM API key and per-bounty token budget (same pattern as the GitHub App setup page).
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={labelStyle}>OpenID subject (optional)</div>
              <input
                type="text"
                placeholder="sub claim from your IdP access token"
                value={openaiSub}
                onChange={e => { setOpenaiSub(e.target.value) }}
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
              />
              <div style={{ ...helpText, fontSize: '0.6rem', marginTop: '0.25rem' }}>
                If you tie budgets to a specific ChatGPT / IdP user, paste the stable <code>sub</code> here.
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={labelStyle}>API Key</div>
              <input
                type="password"
                placeholder="sk-ant-... or sk-..."
                value={apiKey}
                onChange={e => { setApiKey(e.target.value) }}
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
              />
            </div>
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
                onChange={e => { setBudgetTokens(parseInt(e.target.value)) }}
                style={{ width: '100%', accentColor: palette.accent }}
              />
            </div>
            <Button
              onClick={activate}
              disabled={!apiKey || phase === 'activating'}
              fullWidth
              size="lg"
            >
              Save budget &amp; key
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
