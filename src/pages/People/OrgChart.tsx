import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { PeopleIcon } from '../../components/icons'
import { people, type Person } from '../../data/people'

function NodeCard({ person }: { person: Person }) {
  return (
    <Link
      to={`/people/${person.id}`}
      style={{
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 10,
        padding: '8px 10px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: 170,
      }}
    >
      <div className="avatar" style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>{person.initials}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</div>
        <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.53)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.title || '—'}</div>
      </div>
    </Link>
  )
}

function Branch({ person, depth }: { person: Person; depth: number }) {
  const reports = people.filter((p) => p.managerId === person.id)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <NodeCard person={person} />
      {reports.length > 0 && (
        <div style={{ display: 'flex', gap: depth === 0 ? 24 : 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {reports.map((r) => (
            <Branch key={r.id} person={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChart() {
  const roots = people.filter((p) => !p.managerId)

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="org-chart" />}
    >
      <div className="page-title">Org chart</div>
      <div className="card" style={{ minHeight: 400, position: 'relative', overflow: 'auto', background: '#fafafa' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, padding: 30 }}>
          {roots.map((root) => (
            <Branch key={root.id} person={root} depth={0} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
