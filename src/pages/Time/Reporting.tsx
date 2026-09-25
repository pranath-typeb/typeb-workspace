import { useMemo } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { formatMinutes, projectLabel, useTimeEntries } from '../../data/timeEntries'

export default function Reporting() {
  const entries = useTimeEntries().filter((e) => e.personId === CURRENT_USER_ID)

  const byProject = useMemo(() => {
    const map = new Map<string, number>()
    entries.forEach((e) => {
      const key = projectLabel(e.projectId)
      map.set(key, (map.get(key) ?? 0) + e.minutes)
    })
    const max = Math.max(1, ...map.values())
    return Array.from(map.entries())
      .map(([name, minutes]) => ({ name, minutes, pct: Math.round((minutes / max) * 100) }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [entries])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    entries.forEach((e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.minutes)
    })
    const max = Math.max(1, ...map.values())
    return Array.from(map.entries())
      .map(([name, minutes]) => ({ name, minutes, pct: Math.round((minutes / max) * 100) }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [entries])

  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0)

  return (
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="reporting" />}>
      <div className="page-title">Reporting</div>

      <div className="stat" style={{ display: 'inline-block' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.53)' }}>All-time logged</div>
        <div className="serif" style={{ fontSize: 28, letterSpacing: '-1px', marginTop: 6 }}>{formatMinutes(totalMinutes)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Hours by project</div>
          {byProject.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>No entries logged yet.</div>
          ) : (
            byProject.map((row) => (
              <div key={row.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{row.name}</span>
                  <span className="mono" style={{ color: 'rgba(0,0,0,0.53)' }}>{formatMinutes(row.minutes)}</span>
                </div>
                <div style={{ height: 6, background: '#ebebeb', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: '#004543' }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Hours by category</div>
          {byCategory.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>No entries logged yet.</div>
          ) : (
            byCategory.map((row) => (
              <div key={row.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{row.name}</span>
                  <span className="mono" style={{ color: 'rgba(0,0,0,0.53)' }}>{formatMinutes(row.minutes)}</span>
                </div>
                <div style={{ height: 6, background: '#ebebeb', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: '#ff6d33' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
