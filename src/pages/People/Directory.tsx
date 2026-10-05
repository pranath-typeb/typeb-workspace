import { useMemo, useState } from 'react'
import EmptyState from '../../components/EmptyState'
import { useUrlParam } from '../../lib/useUrlState'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { PeopleIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
import { people, deptBadgeClass, localTimeFor, type Department } from '../../data/people'
import FilterBar from '../../components/FilterBar'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']

export default function Directory() {
  const [query, setQuery] = useUrlParam('q', '')
  const [dept, setDept] = useUrlParam<'All' | Department>('dept', 'All')

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
      appIcon={<PeopleIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="directory" />}
    >
      <div className="page-title">Directory</div>

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: 'Search name, email or title' }}
        filters={[
          {
            key: 'dept',
            label: 'Department',
            value: dept,
            defaultValue: 'All',
            onChange: (v) => setDept(v as 'All' | Department),
            options: departments.map((d) => ({ value: d, label: d })),
          },
        ]}
        count={`${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {filtered.map((p) => (
          <Link to={`/people/${p.id}`} key={p.id} className="card" style={{ display: 'block' }}>
            <div className="avatar">{avatarContent(p)}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 10 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, minHeight: 16 }}>{p.title || ' '}</div>
            {p.department && <span className={`badge ${deptBadgeClass[p.department]}`}>{p.department.toUpperCase()}</span>}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.email}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{localTimeFor(p.timezone)} · {p.timezone}</div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <EmptyState title="No one matches" />
        )}
      </div>
    </AppShell>
  )
}
