import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FlameIcon, FootprintsIcon, HeartPulseIcon, PauseIcon, PlayIcon, TargetIcon, TrophyIcon } from './icons'
import { CURRENT_USER_ID } from '../data/people'
import { todayLocal } from '../data/timeEntries'
import { PRESETS, applyPreset, focusStreak, formatClock, minutesOn, pauseFocus, resumeFocus, startFocus, useFocusHistory, useFocusRun } from '../data/focus'
import { isJoined, standings, statusOf, stepsFor, useChallengeState } from '../data/challenges'
import { activeMinutesNow, previewReminder, startGuidedBreak, useWellbeingSettings, useWellbeingStats } from '../data/wellbeing'

const nf = new Intl.NumberFormat('en-US')

function fmtMin(m: number): string {
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// Icon inside a progress ring.
function RingIcon({ pct, color, children }: { pct: number; color: string; children: ReactNode }) {
  const size = 48
  const r = 20
  const C = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-border-default)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(1, Math.max(0, pct)))}
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

function Row({ ring, title, sub, action, to }: { ring: ReactNode; title: ReactNode; sub: ReactNode; action: ReactNode; to: string }) {
  return (
    <div className="dash-well-row">
      {ring}
      <Link to={to} className="dash-well-text">
        <div className="dash-well-title">{title}</div>
        <div className="dash-well-sub">{sub}</div>
      </Link>
      <div className="dash-well-action">{action}</div>
    </div>
  )
}

// Dashboard card: the focus / step challenge / movement features as three scannable rows.
export default function WellbeingRow() {
  const run = useFocusRun()
  const history = useFocusHistory()
  const { challenges, store } = useChallengeState()
  const wb = useWellbeingSettings()
  const stats = useWellbeingStats()
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const today = todayLocal()
  const focusMin = minutesOn(history, today)
  const streak = focusStreak(history)
  const running = run.status === 'running'
  const active = challenges.find((c) => statusOf(c) === 'active' && isJoined(c)) ?? challenges.find((c) => statusOf(c) === 'active')
  const rows = useMemo(() => (active ? standings(active) : []), [active, store])
  const me = rows.find((r) => r.personId === CURRENT_USER_ID)
  const mySteps = stepsFor(CURRENT_USER_ID, today)
  const activeMin = activeMinutesNow()
  const movePct = wb.enabled ? activeMin / wb.intervalMin : 0

  return (
    <div className="card dash-well">
      {/* Focus */}
      <Row
        to="/focus"
        ring={
          <RingIcon pct={run.status === 'idle' ? Math.min(1, focusMin / 120) : 1 - run.remainingSec / run.totalSec} color="var(--brand-mid)">
            <TargetIcon size={16} color="var(--color-text-secondary)" />
          </RingIcon>
        }
        title={run.status === 'idle' ? 'Focus' : <span className="mono">{formatClock(run.remainingSec)}</span>}
        sub={
          run.status === 'idle' ? (
            <>
              {fmtMin(focusMin)} focused today
              {streak > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8 }}>
                  <FlameIcon size={12} color="var(--warn-fg)" /> {streak}d
                </span>
              )}
            </>
          ) : run.phase === 'focus' ? (
            run.task || 'Focus session'
          ) : (
            'On a break'
          )
        }
        action={
          run.status === 'idle' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESETS.slice(0, 2).map((p) => (
                <button
                  key={p.label}
                  className="btn-outline"
                  onClick={() => {
                    applyPreset(p)
                    startFocus()
                  }}
                >
                  <PlayIcon size={10} color="var(--color-text-primary)" /> {p.focusMin}m
                </button>
              ))}
            </div>
          ) : (
            <button className="btn-dark" onClick={() => (running ? pauseFocus() : resumeFocus())}>
              {running ? <PauseIcon size={12} color="var(--color-text-inverse)" /> : <PlayIcon size={11} color="var(--color-text-inverse)" />} {running ? 'Pause' : 'Resume'}
            </button>
          )
        }
      />

      {/* Step challenge */}
      <Row
        to="/challenges"
        ring={
          <RingIcon pct={mySteps / store.dailyGoal} color="var(--brand-mid)">
            {active ? <FootprintsIcon size={16} color="var(--color-text-secondary)" /> : <TrophyIcon size={16} color="var(--color-text-secondary)" />}
          </RingIcon>
        }
        title={active ? active.title : 'Step challenge'}
        sub={
          !active
            ? 'Nothing running this week'
            : !store.provider
              ? 'Connect a health app to track steps automatically'
              : isJoined(active) && me
                ? `You're #${me.rank} of ${rows.length} · ${nf.format(mySteps)} steps today`
                : `${rows.length} people competing`
        }
        action={
          active && !store.provider ? (
            <Link to="/challenges#step-source" className="btn-outline">Connect</Link>
          ) : (
            <Link to="/challenges" className="btn-outline">
              {active ? (isJoined(active) ? 'Leaderboard' : 'Join') : 'Start one'}
            </Link>
          )
        }
      />

      {/* Movement */}
      <Row
        to="/focus"
        ring={
          <RingIcon pct={movePct} color={movePct > 0.8 ? 'var(--warn-fg)' : 'var(--brand-mid)'}>
            <HeartPulseIcon size={16} color="var(--color-text-secondary)" />
          </RingIcon>
        }
        title={wb.enabled ? `Stretch reminder in ${fmtMin(Math.max(0, wb.intervalMin - activeMin))}` : 'Move reminders are off'}
        sub={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <FlameIcon size={12} color={stats.streak > 0 ? 'var(--warn-fg)' : 'var(--color-text-tertiary)'} />
            {stats.streak > 0 ? `${stats.streak}-day streak` : 'No streak yet'} · {stats.today} today
          </span>
        }
        action={
          <button
            className="btn-outline"
            onClick={() => {
              previewReminder()
              startGuidedBreak()
            }}
          >
            Stretch now
          </button>
        }
      />
    </div>
  )
}
