import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { BuildingIcon, ProjectsIcon, StaffingIcon, PresentationIcon } from '../../components/icons'
import Breadcrumb from '../../components/Breadcrumb'
import { useProjects } from '../../data/projects'
import ProjectCard from '../../components/ProjectCard'
import { useTimeEntries, todayLocal } from '../../data/timeEntries'
import { useAssignments } from '../../data/staffing'
import { computeClientStats, computeProjectStats, fmtHours } from '../../data/projectInsights'
import { setClientStatus, useClientStatuses, type ClientStatus } from '../../data/clients'
import CreateProjectModal from '../../components/CreateProjectModal'
import { Select } from '../../components/SearchableSelect'

const clientStatuses: ClientStatus[] = ['Active', 'Inactive', 'Removed']

export default function ClientDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const projects = useProjects()
  const statuses = useClientStatuses()
  const [modalOpen, setModalOpen] = useState(false)
  const entries = useTimeEntries()
  const assignments = useAssignments()
  const today = todayLocal()

  const clientName = name ? decodeURIComponent(name) : ''
  const clientProjects = useMemo(() => projects.filter((p) => p.client === clientName), [projects, clientName])
  const allClients = useMemo(() => Array.from(new Set(projects.map((p) => p.client))).sort(), [projects])
  const clientStats = useMemo(() => computeClientStats(clientProjects, entries, today), [clientProjects, entries, today])
  const projectStats = useMemo(() => new Map(clientProjects.map((p) => [p.id, computeProjectStats(p, entries, assignments, today)])), [clientProjects, entries, assignments, today])
  const status = statuses[clientName]?.status ?? 'Active'
  const activeCount = clientProjects.filter((p) => p.status !== 'Completed').length

  if (!clientName || clientProjects.length === 0) {
    return (
      <AppShell
        appIcon={<PresentationIcon size={16} color="var(--color-text-secondary)" />}
        appLabel="Projects"
        appHref="/projects"
        sidebar={
          <>
            <NavGroupLabel label="General" />
            <NavItem to="/projects" icon={<ProjectsIcon />} label="Projects" />
            <NavItem to="/projects/staffing" icon={<StaffingIcon />} label="Staffing" />
            <NavItem to="/projects/clients" icon={<BuildingIcon color="var(--color-text-inverse)" />} label="Clients" active />
          </>
        }
      >
        <div className="page-title">Client</div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that client.</div>
          <Link to="/projects/clients" className="btn-outline">Back to clients</Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      appIcon={<PresentationIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="Projects"
      appHref="/projects"
      sidebar={
        <>
          <NavGroupLabel label="General" />
          <NavItem to="/projects" icon={<ProjectsIcon />} label="Projects" />
          <NavItem to="/projects/staffing" icon={<StaffingIcon />} label="Staffing" />
          <NavItem to="/projects/clients" icon={<BuildingIcon color="var(--color-text-inverse)" />} label="Clients" active />
        </>
      }
    >
      <div className="page-title">Client</div>

      <Breadcrumb
        items={[
          { label: 'Projects', to: '/projects' },
          { label: 'Clients', to: '/projects/clients' },
          { label: clientName },
        ]}
      />

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{clientName}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
            {clientProjects.length} {clientProjects.length === 1 ? 'project' : 'projects'}
            {activeCount > 0 ? ` · ${activeCount} active` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select className="input" style={{ width: 140 }} value={status} onChange={(e) => setClientStatus(clientName, e.target.value as ClientStatus)}>
            {clientStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="pp-strip">
        <div className="pp-tile">
          <div className="pp-tile-label">Hours logged</div>
          <div className="pp-tile-value mono">{fmtHours(clientStats.totalMinutes)}</div>
          <div className="pp-tile-sub">across {clientProjects.length} {clientProjects.length === 1 ? 'project' : 'projects'}</div>
        </div>
        <div className="pp-tile">
          <div className="pp-tile-label">This month</div>
          <div className="pp-tile-value mono">{fmtHours(clientStats.monthMinutes)}</div>
          <div className="pp-tile-sub">{activeCount} active {activeCount === 1 ? 'project' : 'projects'}</div>
        </div>
        <div className="pp-tile">
          <div className="pp-tile-label">People involved</div>
          <div className="pp-tile-value mono">{clientStats.people}</div>
          <div className="pp-tile-sub">on teams or logging time</div>
        </div>
      </div>

      <div className="card pp-card">
        <div className="pp-card-head">
          <div className="pp-card-title">Hours by month</div>
          <div className="pp-card-meta">Last 6 months</div>
        </div>
        <div className="pp-bars" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }} role="img" aria-label="Hours logged per month for this client">
          {clientStats.monthly.map((m, i) => {
            const max = Math.max(...clientStats.monthly.map((m) => m.minutes), 60)
            const last = i === clientStats.monthly.length - 1
            return (
              <div key={m.month} className="pp-bar-col">
                <div className="pp-bar-val mono">{m.minutes ? fmtHours(m.minutes) : ''}</div>
                <div className="pp-bar-track">
                  <div className="pp-bar" style={{ height: `${(m.minutes / max) * 100}%`, background: last ? 'var(--brand-mid)' : 'var(--brand-bar)', opacity: last ? 1 : 0.7 }} />
                </div>
                <div className="pp-bar-label">{m.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Projects</div>
        <button className="btn-dark" onClick={() => setModalOpen(true)}>+ Add project</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {clientProjects.map((p) => (
          <ProjectCard key={p.id} project={p} stats={projectStats.get(p.id)} />
        ))}
      </div>

      {modalOpen && (
        <CreateProjectModal
          initialClient={clientName}
          existingClients={allClients}
          onClose={() => setModalOpen(false)}
          onCreated={(id) => {
            setModalOpen(false)
            navigate(`/projects/${id}`)
          }}
        />
      )}
    </AppShell>
  )
}
