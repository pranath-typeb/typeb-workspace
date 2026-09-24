import { useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { BuildingIcon, ProjectsIcon, StaffingIcon } from '../../components/icons'
import { clientSummaries, useProjects } from '../../data/projects'

export default function Clients() {
  const projects = useProjects()
  const [query, setQuery] = useState('')

  const clients = useMemo(() => clientSummaries(projects), [projects])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [clients, query])

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

      <div style={{ maxWidth: 340 }}>
        <div className="field-label">Search</div>
        <input className="input" placeholder="Client name" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{filtered.length} clients</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {filtered.map((c) => (
          <div key={c.name} className="card">
            <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 6 }}>
              {c.total} {c.total === 1 ? 'project' : 'projects'}
              {c.active > 0 ? ` · ${c.active} active` : ''}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '24px 0' }}>No clients match that search.</div>
        )}
      </div>
    </AppShell>
  )
}
