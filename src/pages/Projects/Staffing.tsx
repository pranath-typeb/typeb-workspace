import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavGroupLabel, NavItem } from '../../components/NavItem'
import { BuildingIcon, ProjectsIcon, StaffingIcon } from '../../components/icons'
import { people, type Department } from '../../data/people'
import { useProjects } from '../../data/projects'
import { allocationStatus, committedHoursFor, MONTHLY_CAPACITY_HOURS, removeAssignment, useAssignments } from '../../data/staffing'
import CommitHoursModal from '../../components/CommitHoursModal'

type FilterTab = 'Everyone' | 'Over-allocated' | 'At capacity' | 'Has room' | 'Unassigned'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']

export default function Staffing() {
  const projects = useProjects()
  const assignments = useAssignments()
  const [view, setView] = useState<'List' | 'Timeline'>('List')
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState<'All' | Department>('All')
  const [tab, setTab] = useState<FilterTab>('Everyone')
  const [commitFor, setCommitFor] = useState<string | null>(null)

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Unknown project'

  const rows = useMemo(() => {
    return people.map((p) => {
      const committed = committedHoursFor(assignments, p.id)
      const pct = Math.round((committed / MONTHLY_CAPACITY_HOURS) * 100)
      const status = allocationStatus(pct)
      const personAssignments = assignments.filter((a) => a.personId === p.id)
      return { person: p, committed, pct, status, assignments: personAssignments }
    })
  }, [assignments])

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
    return rows.filter((r) => {
      const matchesQuery = !q || r.person.name.toLowerCase().includes(q) || r.person.title.toLowerCase().includes(q)
      const matchesDept = dept === 'All' || r.person.department === dept
      const matchesTab =
        tab === 'Everyone' ||
        (tab === 'Over-allocated' && r.pct > 100) ||
        (tab === 'At capacity' && r.pct >= 95 && r.pct <= 100) ||
        (tab === 'Has room' && r.pct > 0 && r.pct < 95) ||
        (tab === 'Unassigned' && r.pct === 0)
      return matchesQuery && matchesDept && matchesTab
    })
  }, [rows, query, dept, tab])

  const totalCapacity = people.length * MONTHLY_CAPACITY_HOURS
  const totalCommitted = rows.reduce((sum, r) => sum + r.committed, 0)

  const commitPerson = commitFor ? people.find((p) => p.id === commitFor) : undefined

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
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Staffing</span>
        <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 10, padding: 2 }}>
          <button
            onClick={() => setView('List')}
            style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8, background: view === 'List' ? '#171717' : 'transparent', color: view === 'List' ? '#fff' : 'rgba(0,0,0,0.53)' }}
          >
            List
          </button>
          <button
            onClick={() => setView('Timeline')}
            style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8, background: view === 'Timeline' ? '#171717' : 'transparent', color: view === 'Timeline' ? '#fff' : 'rgba(0,0,0,0.53)' }}
          >
            Timeline
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', border: '1px solid #ececee', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { label: 'Capacity', value: `${totalCapacity}h`, sub: 'Total hours this month' },
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
      </div>

      {view === 'List' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((r) => (
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
                  <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', background: r.pct > 100 ? '#ff6d33' : '#004543' }} />
                </div>
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', whiteSpace: 'nowrap' }}>{r.pct}%</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 14 }}>{r.committed}h committed of {MONTHLY_CAPACITY_HOURS}h</div>

              <div style={{ display: 'flex', gap: 32, marginBottom: r.assignments.length ? 14 : 0 }}>
                <Stat label="Available" value={`${Math.max(MONTHLY_CAPACITY_HOURS - r.committed, 0)}h`} />
                <Stat label="Logged" value="0h" />
                <Stat label="Capacity" value="40h/wk" />
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
                        <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{Math.round(a.hoursPerWeek * 4.4)}h</span>
                        <button onClick={() => removeAssignment(a.id)} style={{ fontSize: 12, fontWeight: 600, color: '#c53030' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '24px 0' }}>No one matches those filters.</div>
          )}
        </div>
      ) : (
        <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, overflow: 'hidden' }}>
          {filtered.map((r) => (
            <div key={r.person.id} style={{ display: 'flex', alignItems: 'center', height: 56, borderBottom: '1px solid #f5f5f5', padding: '0 16px', gap: 12 }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>{r.person.initials}</div>
              <div style={{ width: 200, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.person.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.53)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.person.title || '—'}</div>
              </div>
              <div style={{ flex: 1, height: 10, background: '#f5f5f5', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', background: r.pct > 100 ? '#ff6d33' : r.pct === 0 ? 'transparent' : '#004543' }} />
              </div>
              <span className="mono" style={{ fontSize: 12, width: 44, textAlign: 'right', flexShrink: 0 }}>{r.pct}%</span>
            </div>
          ))}
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
