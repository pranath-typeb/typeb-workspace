import { useMemo, useState } from 'react'
import ProjectCard from '../../components/ProjectCard'
import EmptyState from '../../components/EmptyState'
import { useUrlParam, useUrlFlag } from '../../lib/useUrlState'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel, NavSep } from '../../components/NavItem'
import { BuildingIcon, PlusIcon, ProjectsIcon, StaffingIcon, PresentationIcon } from '../../components/icons'
import { useProjects, type BillingType, type ProjectStatus } from '../../data/projects'
import { CURRENT_USER_ID, personById } from '../../data/people'
import { avatarContent } from '../../components/Avatar'
import { useTimeEntries, todayLocal } from '../../data/timeEntries'
import { useAssignments } from '../../data/staffing'
import { computeProjectStats, fmtHours } from '../../data/projectInsights'
import { HealthBadge } from '../../components/ProjectPanels'
import CreateProjectModal from '../../components/CreateProjectModal'
import { useNavigate } from 'react-router-dom'
import FilterBar from '../../components/FilterBar'

const statusBadge: Record<ProjectStatus, string> = {
  Active: 'b-pine',
  'On Track': 'b-pine',
  Completed: 'b-neutral',
}

const stages: BillingType[] = ['Fixed bid', 'Time & materials', 'Retainer']

export default function ProjectsList() {
  const projects = useProjects()
  const navigate = useNavigate()
  const [query, setQuery] = useUrlParam('q', '')
  const [status, setStatus] = useUrlParam<'Any' | ProjectStatus>('status', 'Any')
  const [stage, setStage] = useUrlParam<'Any' | BillingType>('billing', 'Any')
  const [client, setClient] = useUrlParam('client', 'Any')
  const [onlyMine, setOnlyMine] = useUrlFlag('mine')
  const [modalOpen, setModalOpen] = useState(false)

  const clients = useMemo(() => Array.from(new Set(projects.map((p) => p.client))).sort(), [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
      const matchesStatus = status === 'Any' || p.status === status
      const matchesStage = stage === 'Any' || p.billing === stage
      const matchesClient = client === 'Any' || p.client === client
      const matchesMine = !onlyMine || p.managerId === CURRENT_USER_ID || p.teamIds.includes(CURRENT_USER_ID)
      return matchesQuery && matchesStatus && matchesStage && matchesClient && matchesMine
    })
  }, [projects, query, status, stage, client, onlyMine])

  const entries = useTimeEntries()
  const assignments = useAssignments()
  const today = todayLocal()
  const statsById = useMemo(() => new Map(projects.map((p) => [p.id, computeProjectStats(p, entries, assignments, today)])), [projects, entries, assignments, today])

  const activeCount = projects.filter((p) => p.status !== 'Completed').length
  const completedCount = projects.filter((p) => p.status === 'Completed').length
  const totalMinutes = Array.from(statsById.values()).reduce((sum, st) => sum + st.totalMinutes, 0)

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
      <div className="page-title">Projects</div>

      <div className="stat-strip" style={{ display: 'flex', border: '1px solid var(--color-border-default)', borderRadius: 14, overflow: 'hidden' }}>
        {[
          { label: 'All Projects', value: projects.length, sub: 'Across all clients' },
          { label: 'Active Projects', value: activeCount, sub: 'Currently in progress' },
          { label: 'Completed Projects', value: completedCount, sub: 'Delivered to date' },
          { label: 'Hours Logged', value: fmtHours(totalMinutes), sub: 'Across all projects' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{ flex: 1, padding: '16px 20px', borderRight: i < arr.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted-label)' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.48px', marginTop: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-label)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: 'Search project or client' }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: status,
            defaultValue: 'Any',
            onChange: (v) => setStatus(v as 'Any' | ProjectStatus),
            options: ['Active', 'On Track', 'Completed'].map((v) => ({ value: v, label: v })),
          },
          {
            key: 'stage',
            label: 'Billing',
            value: stage,
            defaultValue: 'Any',
            onChange: (v) => setStage(v as 'Any' | BillingType),
            options: stages.map((v) => ({ value: v, label: v })),
          },
          {
            key: 'client',
            label: 'Client',
            value: client,
            defaultValue: 'Any',
            onChange: setClient,
            options: clients.map((v) => ({ value: v, label: v })),
          },
        ]}
        toggles={[{ key: 'mine', label: 'Only mine', value: onlyMine, onChange: setOnlyMine }]}
        count={`${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}`}
        trailing={<button className="btn-dark" onClick={() => setModalOpen(true)}>Create Project</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} stats={statsById.get(p.id)} />
        ))}
        {filtered.length === 0 && (
          <EmptyState title="No projects match" />
        )}
      </div>

      {modalOpen && (
        <CreateProjectModal
          existingClients={clients}
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
