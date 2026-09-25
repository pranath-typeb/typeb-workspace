import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { BuildingIcon, ChevronLeftIcon, ProjectsIcon, StaffingIcon } from '../../components/icons'
import { useProjects, type ProjectStatus } from '../../data/projects'
import { setClientStatus, useClientStatuses, type ClientStatus } from '../../data/clients'
import CreateProjectModal from '../../components/CreateProjectModal'

const statusBadge: Record<ProjectStatus, string> = {
  Active: 'b-pine',
  'On Track': 'b-pine',
  Completed: 'b-neutral',
}

const clientStatuses: ClientStatus[] = ['Active', 'Inactive', 'Removed']

export default function ClientDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const projects = useProjects()
  const statuses = useClientStatuses()
  const [modalOpen, setModalOpen] = useState(false)

  const clientName = name ? decodeURIComponent(name) : ''
  const clientProjects = useMemo(() => projects.filter((p) => p.client === clientName), [projects, clientName])
  const allClients = useMemo(() => Array.from(new Set(projects.map((p) => p.client))).sort(), [projects])
  const status = statuses[clientName]?.status ?? 'Active'
  const activeCount = clientProjects.filter((p) => p.status !== 'Completed').length

  if (!clientName || clientProjects.length === 0) {
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
      <div className="page-title">Client</div>

      <button
        onClick={() => navigate('/projects/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}
      >
        <ChevronLeftIcon color="rgba(0,0,0,0.53)" /> Clients
      </button>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{clientName}</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 6 }}>
            {clientProjects.length} {clientProjects.length === 1 ? 'project' : 'projects'}
            {activeCount > 0 ? ` · ${activeCount} active` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select className="input" style={{ width: 140 }} value={status} onChange={(e) => setClientStatus(clientName, e.target.value as ClientStatus)}>
            {clientStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{clientProjects.length}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>project{clientProjects.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Projects</div>
        <button className="btn-dark" onClick={() => setModalOpen(true)}>+ Add project</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {clientProjects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none' }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>{p.client}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`badge ${statusBadge[p.status]}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{p.status}</span>
              {p.staffing && <span className="badge b-neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>Staffing</span>}
              {p.billable && <span className="badge b-neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>Billable</span>}
            </div>
            <div style={{ borderTop: '1px solid #f5f5f5', marginTop: 'auto', paddingTop: 10, display: 'flex', gap: 16, fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><StaffingIcon size={12} color="currentColor" />{p.teamIds.length}</span>
              <span>{p.hoursLogged}h</span>
            </div>
          </Link>
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
