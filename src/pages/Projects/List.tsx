import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel, NavSep } from '../../components/NavItem'
import { BuildingIcon, PlusIcon, ProjectsIcon, StaffingIcon } from '../../components/icons'
import { useProjects, type BillingType, type ProjectStatus } from '../../data/projects'
import { CURRENT_USER_ID } from '../../data/people'
import CreateProjectModal from '../../components/CreateProjectModal'
import { useNavigate } from 'react-router-dom'
import { Select } from '../../components/SearchableSelect'

const statusBadge: Record<ProjectStatus, string> = {
  Active: 'b-pine',
  'On Track': 'b-pine',
  Completed: 'b-neutral',
}

const stages: BillingType[] = ['Fixed bid', 'Time & materials', 'Retainer']

export default function ProjectsList() {
  const projects = useProjects()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'Any' | ProjectStatus>('Any')
  const [stage, setStage] = useState<'Any' | BillingType>('Any')
  const [client, setClient] = useState('Any')
  const [onlyMine, setOnlyMine] = useState(false)
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

  const activeCount = projects.filter((p) => p.status !== 'Completed').length
  const completedCount = projects.filter((p) => p.status === 'Completed').length
  const totalHours = projects.reduce((sum, p) => sum + p.hoursLogged, 0)

  return (
    <AppShell
      appIcon={<ProjectsIcon size={16} color="var(--color-text-secondary)" />}
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
          { label: 'Total Billable Hours', value: `${totalHours}h`, sub: 'Logged this cycle' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{ flex: 1, padding: '16px 20px', borderRight: i < arr.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted-label)' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.48px', marginTop: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-label)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <div className="field-label">Search</div>
          <input className="input" placeholder="Project or client name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="field-label">Status</div>
          <Select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'Any' | ProjectStatus)}>
            <option value="Any">Any</option>
            <option value="Active">Active</option>
            <option value="On Track">On Track</option>
            <option value="Completed">Completed</option>
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="field-label">Stage</div>
          <Select className="input" value={stage} onChange={(e) => setStage(e.target.value as 'Any' | BillingType)}>
            <option value="Any">Any</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div className="field-label">Client</div>
          <Select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="Any">Any</option>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <span
            onClick={() => setOnlyMine((v) => !v)}
            style={{ width: 32, height: 18, borderRadius: 9999, background: onlyMine ? 'var(--color-control-on)' : 'var(--color-border-subtle)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}
          >
            <span style={{ position: 'absolute', top: 2, left: onlyMine ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
          </span>
          Only mine
        </label>
        <button className="btn-dark" onClick={() => setModalOpen(true)}>Create Project</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{filtered.length} projects</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none' }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{p.client}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`badge ${statusBadge[p.status]}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{p.status}</span>
              {p.staffing && <span className="badge b-neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>Staffing</span>}
              {p.billable && <span className="badge b-neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>Billable</span>}
            </div>
            <div style={{ borderTop: '1px solid var(--table-row-border)', marginTop: 'auto', paddingTop: 10, display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><StaffingIcon size={12} color="currentColor" />{p.teamIds.length}</span>
              <span>{p.hoursLogged}h</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--color-text-secondary)', padding: '24px 0' }}>No projects match those filters.</div>
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
