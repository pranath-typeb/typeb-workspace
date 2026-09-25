import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartIcon, ChevronLeftIcon } from '../components/icons'
import { people } from '../data/people'
import { useProjects } from '../data/projects'
import { useAssignments } from '../data/staffing'
import { addDays, formatWeekRange, todayLocal, weekStartFor } from '../data/timeEntries'

const WEEKLY_CAPACITY_PER_PERSON = 40

export default function Analytics() {
  const assignments = useAssignments()
  const projects = useProjects()
  const [rangeWeeks, setRangeWeeks] = useState(8)

  const currentWeekStart = weekStartFor(todayLocal())

  const totalCapacity = people.length * WEEKLY_CAPACITY_PER_PERSON
  const totalCommitted = assignments.reduce((sum, a) => sum + a.hoursPerWeek, 0)
  const capacityPct = totalCapacity > 0 ? Math.round((totalCommitted / totalCapacity) * 1000) / 10 : 0

  const trend = useMemo(() => {
    const weeks = Array.from({ length: rangeWeeks }, (_, i) => addDays(currentWeekStart, -(rangeWeeks - 1 - i) * 7))
    return weeks.map((weekStart) => {
      const committed = assignments
        .filter((a) => a.startDate <= addDays(weekStart, 6))
        .reduce((sum, a) => sum + a.hoursPerWeek, 0)
      return { weekStart, committed }
    })
  }, [assignments, rangeWeeks, currentWeekStart])

  const avgPct = useMemo(() => {
    if (trend.length === 0 || totalCapacity === 0) return 0
    const avgCommitted = trend.reduce((s, t) => s + t.committed, 0) / trend.length
    return Math.round((avgCommitted / totalCapacity) * 1000) / 10
  }, [trend, totalCapacity])

  const peopleAllocated = new Set(assignments.map((a) => a.personId)).size
  const projectsStaffed = new Set(assignments.map((a) => a.projectId)).size

  const perPerson = useMemo(() => {
    const map = new Map<string, number>()
    assignments.forEach((a) => {
      map.set(a.personId, (map.get(a.personId) ?? 0) + a.hoursPerWeek)
    })
    return people.map((p) => ({ person: p, committed: map.get(p.id) ?? 0 }))
  }, [assignments])

  const overAllocated = perPerson.filter((r) => r.committed > WEEKLY_CAPACITY_PER_PERSON).sort((a, b) => b.committed - a.committed)
  const spareCapacity = perPerson.filter((r) => r.committed === 0)

  const maxTrend = Math.max(1, ...trend.map((t) => t.committed))

  return (
    <section className="stage">
      <div className="canvas">
        <div className="topbar">
          <div className="topbar-app">
            <ChartIcon size={16} color="rgba(0,0,0,0.53)" />
            <span className="topbar-app-label">Analytics</span>
          </div>
          <Link to="/" style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close">
            <ChevronLeftIcon color="rgba(0,0,0,0.53)" />
          </Link>
        </div>

        <div style={{ padding: '24px 24px 140px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div className="page-title" style={{ border: 'none', paddingBottom: 0 }}>Analytics</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>Team capacity, utilization and allocation at a glance</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>Week of {formatWeekRange(currentWeekStart)}</div>
            <select className="input" style={{ width: 150 }} value={rangeWeeks} onChange={(e) => setRangeWeeks(Number(e.target.value))}>
              <option value={4}>Last 4 weeks</option>
              <option value={8}>Last 8 weeks</option>
              <option value={12}>Last 12 weeks</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Stat label="Capacity committed" value={`${capacityPct}%`} sub="this week" />
            <Stat label="Average over range" value={`${avgPct}%`} sub={`${rangeWeeks} weeks`} />
            <Stat label="People allocated" value={`${peopleAllocated} / ${people.length}`} sub="with commitments this week" />
            <Stat label="Projects staffed" value={`${projectsStaffed} / ${projects.length}`} sub="active projects" />
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Utilization trend</div>
              <div className="mono" style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{totalCommitted}h/wk committed · {totalCapacity}h/wk capacity</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {trend.map((t) => (
                <div key={t.weekStart} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                  <div style={{ height: 160, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: 28, borderRadius: '6px 6px 2px 2px', background: '#3a8f8c', height: Math.max(4, (t.committed / maxTrend) * 160) }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.53)', textAlign: 'center' }}>{formatWeekRange(t.weekStart)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Over-allocated</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>Committed hours exceed capacity this week</div>
              {overAllocated.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', padding: '10px 0' }}>No one is over-allocated.</div>
              ) : (
                overAllocated.map((r) => (
                  <Link key={r.person.id} to={`/people/${r.person.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{r.person.initials}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.person.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{r.person.title || r.person.department || '—'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="mono" style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>{r.committed}h / {WEEKLY_CAPACITY_PER_PERSON}h</span>
                      <span className="badge b-danger">+{r.committed - WEEKLY_CAPACITY_PER_PERSON}H</span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Spare capacity</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>No commitments logged this week</div>
              {spareCapacity.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', padding: '10px 0' }}>Everyone has at least some commitments.</div>
              ) : (
                spareCapacity.slice(0, 6).map((r) => (
                  <Link key={r.person.id} to={`/people/${r.person.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{r.person.initials}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.person.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{r.person.title || r.person.department || '—'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="mono" style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>0h / {WEEKLY_CAPACITY_PER_PERSON}h</span>
                      <span className="badge b-pine">−{WEEKLY_CAPACITY_PER_PERSON}H</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat" style={{ flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}
