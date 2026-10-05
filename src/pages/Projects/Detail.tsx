import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { avatarContent } from '../../components/Avatar'
import { BuildingIcon, ChevronLeftIcon, EditIcon, ProjectsIcon, StaffingIcon, TrashIcon, PresentationIcon } from '../../components/icons'
import { deleteProject, updateProject, useProjects, type ProjectStatus } from '../../data/projects'
import { personById } from '../../data/people'
import { showToast } from '../../data/toast'
import { addDays, todayLocal, useTimeEntries } from '../../data/timeEntries'
import EditProjectModal from '../../components/EditProjectModal'

const statusBadge: Record<ProjectStatus, string> = {
  Active: 'b-pine',
  'On Track': 'b-pine',
  Completed: 'b-neutral',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projects = useProjects()
  const entries = useTimeEntries()
  const [editing, setEditing] = useState(false)
  const project = projects.find((p) => p.id === id)
  const manager = project?.managerId ? personById(project.managerId) : undefined
  const team = project ? project.teamIds.map((tid) => personById(tid)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : []
  const thirtyDaysAgo = addDays(todayLocal(), -30)
  const hoursLast30Days = project
    ? Math.round((entries.filter((e) => e.projectId === project.id && e.date >= thirtyDaysAgo).reduce((sum, e) => sum + e.minutes, 0) / 60) * 10) / 10
    : 0

  function handleDeactivate() {
    if (!project) return
    const nextStatus = project.status === 'Completed' ? 'Active' : 'Completed'
    updateProject(project.id, { status: nextStatus })
    showToast(`"${project.name}" ${nextStatus === 'Completed' ? 'deactivated' : 'reactivated'}`, nextStatus === 'Completed' ? 'danger' : 'success')
  }

  function handleDelete() {
    if (!project) return
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return
    deleteProject(project.id)
    navigate('/projects')
  }

  return (
    <AppShell
      appIcon={<PresentationIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="Projects"
      appHref="/projects"
      sidebar={
        <>
          <NavGroupLabel label="General" />
          <NavItem to="/projects" icon={<ProjectsIcon color="var(--color-text-inverse)" />} label="Projects" active />
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => navigate('/projects')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeftIcon color="var(--color-text-secondary)" /> Projects
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" style={{ height: 36 }} onClick={() => setEditing(true)}>
                <EditIcon color="var(--color-text-primary)" /> Edit Project
              </button>
              <button onClick={handleDeactivate} style={{ height: 36, padding: '0 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'var(--color-status-warning-border)', color: 'var(--color-status-warning-text)' }}>
                {project.status === 'Completed' ? 'Reactivate' : 'Deactivate'}
              </button>
              <button
                onClick={handleDelete}
                style={{ height: 36, padding: '0 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'var(--danger-bg)', color: 'var(--danger-fg)', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <TrashIcon color="var(--danger-fg)" /> Delete
              </button>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{project.name}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>{project.client}</div>
              <span className={`badge ${statusBadge[project.status]}`} style={{ marginTop: 10, display: 'inline-flex', textTransform: 'uppercase', fontSize: 10 }}>{project.status}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{project.hoursLogged}h</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>logged all time</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{hoursLast30Days}h in the last 30 days</div>
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
            {project.calendarKeywords && project.calendarKeywords.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 6 }}>Calendar keywords</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {project.calendarKeywords.map((kw) => (
                    <span key={kw} className="tag">[{kw}]</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team ({team.length})</div>
            {team.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No one staffed on this project yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: 20 }}>
                {team.map((member) => (
                  <Link key={member.id} to={`/people/${member.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{avatarContent(member)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{member.title || member.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {editing && project && <EditProjectModal project={project} onClose={() => setEditing(false)} />}
    </AppShell>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div className={mono ? 'mono' : undefined} style={{ fontSize: 14, marginTop: 4 }}>{value}</div>
    </div>
  )
}
