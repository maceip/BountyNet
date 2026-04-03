import { type ReactNode, useState } from 'react'
import { glassInner, font, tracking, palette } from './theme'

interface AccordionItem {
  id: string
  title: string
  content: ReactNode
  accent?: string
}

interface AccordionProps {
  items: AccordionItem[]
  multiple?: boolean  // allow multiple open
}

export function Accordion({ items, multiple = false }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(multiple ? prev : [])
      if (prev.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map(item => {
        const open = openIds.has(item.id)
        const accent = item.accent || palette.lavender

        return (
          <div key={item.id} style={{ ...glassInner(open ? 0.4 : 0.25), borderRadius: 14, overflow: 'hidden', transition: 'background 0.3s' }}>
            {/* Trigger */}
            <button
              onClick={() => toggle(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: font.family,
                fontSize: '0.8rem',
                fontWeight: 500,
                color: palette.ink,
                letterSpacing: tracking.wider,
                textTransform: 'uppercase',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: accent,
                  flexShrink: 0,
                  transition: 'transform 0.3s',
                  transform: open ? 'scale(1.6)' : 'scale(1)',
                }} />
                {item.title}
              </span>
              <span style={{
                fontSize: '0.65rem',
                color: palette.inkMuted,
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                &#9660;
              </span>
            </button>

            {/* Panel */}
            <div style={{
              maxHeight: open ? 600 : 0,
              opacity: open ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s',
            }}>
              <div style={{
                padding: '0 1.25rem 1.25rem 2.25rem',
                fontFamily: font.family,
                fontSize: '0.85rem',
                color: palette.inkLight,
                letterSpacing: tracking.normal,
                lineHeight: 1.7,
              }}>
                {item.content}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
