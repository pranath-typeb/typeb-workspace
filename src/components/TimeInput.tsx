import { useEffect, useState, type CSSProperties } from 'react'

interface TimeInputProps {
  label: string
  value: string // 24-hour "HH:MM"
  onChange: (value: string) => void
}

function clampHour12(n: number): number {
  if (Number.isNaN(n)) return 12
  return Math.min(12, Math.max(1, n))
}

function clampMinute(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(59, Math.max(0, n))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function to24Hour(h12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = h12 % 12
  if (period === 'PM') h += 12
  return `${pad(h)}:${pad(minute)}`
}

// A three-segment "12 : 00 AM" time field the user can type digits directly into,
// instead of the native browser time picker — matches the Figma Start/End field design.
export default function TimeInput({ label, value, onChange }: TimeInputProps) {
  const [h24, m] = value.split(':').map(Number)
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12

  const [hourText, setHourText] = useState(pad(h12))
  const [minuteText, setMinuteText] = useState(pad(m))
  const [hourFocused, setHourFocused] = useState(false)
  const [minuteFocused, setMinuteFocused] = useState(false)

  useEffect(() => {
    if (!hourFocused) setHourText(pad(h12))
  }, [h12, hourFocused])

  useEffect(() => {
    if (!minuteFocused) setMinuteText(pad(m))
  }, [m, minuteFocused])

  function commitHour(text: string) {
    const next = clampHour12(Number(text.replace(/\D/g, '')))
    setHourText(pad(next))
    onChange(to24Hour(next, m, period))
  }

  function commitMinute(text: string) {
    const next = clampMinute(Number(text.replace(/\D/g, '')))
    setMinuteText(pad(next))
    onChange(to24Hour(h12, next, period))
  }

  const segmentStyle: CSSProperties = {
    width: 32,
    height: '100%',
    textAlign: 'center',
    background: 'var(--color-background-muted)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontFamily: "'Manrope', sans-serif",
  }

  return (
    <div>
      <div className="field-label">{label}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 36,
          background: 'var(--color-background-page)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 10,
          padding: 4,
        }}
      >
        <input
          style={segmentStyle}
          value={hourText}
          maxLength={2}
          inputMode="numeric"
          aria-label={`${label} hour`}
          onFocus={(e) => {
            setHourFocused(true)
            e.target.select()
          }}
          onChange={(e) => setHourText(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={(e) => {
            setHourFocused(false)
            commitHour(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>:</span>
        <input
          style={segmentStyle}
          value={minuteText}
          maxLength={2}
          inputMode="numeric"
          aria-label={`${label} minute`}
          onFocus={(e) => {
            setMinuteFocused(true)
            e.target.select()
          }}
          onChange={(e) => setMinuteText(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={(e) => {
            setMinuteFocused(false)
            commitMinute(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <button
          type="button"
          aria-label={`${label} AM/PM`}
          onClick={() => onChange(to24Hour(h12, m, period === 'AM' ? 'PM' : 'AM'))}
          style={{ ...segmentStyle, cursor: 'pointer', fontWeight: 600 }}
        >
          {period}
        </button>
      </div>
    </div>
  )
}
