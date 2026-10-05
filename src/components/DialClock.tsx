import { useRef } from 'react'

// A tactile three-dial clock in a dark pill: the orange dial turns with the hour, the white one with the
// minute (and glides with the seconds), and the teal one ticks the seconds, with the time as small stacked digits beside them.

function useSweep(angle: number): { angle: number; animate: boolean } {
  // Let the hand glide forward, but jump (no transition) when it wraps past 360° so it never spins backwards.
  const prev = useRef(angle)
  const wrapped = angle < prev.current - 1
  prev.current = angle
  return { angle, animate: !wrapped }
}

const FACES = { orange: '#ff6d33', white: '#f5f5f5', teal: '#2aa39d' } as const

function Dial({ angle, animate, tone, quick }: { angle: number; animate: boolean; tone: keyof typeof FACES; quick?: boolean }) {
  const face = FACES[tone]
  return (
    <svg className={`dial ${tone}`} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="23" fill={face} />
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '24px 24px', transition: animate ? (quick ? 'transform 0.25s ease-out' : 'transform 0.6s cubic-bezier(0.3, 1.3, 0.5, 1)') : 'none' }}>
        <line x1="24" y1="24" x2="24" y2="8" stroke="#121212" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export default function DialClock({ now, weekday, dayMonth }: { now: Date; weekday: string; dayMonth: string }) {
  const h = now.getHours()
  const m = now.getMinutes()
  const s = now.getSeconds()
  const hour = useSweep((h % 12) * 30 + m * 0.5)
  const minute = useSweep(m * 6 + s * 0.1)
  const second = useSweep(s * 6)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="dial-clock" role="timer" aria-label={`${pad(h)}:${pad(m)}, ${weekday} ${dayMonth}`}>
      <Dial angle={hour.angle} animate={hour.animate} tone="orange" />
      <Dial angle={minute.angle} animate={minute.animate} tone="white" />
      <Dial angle={second.angle} animate={second.animate} tone="teal" quick />
      <div className="dial-digits home-clock" aria-hidden>
        <span>{pad(h)}</span>
        <span>{pad(m)}</span>
      </div>
      <div className="dial-date" aria-hidden>
        <span>{weekday}</span>
        <span>{dayMonth}</span>
      </div>
    </div>
  )
}
