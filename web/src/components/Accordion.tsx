import { type ReactNode, useState } from 'react'
import { panelInner, font, tracking, palette } from './theme'

interface AccordionItem {
  id: string
  title: string
  content: ReactNode
  accent?: string
}

interface AccordionProps {
  items: AccordionItem[]
  multiple?: boolean
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map(item => {
        const open = openIds.has(item.id)
        const accent = item.accent || palette.accent

        return (
          <div key={item.id} style={{
            ...panelInner(),
            borderRadius: 6,
            borderLeft: open ? `2px solid ${accent}` : '2px solid transparent',
            overflow: 'hidden',
            transition: 'border-color 0.3s',
          }}>
            <button
              onClick={() => toggle(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.9rem 1.1rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: font.family,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: open ? accent : palette.textPrimary,
                letterSpacing: tracking.wider,
                textTransform: 'uppercase',
                textAlign: 'left',
                transition: 'color 0.2s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{
                  fontSize: '0.45rem',
                  color: accent,
                  transition: 'transform 0.3s',
                  transform: open ? 'scale(1.5)' : 'scale(1)',
                }}>&#x2B22;</span>
                {item.title}
              </span>
              <span style={{
                fontSize: '0.6rem',
                color: palette.textMuted,
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                &#9660;
              </span>
            </button>

            <div style={{
              maxHeight: open ? 600 : 0,
              opacity: open ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s',
            }}>
              <div style={{
                padding: '0 1.1rem 1.1rem 2rem',
                fontFamily: font.family,
                fontSize: '0.8rem',
                color: palette.textSecondary,
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
