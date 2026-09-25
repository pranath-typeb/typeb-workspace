import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon, RefreshIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { showToast } from '../../data/toast'
import {
  addDays,
  formatMinutes,
  formatTimeRange,
  formatWeekRange,
  minutesForPersonDate,
  projectLabel,
  todayLocal,
  useTimeEntries,
  weekStartFor,
} from '../../data/timeEntries'

const HOUR_HEIGHT = 44
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function hourLabel(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

export default function TimeCalendar() {
  const entries = useTimeEntries().filter((e) => e.personId === CURRENT_USER_ID)
  const [weekStart, setWeekStart] = useState(() => weekStartFor(todayLocal()))
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60000)
    return () => clearInterval(t)
  }, [])

  const today = todayLocal()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const isThisWeek = weekStart === weekStartFor(today)

  return (
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="calendar" />}>
      <div className="page-title">Calendar</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
          <button className="btn-outline" onClick={() => setWeekStart(weekStartFor(today))}>This week</button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{formatWeekRange(weekStart)}</span>
        </div>
        <button className="btn-outline" onClick={() => showToast('No external calendar connected in this build', 'info')}>
          <RefreshIcon color="#0f0f10" /> Refresh calendar
        </button>
      </div>

      <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ebebeb' }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {days.map((d) => {
            const dayMinutes = minutesForPersonDate(entries, CURRENT_USER_ID, d)
            const dayName = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
            const dateNum = Number(d.slice(-2))
            const isToday = d === today
            return (
              <div key={d} style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderLeft: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? '#00736f' : '#171717' }}>{dayName}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: isToday ? '#00736f' : '#171717' }}>{dateNum}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>{dayMinutes > 0 ? formatMinutes(dayMinutes) : ''}</div>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', position: 'relative', maxHeight: 560, overflowY: 'auto' }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT, fontSize: 10, color: 'rgba(0,0,0,0.4)', textAlign: 'right', paddingRight: 8, position: 'relative', top: -6 }}>
                {hourLabel(h)}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayEntries = entries.filter((e) => e.date === d && e.startMinutes !== undefined)
            const isToday = d === today
            return (
              <div key={d} style={{ flex: 1, minWidth: 0, position: 'relative', borderLeft: '1px solid #f5f5f5' }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT, borderTop: '1px solid #f5f5f5' }} />
                ))}
                {dayEntries.map((e) => {
                  const top = ((e.startMinutes as number) / 60) * HOUR_HEIGHT
                  const height = Math.max(18, (e.minutes / 60) * HOUR_HEIGHT)
                  return (
                    <div
                      key={e.id}
                      title={`${e.description} · ${formatTimeRange(e.startMinutes as number, e.minutes)}`}
                      style={{
                        position: 'absolute',
                        top,
                        height,
                        left: 4,
                        right: 4,
                        background: '#e3f1ef',
                        borderLeft: '3px solid #00736f',
                        borderRadius: 4,
                        padding: '4px 6px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#00504d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>
                      {height > 30 && (
                        <div className="mono" style={{ fontSize: 10, color: '#00736f', marginTop: 2 }}>
                          {formatTimeRange(e.startMinutes as number, e.minutes)}
                        </div>
                      )}
                      {height > 44 && (
                        <div style={{ fontSize: 10, color: 'rgba(0,80,77,0.7)', marginTop: 1 }}>{projectLabel(e.projectId)}</div>
                      )}
                    </div>
                  )
                })}
                {isToday && isThisWeek && (
                  <div style={{ position: 'absolute', top: (nowMinutes / 60) * HOUR_HEIGHT, left: 0, right: 0, height: 0, borderTop: '2px solid #ff4800', zIndex: 2 }}>
                    <span className="mono" style={{ position: 'absolute', left: -4, top: -8, background: '#ff4800', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>
                      {String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:{String(nowMinutes % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
