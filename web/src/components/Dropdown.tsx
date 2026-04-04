import { useState, useRef, useEffect } from 'react'
import { panel, panelInner, font, tracking, palette } from './theme'

interface DropdownOption {
  value: string
  label: string
  icon?: string
}

interface DropdownProps {
  label: string
  options: DropdownOption[]
  value?: string
  onChange?: (value: string) => void
  accent?: string
}

export function Dropdown({ label, options, value, onChange, accent = palette.cyan }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth: 200 }}>
      {/* Label */}
      <div style={{
        fontFamily: font.family,
        fontSize: '0.58rem',
        fontWeight: 700,
        color: accent,
        textTransform: 'uppercase',
        letterSpacing: tracking.ultra,
        marginBottom: '0.35rem',
      }}>
        {label}
      </div>

      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.7rem 1rem',
          ...panelInner(),
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: font.family,
          fontSize: '0.8rem',
          color: palette.textPrimary,
          letterSpacing: tracking.wide,
          textAlign: 'left',
        }}
      >
        <span>{selected?.icon ? `${selected.icon} ` : ''}{selected?.label || 'Select...'}</span>
        <span style={{
          fontSize: '0.55rem',
          color: palette.textMuted,
          transition: 'transform 0.25s',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
        }}>&#9660;</span>
      </button>

      {/* Menu */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          ...panel(true),
          borderRadius: 6,
          padding: '0.3rem',
          zIndex: 100,
          animation: 'dropIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange?.(opt.value); setOpen(false) }}
              style={{
                width: '100%',
                display: 'block',
                padding: '0.55rem 0.75rem',
                border: 'none',
                borderRadius: 4,
                background: opt.value === value ? `${accent}18` : 'transparent',
                cursor: 'pointer',
                fontFamily: font.family,
                fontSize: '0.78rem',
                color: opt.value === value ? accent : palette.textPrimary,
                letterSpacing: tracking.wide,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = palette.navyMid }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {opt.icon ? `${opt.icon}  ` : ''}{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
