import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { BuildingIcon, ChevronLeftIcon, EditIcon, ProjectsIcon, StaffingIcon, TrashIcon } from '../../components/icons'
import { deleteProject, updateProject, useProjects, type ProjectStatus } from '../../data/projects'
import { personById } from '../../data/people'

const statusBadge: Record<ProjectStatus, string> = {
  Active: 'b-pine',
  'On Track': 'b-pine',
  Completed: 'b-neutral',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projects = useProjects()
  const project = projects.find((p) => p.id === id)
  const manager = project?.managerId ? personById(project.managerId) : undefined
  const team = project ? project.teamIds.map((tid) => personById(tid)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : []

  function handleDeactivate() {
    if (!project) return
    updateProject(project.id, { status: project.status === 'Completed' ? 'Active' : 'Completed' })
  }

  function handleDelete() {
    if (!project) return
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return
    deleteProject(project.id)
    navigate('/projects')
  }

  return (
    <AppShell
      appIcon={<ProjectsIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="Projects"
      appHref="/projects"
      sidebar={
        <>
          <NavGroupLabel label="General" />
          <NavItem to="/projects" icon={<ProjectsIcon color="#fafafa" />} label="Projects" active />
          <NavItem to="/projects/staffing" icon={<StaffingIcon />} label="Staffing" />
          <NavItem to="/projects/clients" icon={<BuildingIcon />} label="Clients" />
        </>
      }
    >
      <div className="page-title">Project</div>

      {!project ? (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that project.</div>
          <Link to="/projects" className="btn-outline">Back to projects</Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => navigate('/projects')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}
            >
              <ChevronLeftIcon color="rgba(0,0,0,0.53)" /> Projects
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" style={{ height: 36 }}>
                <EditIcon color="#0f0f10" /> Edit Project
              </button>
              <button onClick={handleDeactivate} style={{ height: 36, padding: '0 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#ffdacc', color: '#cc3a00' }}>
                {project.status === 'Completed' ? 'Reactivate' : 'Deactivate'}
              </button>
              <button
                onClick={handleDelete}
                style={{ height: 36, padding: '0 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#ffe0e0', color: '#c53030', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <TrashIcon color="#c53030" /> Delete
              </button>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{project.name}</div>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.53)', marginTop: 4 }}>{project.client}</div>
              <span className={`badge ${statusBadge[project.status]}`} style={{ marginTop: 10, display: 'inline-flex', textTransform: 'uppercase', fontSize: 10 }}>{project.status}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{project.hoursLogged}h</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 4 }}>logged all time</div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <Detail label="Starts" value={new Date(project.starts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <Detail label="Ends" value={new Date(project.ends).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <Detail label="Billing" value={project.billing} />
              <Detail label="Billable" value={project.billable ? 'Billable' : 'Non-billable'} />
              <Detail label="Project Manager" value={manager?.name ?? '—'} />
              <Detail label="Team Size" value={String(team.length)} mono />
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team ({team.length})</div>
            {team.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>No one staffed on this project yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {team.map((member) => (
                  <Link key={member.id} to={`/people/${member.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{member.initials}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{member.title || member.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.53)' }}>{label}</div>
      <div className={mono ? 'mono' : undefined} style={{ fontSize: 14, marginTop: 4 }}>{value}</div>
    </div>
  )
}
