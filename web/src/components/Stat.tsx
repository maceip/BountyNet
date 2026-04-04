import { font, tracking, palette } from './theme'

interface StatProps {
  label: string
  value: string
  mono?: boolean
  sub?: boolean
  big?: boolean
  accent?: string
}

export function Stat({ label, value, mono, sub, big, accent }: StatProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '0.35rem 0',
      opacity: sub ? 0.5 : 1,
    }}>
      <span style={{
        fontFamily: font.family,
        fontSize: sub ? '0.65rem' : '0.7rem',
        fontWeight: 600,
        color: palette.textMuted,
        letterSpacing: tracking.wider,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? font.mono : font.family,
        fontSize: big ? '1.5rem' : mono ? '0.68rem' : sub ? '0.72rem' : '0.85rem',
        fontWeight: big ? 300 : 500,
        color: big && accent ? accent : big ? palette.accent : palette.textPrimary,
        letterSpacing: big ? tracking.wider : mono ? '0' : tracking.normal,
        wordBreak: 'break-all',
        textAlign: 'right',
        maxWidth: '62%',
      }}>
        {value}
      </span>
    </div>
  )
}
