import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useLeaveRequests, PTO_TOTAL_ACCRUED, PTO_TOTAL_USED } from '../data/leave'
import {
  upcomingEvents,
  whoIsOff,
  weeklyHoursWorked,
  weeklyHoursTarget,
  weeklyBehindLabel,
  weekSummaries,
} from '../data/dashboard'
import { CURRENT_USER_ID } from '../data/people'
import { addDays, categoryColor, minutesForPersonDate, projectLabel, todayLocal, useTimeEntries, weekStartFor, type TimeEntry } from '../data/timeEntries'
import { startTimer, toggleTimerRunning, useTimerState } from '../data/timer'
import { AlertFileIcon, CakeIcon, ChevronRightIcon, FlagIcon, PlayIcon, StopIcon, TimerActivityIcon } from '../components/icons'
import { avatarContent } from '../components/Avatar'

const DAILY_TARGET_MINUTES = 480

interface RecentTask {
  description: string
  category: string
  projectId: string | null
}

interface RecentWorkGroup {
  projectId: string | null
  project: string
  tasksInProgress: number
  tasks: RecentTask[]
}

// The most recently logged tasks, grouped by project — so you can pick up where you left
// off. Sorted by most recent first; within a project, distinct task descriptions only (the
// latest occurrence wins for its category), capped so the card doesn't run on forever.
function recentWorkGroups(entries: TimeEntry[]): RecentWorkGroup[] {
  const mine = entries
    .filter((e) => e.personId === CURRENT_USER_ID)
    .slice()
    .sort((a, b) => (a.date === b.date ? (b.startMinutes ?? 0) - (a.startMinutes ?? 0) : b.date.localeCompare(a.date)))

  const groups = new Map<string, RecentWorkGroup>()
  for (const e of mine) {
    const key = e.projectId ?? '__none__'
    if (!groups.has(key)) {
      if (groups.size >= 2) continue
      groups.set(key, { projectId: e.projectId, project: projectLabel(e.projectId), tasksInProgress: 0, tasks: [] })
    }
    const group = groups.get(key)
    if (!group) continue
    if (group.tasks.length >= 4 || group.tasks.some((t) => t.description === e.description)) continue
    group.tasks.push({ description: e.description, category: e.category, projectId: e.projectId })
  }
  for (const group of groups.values()) group.tasksInProgress = group.tasks.length
  return [...groups.values()]
}

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

function SmallLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600 }}>
      {children} <ChevronRightIcon size={12} color="var(--color-text-primary)" />
    </Link>
  )
}

export default function Home() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timer = useTimerState()
  const requests = useLeaveRequests()
  const pendingDays = requests.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + r.days, 0)
  const availablePto = Math.max(PTO_TOTAL_ACCRUED - PTO_TOTAL_USED - pendingDays, 0)

  const timeEntries = useTimeEntries()
  const recentWorks = useMemo(() => recentWorkGroups(timeEntries), [timeEntries])

  const today = todayLocal()
  const weekDays = useMemo(() => {
    const start = weekStartFor(today)
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      const mins = minutesForPersonDate(timeEntries, CURRENT_USER_ID, date)
      const dow = new Date(date + 'T00:00:00').getDay()
      return {
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        date: date.slice(-2),
        minutes: mins,
        today: date === today,
        isWeekend: dow === 0 || dow === 6,
      }
    })
  }, [timeEntries, today])

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const weekdayStr = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dayMonthStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })

  return (
    <section className="stage">
      <div className="canvas">
        <div style={{ padding: '24px 24px 140px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              paddingBottom: 16,
              borderBottom: '1px solid var(--color-border-default)',
              marginBottom: 20,
            }}
          >
            <div>
              <div className="serif" style={{ fontSize: 24, letterSpacing: '-1.2px', color: 'var(--color-text-primary)' }}>
                {greeting(now.getHours())}, Pranath.
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                {dateStr} · Times shown in Asia/Colombo
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'var(--color-background-muted)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 18,
                padding: '10px 22px',
              }}
            >
              <span className="home-clock" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.5px', color: 'var(--color-text-primary)' }}>
                {timeStr}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{weekdayStr}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{dayMonthStr}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Left column */}
            <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--color-background-subtle)', border: '1px solid var(--color-border-default)', borderRadius: 14 }}>
                <div style={{ padding: '20px 20px 12px' }}>
                  <SectionLabel>Recent Works</SectionLabel>
                </div>
                {recentWorks.length === 0 && (
                  <div style={{ padding: '4px 20px 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    No time logged yet — entries you track will show up here.
                  </div>
                )}
                {recentWorks.map((work, i) => (
                  <div
                    key={work.projectId ?? '__none__'}
                    style={{
                      padding: '16px 20px 17px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      borderBottom: i < recentWorks.length - 1 ? '1px solid var(--color-border-default)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{work.project}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                          {work.tasksInProgress} recent {work.tasksInProgress === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                      <button
                        onClick={() => startTimer({ description: '', projectId: work.projectId, category: 'Development' })}
                        aria-label={`Start a new task timer for ${work.project}`}
                        title={`Start a new task timer for ${work.project}`}
                        style={{ background: '#2f2f33', color: '#fff', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <PlayIcon size={12} color="#fff" /> New Task
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {work.tasks.map((t) => {
                        const isRunningThis =
                          timer.running && timer.description === t.description && (timer.projectId || null) === (t.projectId ?? null)
                        return (
                          <div
                            key={t.description}
                            className="task-row"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '6px 8px',
                              borderRadius: 4,
                              background: isRunningThis ? 'rgba(0, 115, 111, 0.08)' : undefined,
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColor(t.category), flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</span>
                            {isRunningThis && <TimerActivityIcon size={13} color="#00736f" />}
                            <span className="tag">{t.category}</span>
                            <button
                              onClick={() =>
                                isRunningThis ? toggleTimerRunning() : startTimer({ description: t.description, projectId: t.projectId, category: t.category })
                              }
                              aria-label={isRunningThis ? `Pause "${t.description}"` : `Resume "${t.description}" as timer`}
                              title={isRunningThis ? 'Pause timer' : 'Resume as timer'}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: isRunningThis ? '#00736f' : 'var(--color-background-muted)',
                              }}
                            >
                              {isRunningThis ? <StopIcon size={10} color="#fff" /> : <PlayIcon size={11} color="var(--color-text-primary)" />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 340px', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 21, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel>Events this week</SectionLabel>
                    <SmallLink to="/calendar">View calendar</SmallLink>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {upcomingEvents.map((e) => (
                      <div key={e.title} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 40, background: 'var(--color-background-muted)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: '5px 1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{e.month}</span>
                          <span style={{ background: '#2f2f33', color: '#fff', fontSize: 13, fontWeight: 500, borderRadius: 10, padding: '1px 7px' }}>{e.day}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                            {e.kind === 'birthday' ? <CakeIcon size={14} color="var(--color-text-primary)" /> : <FlagIcon size={14} color="var(--color-text-primary)" />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{e.subtitle}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ flex: '1 1 240px', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 21, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel>Who's off</SectionLabel>
                    <Link to="/people" style={{ background: 'var(--color-background-muted)', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 2 }}>
                      All Teams <ChevronRightIcon size={12} color="var(--color-text-primary)" />
                    </Link>
                  </div>
                  <div style={{ display: 'flex' }}>
                    {whoIsOff.map((p, i) => (
                      <div
                        key={p.initials}
                        title={p.name}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#ff4800',
                          border: '3px solid var(--color-background-page)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          marginLeft: i === 0 ? 0 : -10,
                          flexShrink: 0,
                        }}
                      >
                        {avatarContent(p)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ width: 420, maxWidth: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'stretch' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SectionLabel>This week</SectionLabel>
                  <SmallLink to="/time">Open Tracker</SmallLink>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {weekDays.map((d) => {
                    const fillPct = Math.min(d.minutes / DAILY_TARGET_MINUTES, 1) * 100
                    const hasData = d.minutes > 0
                    const deEmphasize = d.isWeekend && !hasData && !d.today
                    return (
                      <button
                        key={d.label}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          flex: 1,
                          height: 64,
                          background: 'var(--color-background-page)',
                          border: d.today ? '1.5px dashed #00736f' : '1px solid var(--color-border-default)',
                          boxShadow: d.today ? '0 2px 4px rgba(20,22,27,0.05), 0 4px 12px rgba(20,22,27,0.08)' : 'none',
                          borderRadius: 9999,
                          padding: 3,
                          display: 'flex',
                          flexDirection: 'column',
                          opacity: deEmphasize ? 0.55 : 1,
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        {hasData && (
                          <div
                            className={d.today ? 'liquid-fill-wavy-top' : undefined}
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: `${fillPct}%`,
                              background: '#004543',
                              transition: 'height 0.4s ease',
                            }}
                          />
                        )}
                        <div
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            borderRadius: 9999,
                            background: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(0,0,0,0.06)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                          }}
                        >
                          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: hasData ? '#0f0f10' : 'rgba(0,0,0,0.53)' }}>{d.label}</span>
                          <span className="mono" style={{ fontSize: 15, fontWeight: 500, color: '#0f0f10' }}>{d.date}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div>
                  <div>
                    <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text-primary)' }}>{weeklyHoursWorked}</span>
                    <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text-secondary)' }}> / {weeklyHoursTarget} h</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{weeklyBehindLabel}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {weekSummaries.map((w) => (
                    <div key={w.range} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-background-muted)', border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertFileIcon size={16} color="var(--color-text-secondary)" />
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{w.range}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              background: w.onTrack ? '#004543' : '#ff4800',
                              color: '#f5f5f5',
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '4px 8px',
                              borderRadius: 20,
                            }}
                          >
                            {w.hours} / {w.target} h
                          </span>
                          <Link to="/time" style={{ fontSize: 12, fontWeight: 600, textDecoration: 'underline', color: 'var(--color-text-secondary)' }}>View</Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SectionLabel>Available PTO</SectionLabel>
                  <SmallLink to="/hr/leave">My Leave</SmallLink>
                </div>
                {(() => {
                  const r = 44
                  const circumference = 2 * Math.PI * r
                  const usedLen = Math.min(PTO_TOTAL_USED / PTO_TOTAL_ACCRUED, 1) * circumference
                  const pendingLen = Math.min(pendingDays / PTO_TOTAL_ACCRUED, 1 - PTO_TOTAL_USED / PTO_TOTAL_ACCRUED) * circumference
                  return (
                    <svg width="112" height="112" viewBox="0 0 112 112" style={{ alignSelf: 'center' }}>
                      <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-border-default)" strokeWidth="12" />
                      <circle
                        cx="56"
                        cy="56"
                        r={r}
                        fill="none"
                        stroke="#004543"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${usedLen} ${circumference}`}
                        transform="rotate(-90 56 56)"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r={r}
                        fill="none"
                        stroke="#ff6d33"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${pendingLen} ${circumference}`}
                        strokeDashoffset={-usedLen}
                        transform="rotate(-90 56 56)"
                      />
                      <circle cx="56" cy="56" r="30" fill="#004543" />
                    </svg>
                  )
                })()}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px' }}>{availablePto.toFixed(1)}d</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {PTO_TOTAL_ACCRUED}d accrued · {PTO_TOTAL_USED}d used
                      {pendingDays > 0 ? ` · ${pendingDays}d pending` : ''}
                    </div>
                  </div>
                  <Link to="/hr/leave" className="btn-dark">Request Leave</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
