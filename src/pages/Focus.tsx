import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeftIcon,
  ExpandIcon,
  FlameIcon,
  HeartPulseIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  SkipIcon,
  TargetIcon,
  VolumeIcon,
  CloseIcon,
} from '../components/icons'
import { Select } from '../components/SearchableSelect'
import Toggle from '../components/Toggle'
import { CURRENT_USER_ID } from '../data/people'
import { useProjects } from '../data/projects'
import { todayLocal, useTimeEntries } from '../data/timeEntries'
import { SOUNDS } from '../data/ambient'
import {
  PRESETS,
  applyPreset,
  focusStreak,
  formatClock,
  lastSevenDays,
  minutesOn,
  pauseFocus,
  resetFocus,
  resumeFocus,
  sessionsOn,
  setFocusProject,
  setFocusTask,
  setPhase,
  skipPhase,
  startFocus,
  toggleAmbientSound,
  updateFocusSettings,
  useAmbientPlaying,
  useFocusHistory,
  useFocusRun,
  useFocusSettings,
  type FocusRun,
  type Phase,
} from '../data/focus'
import { previewReminder, updateWellbeingSettings, useWellbeingSettings, useWellbeingStats } from '../data/wellbeing'

const PHASES: Array<{ key: Phase; label: string }> = [
  { key: 'focus', label: 'Focus' },
  { key: 'short', label: 'Short break' },
  { key: 'long', label: 'Long break' },
]

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function Ring({ run, size, stroke }: { run: FocusRun; size: number; stroke: number }) {
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const progress = run.totalSec > 0 ? 1 - run.remainingSec / run.totalSec : 0
  const isBreak = run.phase !== 'focus'
  return (
    <div className={`focus-ring${run.status === 'running' ? ' running' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border-default)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isBreak ? 'var(--brand-bar)' : 'var(--brand-mid)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s linear' }}
        />
      </svg>
      <div className="focus-ring-center">
        <div className="mono focus-time" style={{ fontSize: size * 0.2 }}>{formatClock(run.remainingSec)}</div>
        <div className="focus-phase-label">{run.phase === 'focus' ? 'Focus' : run.phase === 'short' ? 'Short break' : 'Long break'}</div>
      </div>
    </div>
  )
}

function Controls({ run, large }: { run: FocusRun; large?: boolean }) {
  const isRunning = run.status === 'running'
  const started = run.status !== 'idle'
  return (
    <div className="focus-controls">
      <button className="focus-ctl" aria-label="Reset" title="Reset" onClick={resetFocus} disabled={!started && run.remainingSec === run.totalSec}>
        <ResetIcon size={18} color="currentColor" />
      </button>
      <button
        className={`focus-main-btn${large ? ' large' : ''}`}
        onClick={() => (isRunning ? pauseFocus() : run.status === 'paused' ? resumeFocus() : startFocus())}
      >
        {isRunning ? <PauseIcon size={18} color="currentColor" /> : <PlayIcon size={18} color="currentColor" />}
        {isRunning ? 'Pause' : run.status === 'paused' ? 'Resume' : run.phase === 'focus' ? 'Start focus' : 'Start break'}
      </button>
      <button className="focus-ctl" aria-label="Skip to next phase" title="Skip" onClick={skipPhase}>
        <SkipIcon size={18} color="currentColor" />
      </button>
    </div>
  )
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="focus-stepper">
      <span>{label}</span>
      <div>
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 5 > min ? value - 5 : min))} disabled={value <= min}>
          −
        </button>
        <span className="mono">{value}m</span>
        <button aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 5))} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  )
}

export default function Focus() {
  const run = useFocusRun()
  const settings = useFocusSettings()
  const history = useFocusHistory()
  const projects = useProjects()
  const entries = useTimeEntries()
  const wb = useWellbeingSettings()
  const wbStats = useWellbeingStats()
  const [deep, setDeep] = useState(false)
  const soundPlaying = useAmbientPlaying()

  const today = todayLocal()
  const todayMin = minutesOn(history, today)
  const todaySessions = sessionsOn(history, today)
  const streak = focusStreak(history)
  const week = useMemo(() => lastSevenDays(history), [history])
  const weekMax = Math.max(30, ...week.map((d) => d.minutes))

  const recentTasks = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ description: string; projectId: string }> = []
    for (const e of entries) {
      if (e.personId !== CURRENT_USER_ID || !e.description || seen.has(e.description)) continue
      seen.add(e.description)
      out.push({ description: e.description, projectId: e.projectId ?? '' })
      if (out.length >= 4) break
    }
    return out
  }, [entries])

  const locked = run.status === 'running'

  return (
    <section className="stage">
      <div className="canvas">
        <div className="topbar">
          <div className="topbar-app">
            <TargetIcon size={16} color="var(--color-text-secondary)" />
            <span className="topbar-app-label">Focus</span>
          </div>
          <Link to="/" style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close">
            <ChevronLeftIcon color="var(--color-text-secondary)" />
          </Link>
        </div>

        <div style={{ padding: '24px 24px 140px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div className="page-title" style={{ border: 'none', paddingBottom: 0 }}>Focus</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>Pick a task, press start, and let the rest fade away.</div>
          </div>

          <div className="focus-layout">
            {/* ---- timer ---- */}
            <div className="card focus-hero">
              <div className="focus-seg" role="tablist" aria-label="Session type">
                {PHASES.map((p) => (
                  <button key={p.key} role="tab" aria-selected={run.phase === p.key} className={run.phase === p.key ? 'active' : ''} disabled={locked} onClick={() => setPhase(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <Ring run={run} size={260} stroke={12} />

              <div className="focus-dots" aria-label={`${run.cycle} of ${settings.longEvery} sessions this round`}>
                {Array.from({ length: settings.longEvery }).map((_, i) => (
                  <span key={i} className={i < run.cycle ? 'on' : ''} />
                ))}
              </div>

              <Controls run={run} large />

              <div className="focus-task">
                <div className="field-label">Working on</div>
                <input
                  className="input"
                  placeholder="What will you focus on?"
                  value={run.task}
                  onChange={(e) => setFocusTask(e.target.value)}
                />
                <div style={{ marginTop: 8 }}>
                  <Select
                    value={run.projectId}
                    onChange={(e) => setFocusProject(e.target.value)}
                    placeholder="Select project (optional)"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                {recentTasks.length > 0 && (
                  <div className="focus-chips scroll-x">
                    {recentTasks.map((t) => (
                      <button
                        key={t.description}
                        onClick={() => {
                          setFocusTask(t.description)
                          setFocusProject(t.projectId)
                        }}
                      >
                        {t.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="btn-outline" style={{ alignSelf: 'center' }} onClick={() => setDeep(true)}>
                <ExpandIcon size={14} color="var(--color-text-primary)" /> Deep focus mode
              </button>
            </div>

            {/* ---- side column ---- */}
            <div className="focus-side">
              <div className="card">
                <div className="focus-card-title" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <VolumeIcon size={16} color="var(--color-text-secondary)" /> Background sound
                  </span>
                  <button
                    className={`focus-sound-toggle${soundPlaying ? ' on' : ''}`}
                    onClick={toggleAmbientSound}
                    disabled={settings.sound === 'off'}
                    aria-pressed={soundPlaying}
                  >
                    <span className="dot" /> {soundPlaying ? 'Playing' : 'Play'}
                  </button>
                </div>
                <div className="focus-sounds">
                  {SOUNDS.map((s) => (
                    <button
                      key={s.key}
                      className={`focus-sound${settings.sound === s.key ? ' active' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
                      onClick={() => updateFocusSettings({ sound: s.key })}
                      aria-pressed={settings.sound === s.key}
                    >
                      <span className="focus-sound-name">{s.label}</span>
                      <span className="focus-sound-desc">{s.description}</span>
                    </button>
                  ))}
                </div>
                <div className="focus-volume">
                  <VolumeIcon size={14} color="var(--color-text-tertiary)" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.volume}
                    onChange={(e) => updateFocusSettings({ volume: Number(e.target.value) })}
                    aria-label="Volume"
                  />
                  <span className="mono" style={{ width: 34, textAlign: 'right', fontSize: 12, color: 'var(--color-text-secondary)' }}>{Math.round(settings.volume * 100)}%</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 6 }}>Tap a sound to hear it. It keeps playing through focus sessions and fades out for breaks.</div>
              </div>

              <div className="card">
                <div className="focus-card-title">Today</div>
                <div className="focus-stats">
                  <div>
                    <div className="mono focus-stat-value">{fmtMinutes(todayMin)}</div>
                    <div className="focus-stat-label">focused</div>
                  </div>
                  <div>
                    <div className="mono focus-stat-value">{todaySessions.length}</div>
                    <div className="focus-stat-label">sessions</div>
                  </div>
                  <div>
                    <div className="mono focus-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FlameIcon size={16} color={streak > 0 ? 'var(--warn-fg)' : 'var(--color-text-tertiary)'} />
                      {streak}
                    </div>
                    <div className="focus-stat-label">day streak</div>
                  </div>
                </div>
                <div className="focus-week">
                  {week.map((d) => (
                    <div key={d.date} className={d.today ? 'today' : ''} title={`${fmtMinutes(d.minutes)} focused`}>
                      <div className="bar">
                        <span style={{ height: `${Math.max(d.minutes > 0 ? 8 : 0, (d.minutes / weekMax) * 100)}%` }} />
                      </div>
                      <small>{d.label}</small>
                    </div>
                  ))}
                </div>
                {todaySessions.length > 0 && (
                  <div className="focus-log">
                    {todaySessions.slice(0, 4).map((s) => (
                      <div key={s.id}>
                        <span>{s.task || 'Focus session'}</span>
                        <span className="mono">{s.minutes}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="focus-card-title">Session length{locked && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)' }}>applies to the next session</span>}</div>
                <div className="focus-chips scroll-x" style={{ marginTop: 0 }}>
                  {PRESETS.map((p) => {
                    const on = p.focusMin === settings.focusMin && p.shortMin === settings.shortMin && p.longMin === settings.longMin
                    return (
                      <button key={p.label} className={on ? 'active' : ''} onClick={() => applyPreset(p)}>
                        {p.label} <span className="mono">{p.focusMin}/{p.shortMin}</span>
                      </button>
                    )
                  })}
                </div>
                <Stepper label="Focus" value={settings.focusMin} min={5} max={120} onChange={(v) => updateFocusSettings({ focusMin: v })} />
                <Stepper label="Short break" value={settings.shortMin} min={1} max={30} onChange={(v) => updateFocusSettings({ shortMin: v })} />
                <Stepper label="Long break" value={settings.longMin} min={5} max={60} onChange={(v) => updateFocusSettings({ longMin: v })} />
                <div className="focus-row">
                  <div>
                    <div className="focus-row-title">Auto-start next session</div>
                    <div className="focus-row-sub">Flow straight from focus into break and back</div>
                  </div>
                  <Toggle label="Auto-start next session" checked={settings.autoStartNext} onChange={(v) => updateFocusSettings({ autoStartNext: v })} />
                </div>
                <div className="focus-row">
                  <div>
                    <div className="focus-row-title">Log to my timesheet</div>
                    <div className="focus-row-sub">Completed focus sessions become time entries</div>
                  </div>
                  <Toggle label="Log to my timesheet" checked={settings.logToTimesheet} onChange={(v) => updateFocusSettings({ logToTimesheet: v })} />
                </div>
              </div>

              <div className="card">
                <div className="focus-card-title">
                  <HeartPulseIcon size={16} color="var(--color-text-secondary)" /> Movement reminders
                </div>
                <div className="focus-row">
                  <div>
                    <div className="focus-row-title">Remind me to move</div>
                    <div className="focus-row-sub">A gentle nudge to stretch after long stretches at the screen</div>
                  </div>
                  <Toggle label="Remind me to move" checked={wb.enabled} onChange={(v) => updateWellbeingSettings({ enabled: v })} />
                </div>
                {wb.enabled && (
                  <>
                    <div className="focus-row">
                      <div className="focus-row-title">Remind me after</div>
                      <div style={{ width: 150 }}>
                        <Select value={String(wb.intervalMin)} onChange={(e) => updateWellbeingSettings({ intervalMin: Number(e.target.value) })}>
                          <option value="30">30 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="90">1.5 hours</option>
                          <option value="120">2 hours</option>
                          <option value="180">3 hours</option>
                        </Select>
                      </div>
                    </div>
                    <div className="focus-row">
                      <div>
                        <div className="focus-row-title">Wait for my focus session to end</div>
                        <div className="focus-row-sub">Never interrupt deep work</div>
                      </div>
                      <Toggle label="Wait for focus session to end" checked={wb.pauseDuringFocus} onChange={(v) => updateWellbeingSettings({ pauseDuringFocus: v })} />
                    </div>
                  </>
                )}
                <div className="focus-row" style={{ alignItems: 'center' }}>
                  <div className="focus-row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FlameIcon size={13} color={wbStats.streak > 0 ? 'var(--warn-fg)' : 'var(--color-text-tertiary)'} />
                    {wbStats.streak > 0 ? `${wbStats.streak}-day streak` : 'No streak yet'} · {wbStats.today} today
                  </div>
                  <button className="btn-outline" onClick={previewReminder}>Preview</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deep && (
        <div className="focus-deep" role="dialog" aria-label="Deep focus mode">
          <button className="focus-deep-close" aria-label="Exit deep focus" onClick={() => setDeep(false)}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
          <div className="focus-deep-task">{run.task || 'Deep focus'}</div>
          <Ring run={run} size={Math.min(360, typeof window === 'undefined' ? 320 : window.innerWidth - 64)} stroke={14} />
          <Controls run={run} large />
          <div className="focus-deep-sounds scroll-x">
            {SOUNDS.map((s) => (
              <button key={s.key} className={settings.sound === s.key ? 'active' : ''} onClick={() => updateFocusSettings({ sound: s.key })}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
