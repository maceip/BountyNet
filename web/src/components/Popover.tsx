import { type ReactNode, useState, useRef, useEffect } from 'react'
import { glass, font, tracking, palette } from './theme'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'center' | 'right'
  accent?: string
}

export function Popover({ trigger, children, align = 'left', accent = palette.mauve }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const alignStyle: React.CSSProperties =
    align === 'right' ? { right: 0 } :
    align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } :
    { left: 0 }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          ...alignStyle,
          marginTop: 10,
          ...glass(0.88, 28),
          borderRadius: 18,
          borderTop: `2px solid ${accent}50`,
          padding: '1.25rem',
          minWidth: 240,
          maxWidth: 360,
          zIndex: 100,
          animation: 'popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: font.family,
          fontSize: '0.85rem',
          color: palette.ink,
          letterSpacing: tracking.normal,
          lineHeight: 1.7,
        }}>
          {/* Arrow nub */}
          <div style={{
            position: 'absolute',
            top: -6,
            left: align === 'right' ? undefined : align === 'center' ? 'calc(50% - 6px)' : 20,
            right: align === 'right' ? 20 : undefined,
            width: 12,
            height: 12,
            background: 'rgba(255,255,255,0.88)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderBottom: 'none',
            borderRight: 'none',
            transform: 'rotate(45deg)',
          }} />
          {children}
        </div>
      )}
    </div>
  )
}
