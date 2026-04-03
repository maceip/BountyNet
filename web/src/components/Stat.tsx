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
      opacity: sub ? 0.45 : 1,
    }}>
      <span style={{
        fontFamily: font.family,
        fontSize: sub ? '0.7rem' : '0.75rem',
        fontWeight: 500,
        color: palette.inkMuted,
        letterSpacing: tracking.wider,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: mono ? font.mono : font.family,
        fontSize: big ? '1.6rem' : mono ? '0.72rem' : sub ? '0.75rem' : '0.88rem',
        fontWeight: big ? 300 : 400,
        color: big && accent ? accent : big ? palette.ink : '#333',
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
