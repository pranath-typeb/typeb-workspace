import { useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { formatMinutes, minutesForPersonDate, useTimeEntries } from '../../data/timeEntries'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function TimeCalendar() {
  const entries = useTimeEntries()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const startOffset = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${cursor.year}-${pad(cursor.month + 1)}-${pad(d)}`)
    }
    return cells
  }, [cursor])

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalMonthMinutes = grid
    .filter((d): d is string => Boolean(d))
    .reduce((sum, d) => sum + minutesForPersonDate(entries, CURRENT_USER_ID, d), 0)

  return (
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="calendar" />}>
      <div className="page-title">Calendar</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}>‹</button>
          <button className="btn-outline" onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}>›</button>
        </div>
        <div className="serif" style={{ fontSize: 18, letterSpacing: '-0.5px' }}>{monthLabel}</div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>{formatMinutes(totalMonthMinutes)} logged</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>
        ))}
        {grid.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />
          const mins = minutesForPersonDate(entries, CURRENT_USER_ID, d)
          const dayNum = Number(d.slice(-2))
          return (
            <div
              key={d}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
                border: '1px solid #ebebeb',
                background: mins > 0 ? '#eaf3f2' : '#fff',
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>{dayNum}</span>
              {mins > 0 && <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#004543' }}>{formatMinutes(mins)}</span>}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
