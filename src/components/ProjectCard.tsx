import { Link } from 'react-router-dom'
import { avatarContent } from './Avatar'
import { HealthBadge } from './ProjectPanels'
import { personById } from '../data/people'
import { fmtHours, type ProjectStats } from '../data/projectInsights'
import type { Project, ProjectStatus } from '../data/projects'

const statusBadge: Record<ProjectStatus, string> = {
  Active: 'b-pine',
  'On Track': 'b-pine',
  Completed: 'b-neutral',
}

// One project in a grid: name/client, badges, schedule progress + health, team avatars, hours logged.
export default function ProjectCard({ project: p, stats }: { project: Project; stats: ProjectStats | undefined }) {
  return (
    <Link
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
      {(() => {
        const st = stats
        if (!st) return null
        const team = [...st.members.map((m) => m.personId)].slice(0, 4)
        const extra = Math.max(st.members.length - team.length, 0)
        const done = p.status === 'Completed'
        return (
          <div className="pc-foot">
            <div className="pc-timeline">
              <div className="pp-meter"><div className="pp-meter-fill" style={{ width: `${done ? 100 : st.timelinePct}%`, background: done ? 'var(--color-text-tertiary)' : 'var(--brand-mid)' }} /></div>
              <div className="pc-timeline-text">
                <HealthBadge health={st.health} label={st.healthLabel} />
                {!done && st.daysLeft >= 0 && st.health !== 'ending-soon' && <span>{st.daysLeft}d left</span>}
              </div>
            </div>
            <div className="pc-meta">
              <span className="pc-avatars">
                {team.map((pid) => {
                  const person = personById(pid)
                  return person ? <span key={pid} className="avatar" style={{ width: 24, height: 24, fontSize: 9 }} title={person.name}>{avatarContent(person)}</span> : null
                })}
                {extra > 0 && <span className="pc-more">+{extra}</span>}
                {st.members.length === 0 && <span className="pp-muted">No team yet</span>}
              </span>
              <span className="mono pc-hours" title={`${fmtHours(st.totalMinutes)} logged in total${st.weekMinutes > 0 ? `, ${fmtHours(st.weekMinutes)} this week` : ''}`}>
                {fmtHours(st.totalMinutes)}
                {st.weekMinutes > 0 && <span className="pc-week"> +{fmtHours(st.weekMinutes)}</span>}
              </span>
            </div>
          </div>
        )
      })()}
    </Link>
  )
}
