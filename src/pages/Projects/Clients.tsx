import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { BuildingIcon, ProjectsIcon, StaffingIcon } from '../../components/icons'
import { useProjects } from '../../data/projects'
import { clientSummaries, useClientStatuses, type ClientStatus } from '../../data/clients'

type Tab = 'Active' | 'Inactive' | 'All' | 'Removed'

export default function Clients() {
  const projects = useProjects()
  const statuses = useClientStatuses()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('Active')

  const clients = useMemo(() => clientSummaries(projects, statuses), [projects, statuses])

  const counts = useMemo(
    () => ({
      Active: clients.filter((c) => c.status === 'Active').length,
      Inactive: clients.filter((c) => c.status === 'Inactive').length,
      All: clients.length,
      Removed: clients.filter((c) => c.status === 'Removed').length,
    }),
    [clients],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q)
      const matchesTab = tab === 'All' || c.status === tab
      return matchesQuery && matchesTab
    })
  }, [clients, query, tab])

  return (
    <AppShell
      appIcon={<ProjectsIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="Projects"
      appHref="/projects"
      sidebar={
        <>
          <NavGroupLabel label="General" />
          <NavItem to="/projects" icon={<ProjectsIcon />} label="Projects" />
          <NavItem to="/projects/staffing" icon={<StaffingIcon />} label="Staffing" />
          <NavItem to="/projects/clients" icon={<BuildingIcon color="#fafafa" />} label="Clients" active />
        </>
      }
    >
      <div className="page-title">Clients</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 340, flex: 1, minWidth: 220 }}>
          <div className="field-label">Search</div>
          <input className="input" placeholder="Client name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 10, padding: 2 }}>
          {(Object.keys(counts) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: tab === t ? '#171717' : 'transparent',
                color: tab === t ? '#fff' : 'rgba(0,0,0,0.53)',
              }}
            >
              {t}
              <span className="mono" style={{ background: tab === t ? 'rgba(255,255,255,0.15)' : '#e5e5e5', color: tab === t ? '#fff' : '#525252', borderRadius: 9999, fontSize: 11, padding: '1px 7px' }}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{filtered.length} clients</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {filtered.map((c) => (
          <Link key={c.name} to={`/projects/clients/${encodeURIComponent(c.name)}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
              {c.status !== 'Active' && (
                <span className={`badge ${statusBadgeClass(c.status)}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>{c.status}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>
              {c.total} {c.total === 1 ? 'project' : 'projects'}
              {c.active > 0 ? ` · ${c.active} active` : ''}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '24px 0' }}>No clients match those filters.</div>
        )}
      </div>
    </AppShell>
  )
}

function statusBadgeClass(status: ClientStatus): string {
  if (status === 'Inactive') return 'b-ember'
  if (status === 'Removed') return 'b-danger'
  return 'b-pine'
}
