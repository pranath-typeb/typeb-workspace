import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { OrgChartIcon, PeopleIcon, ProjectsIcon } from '../../components/icons'
import { CURRENT_USER_ID, people, personById } from '../../data/people'
import { useProjects } from '../../data/projects'

function reportingChain(personId: string) {
  const chain = []
  let current = personById(personId)
  while (current) {
    chain.unshift(current)
    current = current.managerId ? personById(current.managerId) : undefined
  }
  return chain
}

export default function MyTeam() {
  const [tab, setTab] = useState<'reporting' | 'projects'>('reporting')
  const chain = useMemo(() => reportingChain(CURRENT_USER_ID), [])
  const directReports = people.filter((p) => p.managerId === CURRENT_USER_ID)
  const projects = useProjects()

  const projectTeammates = useMemo(() => {
    const myProjects = projects.filter((p) => p.teamIds.includes(CURRENT_USER_ID))
    const teammateIds = new Set<string>()
    myProjects.forEach((p) => p.teamIds.forEach((id) => {
      if (id !== CURRENT_USER_ID) teammateIds.add(id)
    }))
    return { myProjects, teammates: Array.from(teammateIds).map((id) => personById(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) }
  }, [projects])

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="my-team" />}
    >
      <div className="page-title">My team</div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <button
          onClick={() => setTab('reporting')}
          style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, borderBottom: tab === 'reporting' ? '2px solid #171717' : '2px solid transparent', color: tab === 'reporting' ? '#0f0f10' : 'rgba(0,0,0,0.53)' }}
        >
          Reporting line
        </button>
        <button
          onClick={() => setTab('projects')}
          style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, borderBottom: tab === 'projects' ? '2px solid #171717' : '2px solid transparent', color: tab === 'projects' ? '#0f0f10' : 'rgba(0,0,0,0.53)' }}
        >
          Project teammates
        </button>
      </div>

      {tab === 'reporting' ? (
        <>
          {chain.length > 1 && (
            <div className="card">
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 10 }}>Your reporting line</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {chain.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {i > 0 && <span style={{ color: 'rgba(0,0,0,0.3)' }}>›</span>}
                    <Link to={`/people/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{p.initials}</div>
                      {i === chain.length - 1 ? (
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name} <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.53)' }}>(you)</span></div>
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {directReports.length > 0 ? (
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Direct reports ({directReports.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {directReports.map((r) => (
                  <Link key={r.id} to={`/people/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{r.initials}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{r.title || r.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'rgba(0,0,0,0.4)' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <OrgChartIcon size={32} color="rgba(0,0,0,0.3)" />
              </div>
              <div style={{ fontSize: 14 }}>You have no direct reports.</div>
              <Link to="/people/org-chart" style={{ fontSize: 13, color: '#004543', fontWeight: 600, marginTop: 6, display: 'inline-block' }}>Find yourself in the org chart</Link>
            </div>
          )}
        </>
      ) : (
        <>
          {projectTeammates.myProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'rgba(0,0,0,0.4)' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <ProjectsIcon size={32} color="rgba(0,0,0,0.3)" />
              </div>
              <div style={{ fontSize: 14 }}>You're not staffed on any projects yet.</div>
              <Link to="/projects" style={{ fontSize: 13, color: '#004543', fontWeight: 600, marginTop: 6, display: 'inline-block' }}>Browse projects</Link>
            </div>
          ) : (
            projectTeammates.myProjects.map((proj) => {
              const teammates = proj.teamIds.filter((id) => id !== CURRENT_USER_ID).map((id) => personById(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))
              return (
                <div key={proj.id} className="card">
                  <Link to={`/projects/${proj.id}`} style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'block' }}>{proj.name}</Link>
                  {teammates.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>No other teammates on this project.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {teammates.map((t) => (
                        <Link key={t.id} to={`/people/${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{t.initials}</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{t.title || t.email}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}
    </AppShell>
  )
}
