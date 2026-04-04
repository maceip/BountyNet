/**
 * Live event feed — polls GET /events and shows real-time activity.
 * The heartbeat of the demo. Shows judges stuff is happening.
 */
import { useState, useEffect, useRef } from 'react'
import { palette, font, tracking, panelInner } from './theme'

const GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.stare.network'

const KIND_ICONS: Record<string, string> = {
  system: '\u2699',    // gear
  install: '\u2b22',   // hex
  scan: '\u26a1',      // lightning
  bounty: '\u25ce',    // circle
  oracle: '\u2b22',    // hex
  inference: '\u25b6',  // triangle
  pr: '\u21b3',        // arrow
  agent: '\u2b22',     // hex
}

const KIND_COLORS: Record<string, string> = {
  system: palette.textMuted,
  install: palette.green,
  scan: palette.amber,
  bounty: palette.accent,
  oracle: palette.accentDim,
  inference: palette.textSecondary,
  pr: palette.green,
  agent: palette.accent,
}

export function EventFeed({ maxItems = 15 }: { maxItems?: number }) {
  const [events, setEvents] = useState<any[]>([])
  const sinceRef = useRef(0)

  useEffect(() => {
    const poll = () => {
      fetch(`${GATEWAY}/events?since=${sinceRef.current}&limit=${maxItems}`)
        .then(r => r.json())
        .then(data => {
          const newEvents = data.events || []
          if (newEvents.length > 0) {
            sinceRef.current = newEvents[newEvents.length - 1].id
            setEvents(prev => [...prev, ...newEvents].slice(-maxItems))
          }
        })
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [maxItems])

  if (events.length === 0) return null

  return (
    <div style={{
      ...panelInner(),
      borderRadius: 6,
      padding: '0.5rem 0.75rem',
      maxHeight: 300,
      overflowY: 'auto',
    }}>
      {events.map((e, i) => {
        const age = Math.floor((Date.now() / 1000) - e.ts)
        const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`

        return (
          <div key={e.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.35rem 0',
            borderBottom: i < events.length - 1 ? `1px solid ${palette.border}` : 'none',
            animation: i >= events.length - 3 ? 'fadeUp 0.3s ease-out' : 'none',
          }}>
            <span style={{
              fontSize: '0.65rem',
              color: KIND_COLORS[e.kind] || palette.textMuted,
              flexShrink: 0,
              marginTop: 2,
            }}>
              {KIND_ICONS[e.kind] || '\u2022'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: font.family,
                fontSize: '0.7rem',
                color: palette.textPrimary,
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}>
                {e.message}
              </div>
              {e.repo && (
                <span style={{
                  fontFamily: font.mono,
                  fontSize: '0.58rem',
                  color: palette.textMuted,
                }}>
                  {e.repo}
                </span>
              )}
            </div>
            <span style={{
              fontFamily: font.mono,
              fontSize: '0.55rem',
              color: palette.textMuted,
              flexShrink: 0,
            }}>
              {ageStr}
            </span>
          </div>
        )
      })}
    </div>
  )
}
