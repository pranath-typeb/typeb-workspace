import { useMemo, useState } from 'react'
import EmptyState from '../../components/EmptyState'
import { useUrlParam } from '../../lib/useUrlState'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { PeopleIcon, RefreshIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
import { resyncAllPeople, usePeople, type Department } from '../../data/people'
import FilterBar from '../../components/FilterBar'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']

export default function EmployeeRecords() {
  const people = usePeople()
  const [query, setQuery] = useUrlParam('q', '')
  const [jurisdiction, setJurisdiction] = useUrlParam('jurisdiction', 'All')
  const [dept, setDept] = useUrlParam<'All' | Department>('dept', 'All')

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
      appIcon={<PeopleIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="records" />}
    >
      <div className="page-title">Manage: Employee Records</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 640 }}>
          Nucleus-synced records. Placement fields (jurisdiction, department, …) write back to Nucleus; payroll exclusion is local to OS.
        </div>
        <button className="btn-outline" onClick={resyncAllPeople}><RefreshIcon color="var(--color-text-primary)" /> Sync all</button>
      </div>

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: 'Search name or email' }}
        filters={[
          {
            key: 'jurisdiction',
            label: 'Jurisdiction',
            value: jurisdiction,
            defaultValue: 'All',
            onChange: setJurisdiction,
            options: jurisdictions.map((j) => ({ value: j, label: j })),
          },
          {
            key: 'dept',
            label: 'Department',
            value: dept,
            defaultValue: 'All',
            onChange: (v) => setDept(v as 'All' | Department),
            options: departments.map((d) => ({ value: d, label: d })),
          },
        ]}
        count={`${filtered.length} of ${people.length} employees`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {filtered.map((p) => (
          <Link key={p.id} to={`/people/records/${p.id}`} className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="avatar" style={{ width: 34, height: 34, fontSize: 11 }}>{avatarContent(p)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, marginTop: 10 }}>
              {p.jurisdiction ?? '—'} <span style={{ color: 'var(--color-text-tertiary)' }}>·</span> {p.employmentType ?? '—'}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!p.jurisdiction && <span className="badge b-ember">No jurisdiction</span>}
              {p.payrollExcluded && <span className="badge b-ember">No payroll</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>Synced {p.syncedDaysAgo}d ago</div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <EmptyState title="No employees match" />
        )}
      </div>
    </AppShell>
  )
}
