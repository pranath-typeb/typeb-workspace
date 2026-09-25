import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { PeopleIcon } from '../../components/icons'
import { people, deptBadgeClass, localTimeFor, type Department } from '../../data/people'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']

export default function Directory() {
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState<'All' | Department>('All')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q)
      const matchesDept = dept === 'All' || p.department === dept
      return matchesQuery && matchesDept
    })
  }, [query, dept])

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="directory" />}
    >
      <div className="page-title">Directory</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="field-label">Search</div>
          <input
            className="input"
            placeholder="Name, email, title or department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <div className="field-label">Department</div>
          <select className="input" style={{ width: 160 }} value={dept} onChange={(e) => setDept(e.target.value as 'All' | Department)}>
            <option value="All">All</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>{filtered.length} people</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {filtered.map((p) => (
          <Link to={`/people/${p.id}`} key={p.id} className="card" style={{ display: 'block' }}>
            <div className="avatar">{p.initials}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 10 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 8, minHeight: 16 }}>{p.title || ' '}</div>
            {p.department && <span className={`badge ${deptBadgeClass[p.department]}`}>{p.department.toUpperCase()}</span>}
            <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{p.email}</div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{localTimeFor(p.timezone)} · {p.timezone}</div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', gridColumn: '1 / -1', padding: '24px 0' }}>
            No one matches that search.
          </div>
        )}
      </div>
    </AppShell>
  )
}
