import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { avatarContent } from '../../components/Avatar'
import { BuildingIcon, EditIcon, ProjectsIcon, StaffingIcon, TrashIcon, PresentationIcon } from '../../components/icons'
import Breadcrumb from '../../components/Breadcrumb'
import { deleteProject, updateProject, useProjects, type ProjectStatus } from '../../data/projects'
import { personById, usePeople } from '../../data/people'
import SearchableSelect from '../../components/SearchableSelect'
import { showToast } from '../../data/toast'
import { exportEntriesToCSV, todayLocal, useTimeEntries } from '../../data/timeEntries'
import { useAssignments } from '../../data/staffing'
import { useLeaveRequests } from '../../data/leave'
import { useCalendarEvents } from '../../data/calendarEvents'
import { startTimer } from '../../data/timer'
import { triggerScreenRipple } from '../../data/screenRipple'
import { computeProjectStats, fmtHours, projectEntries, projectHeadsUp } from '../../data/projectInsights'
import EditProjectModal from '../../components/EditProjectModal'
import AddTimeEntryModal from '../../components/AddTimeEntryModal'
import CommitHoursModal from '../../components/CommitHoursModal'
import { ActivityPanel, CategoryBreakdown, HeadsUpPanel, HealthBadge, HealthStrip, TeamPanel, WeeklyChart } from '../../components/ProjectPanels'
import { DownloadIcon, PlayIcon, ClockIcon, CloseIcon } from '../../components/icons'

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
  const assignments = useAssignments()
  const leave = useLeaveRequests()
  const calendarEvents = useCalendarEvents()
  const [editing, setEditing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [commitFor, setCommitFor] = useState<string | null | undefined>(undefined) // undefined = closed, null = pick a person
  const project = projects.find((p) => p.id === id)
  const manager = project?.managerId ? personById(project.managerId) : undefined
  const today = todayLocal()
  const stats = useMemo(() => (project ? computeProjectStats(project, entries, assignments, today) : null), [project, entries, assignments, today])
  const headsUp = useMemo(() => (project && stats ? projectHeadsUp(project, stats, assignments, leave, calendarEvents, today) : []), [project, stats, assignments, leave, calendarEvents, today])
  const commitPerson = commitFor ? personById(commitFor) : undefined

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
            <Breadcrumb items={[{ label: 'Projects', to: '/projects' }, { label: project.name }]} />
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

          <div className="card pp-hero">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px' }}>{project.name}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>{project.client}{manager ? ` · Managed by ${manager.name}` : ''}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${statusBadge[project.status]}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{project.status}</span>
                {stats && <HealthBadge health={stats.health} label={stats.healthLabel} />}
              </div>
            </div>
            {stats && (
              <div className="pp-hero-stats">
                <div className="pp-hero-stat">
                  <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{fmtHours(stats.totalMinutes)}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>logged all time</div>
                </div>
                <div className="pp-hero-stat">
                  <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{fmtHours(stats.last30Minutes)}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>last 30 days</div>
                </div>
              </div>
            )}
            <div className="pp-actions" style={{ width: '100%' }}>
              <button
                className="btn-dark"
                style={{ height: 36 }}
                disabled={project.status === 'Completed'}
                onClick={() => {
                  startTimer({ description: '', projectId: project.id, category: 'Development' })
                  triggerScreenRipple()
                  showToast(`Timer started on ${project.name}`, 'success')
                }}
              >
                <PlayIcon size={13} color="currentColor" /> Start timer
              </button>
              <button className="btn-outline" style={{ height: 36 }} onClick={() => setLogging(true)}>
                <ClockIcon size={14} color="var(--color-text-primary)" /> Log time
              </button>
              <button
                className="btn-outline"
                style={{ height: 36 }}
                disabled={!stats || stats.totalMinutes === 0}
                onClick={() => exportEntriesToCSV(projectEntries(entries, project.id), `${project.id}-time.csv`)}
              >
                <DownloadIcon size={14} color="var(--color-text-primary)" /> Export hours
              </button>
            </div>
          </div>

          {stats && <HealthStrip stats={stats} status={project.status} billable={project.billable} />}

          {stats && (
            <div className="pp-grid">
              <div className="pp-col">
                <WeeklyChart weekly={stats.weekly} prevWeekMinutes={stats.prevWeekMinutes} weekMinutes={stats.weekMinutes} />
                <TeamPanel members={stats.members} contributors={stats.contributors} today={today} onCommit={(pid) => setCommitFor(pid)} onAdd={() => setCommitFor(null)} />
                <ActivityPanel recent={stats.recent} today={today} />
              </div>
              <div className="pp-col">
                <HeadsUpPanel items={headsUp} />
                <CategoryBreakdown byCategory={stats.byCategory} total={stats.totalMinutes} />
                  <div className="card pp-card">
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                      <Detail label="Starts" value={new Date(project.starts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                      <Detail label="Ends" value={new Date(project.ends).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                      <Detail label="Billing" value={project.billing} />
                      <Detail label="Billable" value={project.billable ? 'Billable' : 'Non-billable'} />
                      <Detail label="Project Manager" value={manager?.name ?? '—'} />
                      <Detail label="Team Size" value={String(stats.members.length)} mono />
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
              </div>
            </div>
          )}
        </>
      )}

      {editing && project && <EditProjectModal project={project} onClose={() => setEditing(false)} />}
      {logging && project && <AddTimeEntryModal date={today} defaultProjectId={project.id} onClose={() => setLogging(false)} />}
      {commitFor !== undefined && project && (
        commitPerson ? (
          <CommitHoursModal person={commitPerson} defaultProjectId={project.id} onClose={() => setCommitFor(undefined)} />
        ) : (
          <PickPersonToCommit team={stats?.members.map((m) => m.personId) ?? []} onPick={(pid) => setCommitFor(pid)} onClose={() => setCommitFor(undefined)} />
        )
      )}
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

// "Commit hours" from the project page: choose who first (team members first), then the usual commit form.
function PickPersonToCommit({ team, onPick, onClose }: { team: string[]; onPick: (personId: string) => void; onClose: () => void }) {
  const everyone = usePeople()
  const [pid, setPid] = useState('')
  const sorted = [...everyone.filter((p) => team.includes(p.id)), ...everyone.filter((p) => !team.includes(p.id))]
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Who are you staffing?</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>
        <div>
          <div className="field-label">Person</div>
          <SearchableSelect value={pid} onChange={setPid} placeholder="Choose a person" options={sorted.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!pid} onClick={() => onPick(pid)}>Continue</button>
        </div>
      </div>
    </div>
  )
}
