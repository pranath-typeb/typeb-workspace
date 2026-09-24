import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { PeopleIcon } from '../../components/icons'
import { people, localTimeFor } from '../../data/people'

function daysAgo(dateStr: string): number {
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

function anniversaryWithinDays(startDate: string, days: number): { years: number; diffDays: number } | null {
  const start = new Date(startDate)
  const now = new Date()
  const nextAnniversary = new Date(now.getFullYear(), start.getMonth(), start.getDate())
  if (nextAnniversary.getTime() < now.getTime() - 86400000) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }
  const diffDays = Math.round((nextAnniversary.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0 || diffDays > days) return null
  const years = nextAnniversary.getFullYear() - start.getFullYear()
  if (years <= 0) return null
  return { years, diffDays }
}

export default function Insights() {
  const newJoiners = useMemo(() => people.filter((p) => daysAgo(p.startDate) <= 30 && daysAgo(p.startDate) >= 0), [])

  const anniversaries = useMemo(
    () =>
      people
        .map((p) => ({ person: p, anniversary: anniversaryWithinDays(p.startDate, 30) }))
        .filter((a): a is { person: (typeof people)[number]; anniversary: { years: number; diffDays: number } } => a.anniversary !== null)
        .sort((a, b) => a.anniversary.diffDays - b.anniversary.diffDays),
    [],
  )

  const byTimezone = useMemo(() => {
    const map = new Map<string, number>()
    people.forEach((p) => {
      map.set(p.timezone, (map.get(p.timezone) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([tz, count]) => ({ tz, count }))
      .sort((a, b) => b.count - a.count)
  }, [])

  const byDepartment = useMemo(() => {
    const map = new Map<string, number>()
    people.forEach((p) => {
      const key = p.department ?? 'No department'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    const max = Math.max(...map.values())
    return Array.from(map.entries())
      .map(([dept, count]) => ({ dept, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count)
  }, [])

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="insights" />}
    >
      <div className="page-title">Insights</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15 }}>New joiners</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 10 }}>Started in the last 30 days</div>
          {newJoiners.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>Nobody joined in the last 30 days.</div>
          ) : (
            newJoiners.map((p) => (
              <Link key={p.id} to={`/people/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f5f5f5' }}>
                <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{p.initials}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{p.title || p.email}</div>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15 }}>Work anniversaries</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>Coming up in the next 30 days</div>
          {anniversaries.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>No anniversaries in the next 30 days.</div>
          ) : (
            anniversaries.map(({ person, anniversary }) => (
              <Link key={person.id} to={`/people/${person.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{person.initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{person.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{person.title || person.email}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>
                  {anniversary.years} {anniversary.years === 1 ? 'yr' : 'yrs'} · {new Date(person.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15 }}>Where everyone is</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>{byTimezone.length} timezones</div>
          {byTimezone.map(({ tz, count }) => (
            <div key={tz} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f5f5f5' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{tz} <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.53)' }}>· {localTimeFor(tz)}</span></div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>{count}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15 }}>Headcount by department</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 12 }}>{people.length} people</div>
          {byDepartment.map(({ dept, count, pct }) => (
            <div key={dept} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{dept}</span>
                <span style={{ color: 'rgba(0,0,0,0.53)' }}>{count}</span>
              </div>
              <div style={{ height: 6, background: '#ebebeb', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#004543' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
