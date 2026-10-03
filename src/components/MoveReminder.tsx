import { useEffect } from 'react'
import { CheckIcon, CloseIcon, FlameIcon, HeartPulseIcon } from './icons'
import { useFocusRun } from '../data/focus'
import {
  closeDone,
  dismissReminder,
  finishBreak,
  snoozeReminder,
  startGuidedBreak,
  startWellbeingEngine,
  useReminder,
  useWellbeingSettings,
  useWellbeingStats,
} from '../data/wellbeing'

function formatActive(min: number): string {
  if (min < 60) return `${min} minutes`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${h}h ${m}m`
}

// A soft, dismissible card — never a modal. It appears after a long stretch of continuous
// activity and offers a guided mini-stretch, a snooze, or a polite "not now".
export default function MoveReminder() {
  const r = useReminder()
  const settings = useWellbeingSettings()
  const stats = useWellbeingStats()
  const focus = useFocusRun()

  useEffect(() => {
    startWellbeingEngine(() => focusRef.running)
  }, [])
  focusRef.running = focus.status === 'running' && focus.phase === 'focus'

  if (r.phase === 'hidden') return null

  const total = r.suggestion.seconds
  const progress = r.phase === 'guided' ? 1 - r.guidedRemaining / total : 0
  const C = 2 * Math.PI * 34

  return (
    <div className="move-card" role="status" aria-live="polite">
      <button className="move-close" aria-label="Not now" onClick={r.phase === 'done' ? closeDone : dismissReminder}>
        <CloseIcon color="var(--color-text-secondary)" />
      </button>

      {r.phase === 'prompt' && (
        <>
          <div className="move-head">
            <span className="move-badge">
              <HeartPulseIcon size={16} color="var(--brand-text)" />
            </span>
            <div>
              <div className="move-title">Time to move</div>
              <div className="move-sub">You&apos;ve been going for {formatActive(r.activeMinutes)}</div>
            </div>
          </div>
          <div className="move-suggestion">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.suggestion.title}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {r.suggestion.blurb} · about {Math.max(1, Math.round(r.suggestion.seconds / 60))} min
            </div>
          </div>
          <div className="move-actions">
            <button className="btn-dark" style={{ flex: 1 }} onClick={startGuidedBreak}>
              Start guided stretch
            </button>
            <button className="btn-outline" onClick={snoozeReminder}>
              Snooze {settings.snoozeMin}m
            </button>
          </div>
          <button className="move-link" onClick={finishBreak}>
            I already took a break
          </button>
        </>
      )}

      {r.phase === 'guided' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="move-ring">
              <svg width="84" height="84" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r="34" fill="none" stroke="var(--color-border-default)" strokeWidth="6" />
                <circle
                  cx="42"
                  cy="42"
                  r="34"
                  fill="none"
                  stroke="var(--brand-mid)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - progress)}
                  transform="rotate(-90 42 42)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="mono move-ring-time">{r.guidedRemaining}s</span>
              <span className="move-breathe" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="move-title">{r.suggestion.title}</div>
              <div className="move-sub">Follow along — you&apos;ve got this</div>
            </div>
          </div>
          <ol className="move-steps">
            {r.suggestion.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="move-actions">
            <button className="btn-dark" style={{ flex: 1 }} onClick={finishBreak}>
              <CheckIcon size={14} color="var(--color-text-inverse)" /> Done
            </button>
          </div>
        </>
      )}

      {r.phase === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
          <span className="move-badge move-badge-done">
            <CheckIcon size={18} color="#fff" />
          </span>
          <div>
            <div className="move-title">Nice work — back to it</div>
            <div className="move-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlameIcon size={13} color="var(--warn-fg)" />
              {stats.streak > 1 ? `${stats.streak}-day movement streak` : `${stats.today} move ${stats.today === 1 ? 'break' : 'breaks'} today`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Lets the engine ask "is a focus session running?" without importing the focus store into it.
const focusRef = { running: false }
