import { type ReactNode, useState } from 'react'
import { glass, font, tracking, palette } from './theme'

interface CardProps {
  title: string
  accent?: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

export function Card({ title, accent = palette.teal, children, collapsible, defaultOpen = true }: CardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{
      ...glass(),
      borderRadius: 20,
      borderLeft: `3px solid ${accent}`,
      overflow: 'hidden',
      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px) scale(1.005)'
        e.currentTarget.style.boxShadow = '0 16px 48px rgba(26,26,42,0.12), 0 2px 6px rgba(26,26,42,0.06)'
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
          padding: '1.25rem 1.5rem',
          paddingBottom: open ? '0.5rem' : '1.25rem',
          cursor: collapsible ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: font.family,
          fontSize: '0.7rem',
          fontWeight: 600,
          color: accent,
          textTransform: 'uppercase',
          letterSpacing: tracking.widest,
        }}>
          {title}
        </span>
        {collapsible && (
          <span style={{
            color: accent,
            fontSize: '0.75rem',
            transition: 'transform 0.3s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            letterSpacing: tracking.normal,
          }}>
            &#9660;
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{
        padding: open ? '0 1.5rem 1.5rem' : '0 1.5rem',
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
