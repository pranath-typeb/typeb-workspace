import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarIcon, ChevronLeftIcon, GridIcon } from '../components/icons'
import { todayLocal } from '../data/timeEntries'
import { useLeaveRequests } from '../data/leave'
import { categoryBadgeClass, categoryColor, parseLeaveDisplayDate, staticEvents, type CalendarEvent, type EventCategory } from '../data/calendarEvents'

const categories: EventCategory[] = ['Birthday', 'Public Holiday', 'Main Event', 'Employee Leave']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function CompanyCalendar() {
  const leaveRequests = useLeaveRequests()
  const today = todayLocal()
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const [view, setView] = useState<'Month' | 'List'>('Month')
  const [category, setCategory] = useState<'All' | EventCategory>('All')

  const allEvents = useMemo<CalendarEvent[]>(() => {
    const leaveEvents: CalendarEvent[] = leaveRequests
      .filter((r) => r.status === 'Approved')
      .map((r) => ({
        id: `leave-${r.id}`,
        date: parseLeaveDisplayDate(r.date),
        title: `${r.requestedBy} — ${r.type}`,
        category: 'Employee Leave' as const,
        detail: `${r.days} ${r.days === 1 ? 'day' : 'days'}`,
      }))
    return [...staticEvents, ...leaveEvents]
  }, [leaveRequests])

  const monthEvents = useMemo(() => {
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}`
    return allEvents
      .filter((e) => e.date.startsWith(prefix))
      .filter((e) => category === 'All' || e.category === category)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allEvents, cursor, category])

  const counts = useMemo(() => {
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}`
    const inMonth = allEvents.filter((e) => e.date.startsWith(prefix))
    return categories.reduce(
      (acc, c) => ({ ...acc, [c]: inMonth.filter((e) => e.category === c).length }),
      {} as Record<EventCategory, number>,
    )
  }, [allEvents, cursor])

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const daysInPrevMonth = new Date(cursor.year, cursor.month, 0).getDate()
    const cells: { date: string; inMonth: boolean; label: number }[] = []
    for (let i = startOffset; i > 0; i--) cells.push({ date: '', inMonth: false, label: daysInPrevMonth - i + 1 })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: `${cursor.year}-${pad(cursor.month + 1)}-${pad(d)}`, inMonth: true, label: d })
    while (cells.length % 7 !== 0) cells.push({ date: '', inMonth: false, label: cells.length })
    return cells
  }, [cursor])

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function goToday() {
    const [y, m] = today.split('-').map(Number)
    setCursor({ year: y, month: m - 1 })
  }
  function prevMonth() {
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  }
  function nextMonth() {
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
  }

  return (
    <section className="stage">
      <div className="canvas">
        <div className="topbar">
          <div className="topbar-app">
            <CalendarIcon size={16} color="rgba(0,0,0,0.53)" />
            <span className="topbar-app-label">Calendar</span>
          </div>
          <Link to="/" style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close">
            <ChevronLeftIcon color="rgba(0,0,0,0.53)" />
          </Link>
        </div>

        <div style={{ padding: '24px 24px 140px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="page-title" style={{ border: 'none', paddingBottom: 0 }}>Calendar</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>View birthdays, holidays, and main events</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-outline" onClick={goToday}>Today</button>
              <button className="btn-outline" style={{ width: 32, padding: 0, justifyContent: 'center' }} onClick={prevMonth}>‹</button>
              <div className="serif" style={{ fontSize: 19, letterSpacing: '-0.6px' }}>{monthLabel}</div>
              <button className="btn-outline" style={{ width: 32, padding: 0, justifyContent: 'center' }} onClick={nextMonth}>›</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select className="input" style={{ width: 170 }} value={category} onChange={(e) => setCategory(e.target.value as 'All' | EventCategory)}>
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setView('Month')}
                  style={{ width: 34, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: view === 'Month' ? '#171717' : '#fff' }}
                >
                  <GridIcon size={15} color={view === 'Month' ? '#fff' : 'rgba(0,0,0,0.53)'} />
                </button>
                <button
                  onClick={() => setView('List')}
                  style={{ width: 34, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: view === 'List' ? '#171717' : '#fff' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={view === 'List' ? '#fff' : 'rgba(0,0,0,0.53)'} strokeWidth="1.8">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'rgba(0,0,0,0.53)', flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColor[c], display: 'inline-block' }} />
                {c} <span style={{ background: '#ebebeb', borderRadius: 9999, padding: '1px 6px', fontSize: 11 }}>{counts[c] ?? 0}</span>
              </span>
            ))}
          </div>

          {view === 'Month' ? (
            <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                  <div key={d} style={{ padding: 10, fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {grid.map((cell, i) => {
                  const dayEvents = cell.inMonth ? allEvents.filter((e) => e.date === cell.date && (category === 'All' || e.category === category)) : []
                  const isToday = cell.date === today
                  return (
                    <div key={i} style={{ minHeight: 96, padding: 8, fontSize: 13, fontWeight: 600, borderRight: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)', color: cell.inMonth ? '#0f0f10' : 'rgba(0,0,0,0.25)' }}>
                      {isToday ? (
                        <span style={{ background: '#004543', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{cell.label}</span>
                      ) : cell.label}
                      {dayEvents.map((e) => (
                        <div key={e.id} className="mono" style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 9999, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: `${categoryColor[e.category]}22`, color: categoryColor[e.category] }} title={e.title}>
                          {e.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {monthEvents.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>No events this month.</div>
              ) : (
                Object.entries(
                  monthEvents.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
                    acc[e.date] = acc[e.date] ? [...acc[e.date], e] : [e]
                    return acc
                  }, {}),
                ).map(([date, dayEvents]) => {
                  const d = new Date(date + 'T00:00:00')
                  return (
                    <div key={date} style={{ display: 'flex', gap: 20 }}>
                      <div style={{ width: 56, flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)' }}>{d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>
                        <div className="serif" style={{ fontSize: 24 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{d.toLocaleDateString('en-US', { month: 'short' })}</div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {dayEvents.map((e) => (
                          <div key={e.id} className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span className={`badge ${categoryBadgeClass[e.category]}`}>{e.category}</span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{e.title}</div>
                            {e.detail && <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>{e.detail}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
