import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel, NavSep } from '../../components/NavItem'
import { GridIcon, OrgChartIcon, PeopleIcon, InsightsIcon, RecordsIcon, ChevronLeftIcon } from '../../components/icons'
import { people, personById, deptBadgeClass, localTimeFor } from '../../data/people'

function tenureFrom(startDate: string): string {
  const start = new Date(startDate)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 1) return '< 1 mo'
  if (months < 12) return `${months} mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem ? `${years} yr ${rem} mo` : `${years} yr`
}

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const person = id ? personById(id) : undefined
  const manager = person?.managerId ? personById(person.managerId) : undefined
  const reports = person ? people.filter((p) => p.managerId === person.id) : []

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={
        <>
          <NavItem to="/people" icon={<GridIcon />} label="Directory" />
          <NavItem to="/people/org-chart" icon={<OrgChartIcon />} label="Org chart" />
          <NavItem to="/people/my-team" icon={<PeopleIcon />} label="My team" />
          <NavItem to="/people/insights" icon={<InsightsIcon />} label="Insights" />
          <NavSep />
          <NavGroupLabel label="Manage" />
          <NavItem to="/people/records" icon={<RecordsIcon />} label="Employee records" />
        </>
      }
    >
      <div className="page-title">Profile</div>

      {!person ? (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that person.</div>
          <Link to="/people" className="btn-outline">Back to directory</Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => navigate('/people')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}
            >
              <ChevronLeftIcon color="rgba(0,0,0,0.53)" /> Directory
            </button>
            <Link to="/people/org-chart" className="btn-outline">
              <OrgChartIcon size={14} color="#0f0f10" /> Show in org chart
            </Link>
          </div>

          <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="avatar" style={{ width: 64, height: 64, fontSize: 18 }}>{person.initials}</div>
            <div>
              <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.8px' }}>{person.name}</div>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.53)', margin: '2px 0 8px' }}>{person.title || 'No title set'}</div>
              {person.department && (
                <div style={{ marginBottom: 8 }}>
                  <span className={`badge ${deptBadgeClass[person.department]}`}>{person.department}</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: '#004543', marginBottom: 2 }}>{person.email}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>{localTimeFor(person.timezone)} local · {person.timezone}</div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Detail label="Department" value={person.department ?? '—'} />
              <Detail label="Manager" value={manager?.name ?? '—'} />
              <Detail label="Started" value={new Date(person.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <Detail label="Tenure" value={tenureFrom(person.startDate)} />
              <Detail label="Timezone" value={person.timezone} />
            </div>
          </div>

          {manager && (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Reporting line</div>
              <Link to={`/people/${manager.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{manager.initials}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{manager.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{manager.title || manager.email}</div>
                </div>
              </Link>
            </div>
          )}

          {reports.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Direct reports ({reports.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reports.map((r) => (
                  <Link to={`/people/${r.id}`} key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{r.initials}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{r.title || r.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{value}</div>
    </div>
  )
}
