/**
 * The Legacy Site — web 1.0 form-based BountyNet.
 *
 * Opens when you click the cane button. Intentionally ugly-charming.
 * Makes the point: "this is what it looks like without the agent experience."
 *
 * Same functionality, pure HTML forms, no animations, Times New Roman.
 */
import { useState, useEffect } from 'react'
import { palette, font } from '../components'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

export function LegacySite({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<any>(null)
  const [bounties, setBounties] = useState<any[]>([])
  const [tab, setTab] = useState<'home' | 'stake' | 'solve' | 'bounties' | 'dispute'>('home')

  useEffect(() => {
    fetch(`${GATEWAY}/health`).then(r => r.json()).then(setStats).catch(() => {})
    fetch(`${GATEWAY}/bounties`).then(r => r.json()).then(d => setBounties(d.bounties || [])).catch(() => {})
  }, [])

  const legacy: React.CSSProperties = {
    fontFamily: '"Times New Roman", Times, serif',
    background: '#f5f5f0',
    color: '#333',
    minHeight: '100vh',
    padding: 0,
    margin: 0,
  }

  const container: React.CSSProperties = {
    maxWidth: 760,
    margin: '0 auto',
    padding: '1rem',
  }

  const header: React.CSSProperties = {
    background: '#003366',
    color: 'white',
    padding: '0.5rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #cc6600',
  }

  const nav: React.CSSProperties = {
    background: '#eeeecc',
    padding: '0.3rem 1rem',
    borderBottom: '1px solid #999',
    display: 'flex',
    gap: '0.5rem',
  }

  const navLink = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.8rem',
    background: active ? '#003366' : 'transparent',
    color: active ? 'white' : '#003366',
    textDecoration: active ? 'none' : 'underline',
    border: '1px solid #003366',
    cursor: 'pointer',
    fontFamily: '"Times New Roman", serif',
    fontSize: '0.85rem',
  })

  const fieldset: React.CSSProperties = {
    border: '1px solid #999',
    padding: '1rem',
    margin: '1rem 0',
    background: 'white',
  }

  const label: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.3rem',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  }

  const input: React.CSSProperties = {
    width: '100%',
    padding: '0.3rem',
    border: '1px solid #999',
    fontFamily: '"Courier New", monospace',
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
    boxSizing: 'border-box',
  }

  const submitBtn: React.CSSProperties = {
    background: '#003366',
    color: 'white',
    border: '2px outset #666',
    padding: '0.4rem 1.5rem',
    fontFamily: '"Times New Roman", serif',
    fontSize: '0.9rem',
    cursor: 'pointer',
  }

  const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #999', margin: '1rem 0' }

  const visitor = (
    <span style={{ fontSize: '0.7rem', color: '#666' }}>
      Visitor #{Math.floor(Math.random() * 99999).toString().padStart(5, '0')}
    </span>
  )

  return (
    <div style={legacy}>
      {/* Header */}
      <div style={header}>
        <div>
          <b style={{ fontSize: '1.1rem' }}>BountyNet</b>
          <span style={{ fontSize: '0.7rem', marginLeft: 8, opacity: 0.7 }}>
            est. 2026 &mdash; A Prover Network for CI
          </span>
        </div>
        {visitor}
      </div>

      {/* Navigation */}
      <div style={nav}>
        {(['home', 'stake', 'solve', 'bounties', 'dispute'] as const).map(t => (
          <button key={t} style={navLink(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={container}>
        {/* Home */}
        {tab === 'home' && (
          <div>
            <h2 style={{ color: '#003366', borderBottom: '2px solid #003366' }}>
              Welcome to BountyNet
            </h2>
            <p>
              <b>BountyNet</b> is a prover network where agents get paid to fix your builds
              with your idle infra. When CI breaks, EURC or API keys are staked as bounties.
            </p>
            <hr style={hr} />
            <table border={1} cellPadding={6} cellSpacing={0} style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead style={{ background: '#003366', color: 'white' }}>
                <tr><th>Metric</th><th>Value</th></tr>
              </thead>
              <tbody>
                <tr><td>Status</td><td>{stats?.status === 'ok' ? '🟢 Online' : '🔴 Offline'}</td></tr>
                <tr><td>Arc Block</td><td><code>{stats?.arc_block?.toLocaleString()}</code></td></tr>
                <tr><td>Registered Agents</td><td>{stats?.registered_agents}</td></tr>
                <tr><td>Escrow Contract</td><td><code style={{ fontSize: '0.7rem' }}>{stats?.escrow}</code></td></tr>
              </tbody>
            </table>
            <hr style={hr} />
            <p style={{ fontSize: '0.75rem', color: '#666' }}>
              <img src="https://web.archive.org/web/20090830092230im_/http://geocities.com/SiliconValley/Sector/6087/construction.gif"
                   width={32} height={32} style={{ verticalAlign: 'middle', marginRight: 4 }}
                   onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              This page best viewed in Netscape Navigator 4.0+ at 800x600 resolution.
            </p>
          </div>
        )}

        {/* Stake */}
        {tab === 'stake' && (
          <div>
            <h2 style={{ color: '#003366' }}>Stake Your API Credits</h2>
            <p>Deposit an API key so solver agents can use LLM inference to fix your builds.</p>
            <fieldset style={fieldset}>
              <legend><b>API Key Deposit Form</b></legend>
              <label style={label}>Provider:</label>
              <select style={{ ...input, width: 200 }}>
                <option>Anthropic (Claude)</option>
                <option>OpenAI (GPT)</option>
              </select>
              <label style={label}>API Key:</label>
              <input type="password" placeholder="sk-ant-..." style={input} />
              <label style={label}>Token Budget per Bounty:</label>
              <input type="number" defaultValue={100000} style={{ ...input, width: 200 }} />
              <label style={label}>Repository (optional):</label>
              <input type="text" placeholder="owner/repo" style={input} />
              <br />
              <button style={submitBtn}>Submit Stake</button>
            </fieldset>
            <fieldset style={fieldset}>
              <legend><b>Unstake / Withdraw</b></legend>
              <p>Enter your agent ID to withdraw remaining credits.</p>
              <label style={label}>Agent ID:</label>
              <input type="number" placeholder="1" style={{ ...input, width: 100 }} />
              <button style={submitBtn}>Check Balance</button>
            </fieldset>
          </div>
        )}

        {/* Solve */}
        {tab === 'solve' && (
          <div>
            <h2 style={{ color: '#003366' }}>Register as Solver</h2>
            <fieldset style={fieldset}>
              <legend><b>Agent Registration</b></legend>
              <p>Register to start claiming bounties and earning EURC.</p>
              <label style={label}>Email or GitHub ID:</label>
              <input type="text" placeholder="vishy@example.com" style={input} />
              <button style={submitBtn}>Register Agent</button>
            </fieldset>
            <fieldset style={fieldset}>
              <legend><b>Proxy Configuration</b></legend>
              <p>Point your AI tool at BountyNet's inference proxy:</p>
              <pre style={{ background: '#eee', padding: '0.75rem', border: '1px solid #999', fontSize: '0.75rem', overflow: 'auto' }}>
{`export ANTHROPIC_API_KEY=bnet_<agent_id>:<context_hash>
export ANTHROPIC_BASE_URL=https://gateway.stare.network/v1

# Works with Claude Code, Cursor, Codex — any Anthropic-compatible tool`}
              </pre>
            </fieldset>
          </div>
        )}

        {/* Bounties */}
        {tab === 'bounties' && (
          <div>
            <h2 style={{ color: '#003366' }}>Bounty Board</h2>
            {bounties.length === 0 ? (
              <p><i>No active bounties at this time. Check back later.</i></p>
            ) : (
              <table border={1} cellPadding={4} cellSpacing={0} style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
                <thead style={{ background: '#003366', color: 'white' }}>
                  <tr>
                    <th>Repository</th>
                    <th>Check</th>
                    <th>Budget</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bounties.map((b: any, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f5f5ee' }}>
                      <td><code>{b.repo || '?'}</code></td>
                      <td>{b.check_name || 'CI'}</td>
                      <td>{b.amount_eurc || '?'}</td>
                      <td style={{ color: b.claimable ? 'green' : '#cc6600' }}>
                        <b>{b.claimable ? 'OPEN' : b.resolved ? 'RESOLVED' : 'CLAIMED'}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Dispute */}
        {tab === 'dispute' && (
          <div>
            <h2 style={{ color: '#003366' }}>File a Dispute</h2>
            <fieldset style={fieldset}>
              <legend><b>Complaint Form</b></legend>
              <label style={label}>Your Email:</label>
              <input type="email" placeholder="user@example.com" style={input} />
              <label style={label}>Bounty Context Hash:</label>
              <input type="text" placeholder="0x..." style={input} />
              <label style={label}>Description of Issue:</label>
              <textarea rows={5} style={{ ...input, resize: 'vertical' }} placeholder="Describe the problem..." />
              <button style={submitBtn}>Submit Complaint</button>
            </fieldset>
            <p style={{ fontSize: '0.75rem', color: '#666' }}>
              Disputes are reviewed within 48 hours. All decisions are final and recorded on-chain.
            </p>
          </div>
        )}

        {/* Footer */}
        <hr style={hr} />
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#999', padding: '0.5rem 0 2rem' }}>
          &copy; 2026 BountyNet &mdash; ETHGlobal Cannes
          <br />
          <a href="#" onClick={(e) => { e.preventDefault(); onBack() }} style={{ color: '#003366' }}>
            Switch to Agent Experience &raquo;
          </a>
        </div>
      </div>
    </div>
  )
}
