import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavGroupLabel, NavItem } from '../../components/NavItem'
import { BuildingIcon, ProjectsIcon, StaffingIcon } from '../../components/icons'
import { people, personById, type Department, type EmploymentType } from '../../data/people'
import { useProjects } from '../../data/projects'
import { allocationStatus, committedHoursFor, removeAssignment, useAssignments } from '../../data/staffing'
import { addDays, formatWeekRange, todayLocal, weekStartFor } from '../../data/timeEntries'
import CommitHoursModal from '../../components/CommitHoursModal'

type FilterTab = 'Everyone' | 'Over-allocated' | 'At capacity' | 'Has room' | 'Unassigned'
type Granularity = 'Weekly' | 'Monthly' | 'Yearly'
type Metric = 'Allocated hours' | 'Availability'
type Scope = 'Direct' | 'Indirect'
type SortBy = 'Default order' | 'Name (A–Z)' | 'Allocation (high–low)' | 'Allocation (low–high)' | 'Department'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']
const employmentTypes: EmploymentType[] = ['full_time', 'part_time', 'contract']
const employmentLabel: Record<EmploymentType, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' }
const sortOptions: SortBy[] = ['Default order', 'Name (A–Z)', 'Allocation (high–low)', 'Allocation (low–high)', 'Department']

function monthStart(d: string) {
  return `${d.slice(0, 7)}-01`
}
function monthEnd(d: string) {
  const [y, m] = d.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}
function shiftMonth(d: string, delta: number) {
  const [y, m] = d.split('-').map(Number)
  const nd = new Date(y, m - 1 + delta, 1)
  return `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-01`
}
function monthLabel(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
function yearStart(d: string) {
  return `${d.slice(0, 4)}-01-01`
}
function yearEnd(d: string) {
  return `${d.slice(0, 4)}-12-31`
}

export default function Staffing() {
  const projects = useProjects()
  const assignments = useAssignments()
  const [view, setView] = useState<'List' | 'Timeline'>('List')
  const [metric, setMetric] = useState<Metric>('Allocated hours')
  const [scope, setScope] = useState<Scope>('Direct')
  const [groupByManager, setGroupByManager] = useState(false)
  const [granularity, setGranularity] = useState<Granularity>('Monthly')
  const [anchor, setAnchor] = useState(() => todayLocal())
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState<'All' | Department>('All')
  const [employment, setEmployment] = useState<'All' | EmploymentType>('All')
  const [sortBy, setSortBy] = useState<SortBy>('Default order')
  const [tab, setTab] = useState<FilterTab>('Everyone')
  const [commitFor, setCommitFor] = useState<string | null>(null)

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Unknown project'
  const today = todayLocal()

  const range = useMemo(() => {
    if (granularity === 'Weekly') {
      const start = weekStartFor(anchor)
      const end = addDays(start, 6)
      const isCurrent = start === weekStartFor(today)
      return { start, end, label: isCurrent ? 'This week' : formatWeekRange(start), capacity: 40, multiplier: 1 }
    }
    if (granularity === 'Yearly') {
      const start = yearStart(anchor)
      const end = yearEnd(anchor)
      const isCurrent = start.slice(0, 4) === today.slice(0, 4)
      return { start, end, label: isCurrent ? 'This year' : start.slice(0, 4), capacity: 2080, multiplier: 52 }
    }
    const start = monthStart(anchor)
    const end = monthEnd(anchor)
    const isCurrent = start.slice(0, 7) === today.slice(0, 7)
    return { start, end, label: isCurrent ? 'This month' : monthLabel(start), capacity: 176, multiplier: 4.4 }
  }, [granularity, anchor, today])

  function step(delta: number) {
    if (granularity === 'Weekly') setAnchor(addDays(anchor, delta * 7))
    else if (granularity === 'Yearly') setAnchor(`${Number(anchor.slice(0, 4)) + delta}-01-01`)
    else setAnchor(shiftMonth(anchor, delta))
  }

  function changeGranularity(g: Granularity) {
    setGranularity(g)
    setAnchor(todayLocal())
  }

  const scoped = useMemo(() => people.filter((p) => (scope === 'Direct' ? !p.payrollExcluded : p.payrollExcluded)), [scope])

  const rows = useMemo(() => {
    return scoped.map((p) => {
      const committed = committedHoursFor(assignments, p.id, range.multiplier)
      const pct = Math.round((committed / range.capacity) * 100)
      const status = allocationStatus(pct)
      const personAssignments = assignments.filter((a) => a.personId === p.id)
      return { person: p, committed, pct, status, assignments: personAssignments }
    })
  }, [scoped, assignments, range])

  const counts = useMemo(
    () => ({
      Everyone: rows.length,
      'Over-allocated': rows.filter((r) => r.pct > 100).length,
      'At capacity': rows.filter((r) => r.pct >= 95 && r.pct <= 100).length,
      'Has room': rows.filter((r) => r.pct > 0 && r.pct < 95).length,
      Unassigned: rows.filter((r) => r.pct === 0).length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter((r) => {
      const matchesQuery = !q || r.person.name.toLowerCase().includes(q) || r.person.title.toLowerCase().includes(q)
      const matchesDept = dept === 'All' || r.person.department === dept
      const matchesEmployment = employment === 'All' || r.person.employmentType === employment
      const matchesTab =
        tab === 'Everyone' ||
        (tab === 'Over-allocated' && r.pct > 100) ||
        (tab === 'At capacity' && r.pct >= 95 && r.pct <= 100) ||
        (tab === 'Has room' && r.pct > 0 && r.pct < 95) ||
        (tab === 'Unassigned' && r.pct === 0)
      return matchesQuery && matchesDept && matchesEmployment && matchesTab
    })
    list = [...list].sort((a, b) => {
      if (sortBy === 'Name (A–Z)') return a.person.name.localeCompare(b.person.name)
      if (sortBy === 'Allocation (high–low)') return b.pct - a.pct
      if (sortBy === 'Allocation (low–high)') return a.pct - b.pct
      if (sortBy === 'Department') return (a.person.department ?? '').localeCompare(b.person.department ?? '')
      return 0
    })
    return list
  }, [rows, query, dept, employment, tab, sortBy])

  const groups = useMemo(() => {
    if (!groupByManager) return [{ manager: null as string | null, rows: filtered }]
    const map = new Map<string, typeof filtered>()
    for (const r of filtered) {
      const managerName = r.person.managerId ? personById(r.person.managerId)?.name ?? 'No manager' : 'No manager'
      map.set(managerName, [...(map.get(managerName) ?? []), r])
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([manager, rows]) => ({ manager, rows }))
  }, [groupByManager, filtered])

  const totalCapacity = scoped.length * range.capacity
  const totalCommitted = rows.reduce((sum, r) => sum + r.committed, 0)

  const commitPerson = commitFor ? people.find((p) => p.id === commitFor) : undefined

  const weeks = useMemo(() => {
    if (granularity === 'Weekly') return [{ start: range.start, label: range.label }]
    if (granularity === 'Yearly') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(Number(range.start.slice(0, 4)), i, 1)
        return { start: toIso(d), label: d.toLocaleDateString('en-US', { month: 'short' }) }
      })
    }
    const list: { start: string; label: string }[] = []
    let cursor = weekStartFor(range.start)
    let i = 1
    while (cursor <= range.end) {
      list.push({ start: cursor, label: `Week ${i}` })
      cursor = addDays(cursor, 7)
      i += 1
    }
    return list
  }, [granularity, range])

  function toIso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function isCurrentColumn(weekStart: string) {
    if (granularity === 'Yearly') return weekStart.slice(0, 7) === today.slice(0, 7)
    return weekStart <= today && addDays(weekStart, granularity === 'Weekly' ? 6 : 6) >= today
  }

  function cellStyle(pct: number, current: boolean) {
    let background = '#cce3e2'
    let color = '#004543'
    if (pct > 100) {
      background = '#171717'
      color = '#fff'
    } else if (pct >= 95) {
      background = '#00736f'
      color = '#fff'
    } else if (pct > 0) {
      background = '#3a8f8c'
      color = '#fff'
    }
    return {
      background,
      color,
      border: current ? '2px solid #ff4800' : 'none',
      borderRadius: 8,
      padding: '8px 0',
      textAlign: 'center' as const,
      fontSize: 12,
      fontWeight: 700,
    }
  }

  return (
    <AppShell
      appIcon={<ProjectsIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="Projects"
      appHref="/projects"
      sidebar={
        <>
          <NavGroupLabel label="General" />
          <NavItem to="/projects" icon={<ProjectsIcon />} label="Projects" />
          <NavItem to="/projects/staffing" icon={<StaffingIcon color="#fafafa" />} label="Staffing" active />
          <NavItem to="/projects/clients" icon={<BuildingIcon />} label="Clients" />
        </>
      }
    >
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span>Staffing</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SegmentedToggle value={metric} options={['Allocated hours', 'Availability']} onChange={(v) => setMetric(v as Metric)} />
          <SegmentedToggle value={view} options={['List', 'Timeline']} onChange={(v) => setView(v as 'List' | 'Timeline')} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SegmentedToggle value={granularity} options={['Weekly', 'Monthly', 'Yearly']} onChange={(v) => changeGranularity(v as Granularity)} />
          <button className="btn-outline" style={{ width: 32, padding: 0, justifyContent: 'center' }} onClick={() => step(-1)}>‹</button>
          <div className="serif" style={{ fontSize: 16, letterSpacing: '-0.4px', minWidth: 120, textAlign: 'center' }}>{range.label}</div>
          <button className="btn-outline" style={{ width: 32, padding: 0, justifyContent: 'center' }} onClick={() => step(1)}>›</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SegmentedToggle value={scope} options={['Direct', 'Indirect']} onChange={(v) => setScope(v as Scope)} />
          <button className="btn-outline" onClick={() => setGroupByManager((v) => !v)} style={groupByManager ? { background: '#171717', color: '#fff', borderColor: '#171717' } : undefined}>
            Group by manager
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', border: '1px solid #ececee', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { label: 'Capacity', value: `${totalCapacity}h`, sub: `Total hours this ${granularity.toLowerCase().replace('ly', '')}` },
          { label: 'Committed', value: `${totalCommitted}h`, sub: 'Assigned to projects' },
          { label: 'Unassigned', value: `${Math.max(totalCapacity - totalCommitted, 0)}h`, sub: 'Not yet staffed' },
          { label: 'Logged', value: '0h', sub: 'Actual time recorded' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{ flex: 1, padding: '16px 20px', borderRight: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#5f636c' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.48px', marginTop: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5f636c' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #ebebeb' }}>
        {(Object.keys(counts) as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              paddingBottom: 10,
              fontSize: 14,
              fontWeight: t === tab ? 600 : 500,
              color: t === tab ? '#0f0f10' : 'rgba(0,0,0,0.53)',
              borderBottom: t === tab ? '2px solid #171717' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t}
            <span className="mono" style={{ background: t === tab ? '#171717' : '#ebebeb', color: t === tab ? '#fff' : '#525252', borderRadius: 9999, fontSize: 11, padding: '1px 7px' }}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <div className="field-label">Search</div>
          <input className="input" placeholder="Name or job title" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="field-label">Department</div>
          <select className="input" value={dept} onChange={(e) => setDept(e.target.value as 'All' | Department)}>
            <option value="All">Any</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="field-label">Employment</div>
          <select className="input" value={employment} onChange={(e) => setEmployment(e.target.value as 'All' | EmploymentType)}>
            <option value="All">Any</option>
            {employmentTypes.map((t) => (
              <option key={t} value={t}>{employmentLabel[t]}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="field-label">Sort by</div>
          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            {sortOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {view === 'List' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map((g) => (
            <div key={g.manager ?? 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groupByManager && (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.53)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {g.manager} <span className="mono" style={{ color: 'rgba(0,0,0,0.35)' }}>({g.rows.length})</span>
                </div>
              )}
              {g.rows.map((r) => {
                const availablePct = Math.max(0, 100 - r.pct)
                const availableHours = Math.max(range.capacity - r.committed, 0)
                return (
                  <div key={r.person.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Link to={`/people/${r.person.id}`} className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{r.person.initials}</Link>
                        <div>
                          <Link to={`/people/${r.person.id}`} style={{ fontSize: 15, fontWeight: 600 }}>{r.person.name}</Link>
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{r.person.title || 'No title'} · {r.person.department ?? '—'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${r.status.badgeClass}`} style={{ fontSize: 10 }}>{r.status.label}</span>
                        <button className="btn-outline" onClick={() => setCommitFor(r.person.id)}>Commit Hours</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div style={{ flex: 1, height: 8, background: '#f5f5f5', borderRadius: 9999, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(metric === 'Allocated hours' ? r.pct : availablePct, 100)}%`,
                            height: '100%',
                            background: metric === 'Allocated hours' ? (r.pct > 100 ? '#ff6d33' : '#004543') : '#00736f',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', whiteSpace: 'nowrap' }}>
                        {metric === 'Allocated hours' ? `${r.pct}%` : `${availablePct}% free`}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 14 }}>
                      {metric === 'Allocated hours'
                        ? `${r.committed}h committed of ${range.capacity}h`
                        : `${availableHours}h available of ${range.capacity}h`}
                    </div>

                    <div style={{ display: 'flex', gap: 32, marginBottom: r.assignments.length ? 14 : 0 }}>
                      <Stat label="Available" value={`${availableHours}h`} />
                      <Stat label="Logged" value="0h" />
                      <Stat label="Capacity" value={`${range.capacity}h`} />
                    </div>

                    {r.assignments.length > 0 && (
                      <div style={{ borderTop: '1px solid #f5f5f5' }}>
                        {r.assignments.map((a) => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                            <div>
                              <Link to={`/projects/${a.projectId}`} style={{ fontSize: 14, fontWeight: 600 }}>{projectName(a.projectId)}</Link>
                              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>
                                {a.hoursPerWeek}h/wk · {new Date(a.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {a.openEnded ? '→' : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{Math.round(a.hoursPerWeek * range.multiplier)}h</span>
                              <button onClick={() => removeAssignment(a.id)} style={{ fontSize: 12, fontWeight: 600, color: '#c53030' }}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '24px 0' }}>No one matches those filters.</div>
          )}
        </div>
      ) : (
        <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `220px repeat(${weeks.length}, 1fr)`, minWidth: 220 + weeks.length * 90 }}>
            <div />
            {weeks.map((w) => (
              <div key={w.start} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.53)', textAlign: 'center', padding: '10px 6px' }}>{w.label}</div>
            ))}
            {groups.flatMap((g) => g.rows).map((r) => (
              <Fragment key={r.person.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: '1px solid #f5f5f5' }}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>{r.person.initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.person.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.53)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.person.title || '—'}</div>
                  </div>
                </div>
                {weeks.map((w) => (
                  <div key={`${r.person.id}-${w.start}`} style={{ padding: '8px 6px', borderTop: '1px solid #f5f5f5', display: 'flex', alignItems: 'center' }}>
                    <div style={{ ...cellStyle(r.pct, isCurrentColumn(w.start)), width: '100%' }}>{r.pct}%</div>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '24px 16px' }}>No one matches those filters.</div>
          )}
        </div>
      )}

      {commitPerson && <CommitHoursModal person={commitPerson} onClose={() => setCommitFor(null)} />}
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.53)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function SegmentedToggle({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 10, padding: 2 }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            whiteSpace: 'nowrap',
            background: value === opt ? '#171717' : 'transparent',
            color: value === opt ? '#fff' : 'rgba(0,0,0,0.53)',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
