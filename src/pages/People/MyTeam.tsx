import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { OrgChartIcon, PeopleIcon, ProjectsIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
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
      appIcon={<PeopleIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="my-team" />}
    >
      <div className="page-title">My team</div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--color-border-default)' }}>
        <button
          onClick={() => setTab('reporting')}
          style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, borderBottom: tab === 'reporting' ? '2px solid var(--color-text-primary)' : '2px solid transparent', color: tab === 'reporting' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
        >
          Reporting line
        </button>
        <button
          onClick={() => setTab('projects')}
          style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, borderBottom: tab === 'projects' ? '2px solid var(--color-text-primary)' : '2px solid transparent', color: tab === 'projects' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
        >
          Project teammates
        </button>
      </div>

      {tab === 'reporting' ? (
        <>
          {chain.length > 1 && (
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Your reporting line</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {chain.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {i > 0 && <span style={{ color: 'var(--color-text-tertiary)' }}>›</span>}
                    <Link to={`/people/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(p)}</div>
                      {i === chain.length - 1 ? (
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(you)</span></div>
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
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(r)}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{r.title || r.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--color-text-tertiary)' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <OrgChartIcon size={32} color="var(--color-text-tertiary)" />
              </div>
              <div style={{ fontSize: 14 }}>You have no direct reports.</div>
              <Link to="/people/org-chart" style={{ fontSize: 13, color: 'var(--brand-text)', fontWeight: 600, marginTop: 6, display: 'inline-block' }}>Find yourself in the org chart</Link>
            </div>
          )}
        </>
      ) : (
        <>
          {projectTeammates.myProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--color-text-tertiary)' }}>
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <ProjectsIcon size={32} color="var(--color-text-tertiary)" />
              </div>
              <div style={{ fontSize: 14 }}>You're not staffed on any projects yet.</div>
              <Link to="/projects" style={{ fontSize: 13, color: 'var(--brand-text)', fontWeight: 600, marginTop: 6, display: 'inline-block' }}>Browse projects</Link>
            </div>
          ) : (
            projectTeammates.myProjects.map((proj) => {
              const teammates = proj.teamIds.filter((id) => id !== CURRENT_USER_ID).map((id) => personById(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))
              return (
                <div key={proj.id} className="card">
                  <Link to={`/projects/${proj.id}`} style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'block' }}>{proj.name}</Link>
                  {teammates.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No other teammates on this project.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                      {teammates.map((t) => (
                        <Link key={t.id} to={`/people/${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(t)}</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{t.title || t.email}</div>
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
