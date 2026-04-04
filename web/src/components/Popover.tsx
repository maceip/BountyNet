import { type ReactNode, useState, useRef, useEffect } from 'react'
import { panel, font, tracking, palette } from './theme'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'center' | 'right'
  accent?: string
}

export function Popover({ trigger, children, align = 'left', accent = palette.cyan }: PopoverProps) {
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
          marginTop: 8,
          ...panel(true),
          borderRadius: 8,
          borderTop: `2px solid ${accent}`,
          padding: '1.1rem',
          minWidth: 240,
          maxWidth: 360,
          zIndex: 100,
          animation: 'popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: font.family,
          fontSize: '0.8rem',
          color: palette.textPrimary,
          letterSpacing: tracking.normal,
          lineHeight: 1.7,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
