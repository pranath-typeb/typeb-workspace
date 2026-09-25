import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { PeopleIcon, RefreshIcon } from '../../components/icons'
import { resyncAllPeople, usePeople, type Department } from '../../data/people'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']

export default function EmployeeRecords() {
  const people = usePeople()
  const [query, setQuery] = useState('')
  const [jurisdiction, setJurisdiction] = useState('All')
  const [dept, setDept] = useState<'All' | Department>('All')

  const jurisdictions = useMemo(
    () => Array.from(new Set(people.map((p) => p.jurisdiction).filter((j): j is string => Boolean(j)))).sort(),
    [people],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      const matchesJurisdiction = jurisdiction === 'All' || p.jurisdiction === jurisdiction
      const matchesDept = dept === 'All' || p.department === dept
      return matchesQuery && matchesJurisdiction && matchesDept
    })
  }, [people, query, jurisdiction, dept])

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="records" />}
    >
      <div className="page-title">Manage: Employee Records</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', maxWidth: 640 }}>
          Nucleus-synced records. Placement fields (jurisdiction, department, …) write back to Nucleus; payroll exclusion is local to OS.
        </div>
        <button className="btn-outline" onClick={resyncAllPeople}><RefreshIcon color="#0f0f10" /> Sync all</button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="field-label">Search</div>
          <input className="input" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <div className="field-label">Jurisdiction</div>
          <select className="input" style={{ width: 180 }} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
            <option value="All">All jurisdictions</option>
            {jurisdictions.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="field-label">Department</div>
          <select className="input" style={{ width: 170 }} value={dept} onChange={(e) => setDept(e.target.value as 'All' | Department)}>
            <option value="All">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>Showing {filtered.length} of {people.length} employees</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {filtered.map((p) => (
          <Link key={p.id} to={`/people/records/${p.id}`} className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="avatar" style={{ width: 34, height: 34, fontSize: 11 }}>{p.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, marginTop: 10 }}>
              {p.jurisdiction ?? '—'} <span style={{ color: 'rgba(0,0,0,0.3)' }}>·</span> {p.employmentType ?? '—'}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!p.jurisdiction && <span className="badge b-ember">No jurisdiction</span>}
              {p.payrollExcluded && <span className="badge b-ember">No payroll</span>}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 8 }}>Synced {p.syncedDaysAgo}d ago</div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '24px 0' }}>No one matches those filters.</div>
        )}
      </div>
    </AppShell>
  )
}
