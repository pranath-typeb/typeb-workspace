import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLeaveRequests, PTO_TOTAL_ACCRUED, PTO_TOTAL_USED } from '../data/leave'
import {
  recentWorks,
  upcomingEvents,
  whoIsOff,
  weekDays,
  weeklyHoursWorked,
  weeklyHoursTarget,
  weeklyBehindLabel,
  weekSummaries,
} from '../data/dashboard'
import { AlertFileIcon, CakeIcon, ChevronRightIcon, FlagIcon, PlusIcon } from '../components/icons'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.53)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

function SmallLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600 }}>
      {children} <ChevronRightIcon size={12} color="#0f0f10" />
    </Link>
  )
}

export default function Home() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const requests = useLeaveRequests()
  const pendingDays = requests.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + r.days, 0)
  const availablePto = Math.max(PTO_TOTAL_ACCRUED - PTO_TOTAL_USED - pendingDays, 0)

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const secStr = now.toLocaleTimeString('en-US', { second: '2-digit' }).split(':').pop() ?? '00'

  return (
    <section className="stage">
      <div className="canvas">
        <div style={{ padding: '24px 24px 140px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              paddingBottom: 16,
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              marginBottom: 20,
            }}
          >
            <div>
              <div className="serif" style={{ fontSize: 24, letterSpacing: '-1.2px', color: '#0f0f10' }}>
                {greeting(now.getHours())}, Pranath.
              </div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 4 }}>
                {dateStr} · Times shown in Asia/Colombo
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>{timeStr}</span>
                <span style={{ fontSize: 14, fontWeight: 600, paddingBottom: 8 }}>{secStr}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Left column */}
            <div style={{ width: 880, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fafafa', border: '1px solid #ebebeb', borderRadius: 14 }}>
                <div style={{ padding: '20px 20px 12px' }}>
                  <SectionLabel>Recent Works</SectionLabel>
                </div>
                {recentWorks.map((work, i) => (
                  <div
                    key={work.project}
                    style={{
                      padding: '16px 20px 17px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      borderBottom: i < recentWorks.length - 1 ? '1px solid #e6e2da' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{work.project}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.53)', marginLeft: 8 }}>
                          {work.tasksInProgress} tasks in progress
                        </span>
                      </div>
                      <Link
                        to="/projects"
                        style={{ background: '#2f2f33', color: '#fff', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <PlusIcon size={12} color="#fff" /> New Task
                      </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {work.tasks.map((t) => (
                        <div key={t.title} className="task-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', borderRadius: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4aa494', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.8)' }}>{t.title}</span>
                          <span className="tag">{t.tag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 340px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 21, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel>Events this week</SectionLabel>
                    <SmallLink to="/calendar">View calendar</SmallLink>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {upcomingEvents.map((e) => (
                      <div key={e.title} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 40, background: '#f2f2f2', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '5px 1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>{e.month}</span>
                          <span style={{ background: '#2f2f33', color: '#fff', fontSize: 13, fontWeight: 500, borderRadius: 10, padding: '1px 7px' }}>{e.day}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                            {e.kind === 'birthday' ? <CakeIcon size={14} color="#0f0f10" /> : <FlagIcon size={14} color="#0f0f10" />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.53)' }}>{e.subtitle}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ flex: '1 1 240px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 21, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionLabel>Who's off</SectionLabel>
                    <Link to="/people" style={{ background: '#f5f5f5', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 2 }}>
                      All Teams <ChevronRightIcon size={12} color="#0f0f10" />
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
                          border: '3px solid #fff',
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
                        {p.initials}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'stretch' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SectionLabel>This week</SectionLabel>
                  <SmallLink to="/time">Open Tracker</SmallLink>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  {weekDays.map((d) => (
                    <div
                      key={d.label}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '9px 2px',
                        borderRadius: 23,
                        background: d.worked ? '#005c59' : '#fff',
                        border: d.today ? '1px dashed #00736f' : '1px solid #ebebeb',
                        boxShadow: d.today ? '0 4px 12px rgba(20,22,27,0.08)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: d.worked ? '#0f0f10' : 'rgba(0,0,0,0.53)', letterSpacing: '0.08em' }}>{d.label}</div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 500, color: '#0f0f10', marginTop: 2 }}>{d.date}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div>
                    <span style={{ fontSize: 24, fontWeight: 500, color: '#262626' }}>{weeklyHoursWorked}</span>
                    <span style={{ fontSize: 24, fontWeight: 500, color: '#737373' }}> / {weeklyHoursTarget} h</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>{weeklyBehindLabel}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {weekSummaries.map((w) => (
                    <div key={w.range} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f5f5f5', border: '1px solid #ebebeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertFileIcon size={16} color="rgba(0,0,0,0.53)" />
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
                          <Link to="/time" style={{ fontSize: 12, fontWeight: 600, textDecoration: 'underline', color: 'rgba(0,0,0,0.53)' }}>View</Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'space-between' }}>
                <svg
                  width="128"
                  height="128"
                  viewBox="0 0 128 128"
                  style={{ position: 'absolute', right: -24, bottom: -24, opacity: 0.5, pointerEvents: 'none' }}
                >
                  <circle cx="64" cy="64" r="52" fill="none" stroke="#f5f5f5" strokeWidth="14" />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="none"
                    stroke="#ff4800"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${(availablePto / PTO_TOTAL_ACCRUED) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                    transform="rotate(-90 64 64)"
                  />
                </svg>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  <SectionLabel>Available PTO</SectionLabel>
                  <SmallLink to="/hr/leave">My Leave</SmallLink>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
                  <div style={{ flex: 1 }}>
                    <div className="serif" style={{ fontSize: 28, letterSpacing: '-1px' }}>{availablePto.toFixed(1)}d</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>
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
