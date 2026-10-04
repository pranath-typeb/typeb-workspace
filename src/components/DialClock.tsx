import { useId, useRef } from 'react'

// A tactile two-dial clock in a dark pill: the red dial turns with the hour, the grey one with the
// minute (and glides with the seconds), with the time as small stacked digits beside them.

function useSweep(angle: number): { angle: number; animate: boolean } {
  // Let the hand glide forward, but jump (no transition) when it wraps past 360° so it never spins backwards.
  const prev = useRef(angle)
  const wrapped = angle < prev.current - 1
  prev.current = angle
  return { angle, animate: !wrapped }
}

function Dial({ angle, animate, tone }: { angle: number; animate: boolean; tone: 'red' | 'grey' }) {
  const id = useId().replace(/:/g, '')
  const face = tone === 'red' ? ['#ff6a5b', '#c4271d'] : ['#c4c7cd', '#7b7e85']
  const bezel = tone === 'red' ? '#5e0e09' : '#2f3135'
  return (
    <svg className={`dial ${tone}`} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <radialGradient id={`f${id}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={face[0]} />
          <stop offset="100%" stopColor={face[1]} />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={bezel} />
      <circle cx="24" cy="24" r="20.5" fill={`url(#f${id})`} />
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '24px 24px', transition: animate ? 'transform 0.6s cubic-bezier(0.3, 1.3, 0.5, 1)' : 'none' }}>
        <line x1="24" y1="24" x2="24" y2="8.5" stroke="#121212" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3.6" fill="#121212" />
        <circle cx="24" cy="24" r="1.3" fill="rgba(255,255,255,0.5)" />
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
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="dial-clock" role="timer" aria-label={`${pad(h)}:${pad(m)}, ${weekday} ${dayMonth}`}>
      <Dial angle={hour.angle} animate={hour.animate} tone="red" />
      <Dial angle={minute.angle} animate={minute.animate} tone="grey" />
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
