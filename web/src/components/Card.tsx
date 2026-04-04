import { type ReactNode, useState } from 'react'
import { panel, font, tracking, palette } from './theme'

interface CardProps {
  title: string
  accent?: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

export function Card({ title, accent, children, collapsible, defaultOpen = true }: CardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const a = accent || palette.accent

  return (
    <div style={{
      ...panel(true),
      borderRadius: 8,
      borderLeft: `3px solid ${a}`,
      overflow: 'hidden',
      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 0 24px ${palette.accentGlow}, 0 16px 48px rgba(0, 0, 0, 0.1)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Header */}
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          padding: '1.1rem 1.4rem',
          paddingBottom: open ? '0.4rem' : '1.1rem',
          cursor: collapsible ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: font.family,
          fontSize: '0.68rem',
          fontWeight: 700,
          color: a,
          textTransform: 'uppercase',
          letterSpacing: tracking.widest,
        }}>
          <span style={{ marginRight: '0.5rem', fontSize: '0.5rem' }}>&#x2B22;</span>
          {title}
        </span>
        {collapsible && (
          <span style={{
            color: a,
            fontSize: '0.65rem',
            transition: 'transform 0.3s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            &#9660;
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{
        padding: open ? '0 1.4rem 1.4rem' : '0 1.4rem',
        maxHeight: open ? 800 : 0,
        opacity: open ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s, padding 0.3s',
      }}>
        {children}
      </div>
    </div>
  )
}
