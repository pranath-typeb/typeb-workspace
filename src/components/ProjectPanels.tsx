import { useState } from 'react'
import { Link } from 'react-router-dom'
import { avatarContent } from './Avatar'
import { AlertCircleIcon, CalendarIcon, ClockIcon, FlagIcon, StaffingIcon } from './icons'
import { personById } from '../data/people'
import { categoryColor, formatMinutes, type TimeEntry } from '../data/timeEntries'
import { fmtHours, type HeadsUp, type MemberStat, type ProjectHealth, type ProjectStats } from '../data/projectInsights'


const HEALTH_STYLE: Record<ProjectHealth, { dot: string; badge: string }> = {
  'on-track': { dot: '#1f8a5b', badge: 'b-pine' },
  'ending-soon': { dot: '#d99a00', badge: 'b-ember' },
  'over-allocated': { dot: '#e11d48', badge: 'b-danger' },
  idle: { dot: '#8a8a8a', badge: 'b-neutral' },
  completed: { dot: '#8a8a8a', badge: 'b-neutral' },
}

export function healthDot(health: ProjectHealth) {
  return HEALTH_STYLE[health].dot
}

export function HealthBadge({ health, label }: { health: ProjectHealth; label: string }) {
  return (
    <span className="pp-health" title={label}>
      <span className="pp-health-dot" style={{ background: HEALTH_STYLE[health].dot }} />
      {label}
    </span>
  )
}

const ago = (ymd: string | null, today: string) => {
  if (!ymd) return 'Never'
  const d = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(ymd + 'T00:00:00').getTime()) / 86400000)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 14) return `${d} days ago`
  return `${Math.round(d / 7)} weeks ago`
}

function Meter({ pct, color = 'var(--brand-mid)', over }: { pct: number; color?: string; over?: boolean }) {
  return (
    <div className="pp-meter">
      <div className="pp-meter-fill" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: over ? '#e11d48' : color }} />
    </div>
  )
}

// ---- 1. Health summary: timeline · hours vs plan · billable share ----------------------------------
export function HealthStrip({ stats, status, billable }: { stats: ProjectStats; status: string; billable: boolean }) {
  const planned = stats.plannedMinutesToDate
  const burnPct = planned ? Math.round((stats.teamLoggedMinutes / planned) * 100) : 0
  const billPct = stats.totalMinutes ? Math.round((stats.billableMinutes / stats.totalMinutes) * 100) : 0
  const done = status === 'Completed' || stats.daysLeft < 0
  return (
    <div className="pp-strip">
      <div className="pp-tile">
        <div className="pp-tile-label">Timeline</div>
        <div className="pp-tile-value">{done ? 'Ended' : `${Math.max(stats.daysLeft, 0)}d left`}</div>
        <Meter pct={stats.timelinePct} />
        <div className="pp-tile-sub">{stats.timelinePct}% of the schedule elapsed</div>
      </div>
      <div className="pp-tile">
        <div className="pp-tile-label">Team hours vs plan</div>
        <div className="pp-tile-value mono">{fmtHours(stats.teamLoggedMinutes)}</div>
        {planned > 0 ? (
          <>
            <Meter pct={burnPct} over={burnPct > 110} />
            <div className="pp-tile-sub">{burnPct}% of {fmtHours(planned)} planned to date</div>
          </>
        ) : (
          <div className="pp-tile-sub">{stats.committedPerWeek ? `${stats.committedPerWeek}h/week committed` : 'No hours committed yet'}</div>
        )}
      </div>
      <div className="pp-tile">
        <div className="pp-tile-label">Billable</div>
        <div className="pp-tile-value mono">{billable ? `${billPct}%` : '—'}</div>
        {billable ? <Meter pct={billPct} color="var(--brand-deep)" /> : null}
        <div className="pp-tile-sub">{billable ? `${fmtHours(stats.billableMinutes)} of ${fmtHours(stats.totalMinutes)} billable` : 'Non-billable project'}</div>
      </div>
    </div>
  )
}

// ---- 2. Weekly hours chart ------------------------------------------------------------------------
export function WeeklyChart({ weekly, prevWeekMinutes, weekMinutes }: { weekly: ProjectStats['weekly']; prevWeekMinutes: number; weekMinutes: number }) {
  const max = Math.max(...weekly.map((w) => w.minutes), 60)
  const delta = weekMinutes - prevWeekMinutes
  return (
    <div className="card pp-card">
      <div className="pp-card-head">
        <div className="pp-card-title">Hours per week</div>
        <div className="pp-card-meta">
          This week <b className="mono">{fmtHours(weekMinutes)}</b>
          {prevWeekMinutes > 0 && (
            <span style={{ color: delta >= 0 ? 'var(--brand-text)' : 'var(--warn-fg)' }}> {delta >= 0 ? '▲' : '▼'} {fmtHours(Math.abs(delta))}</span>
          )}
        </div>
      </div>
      <div className="pp-bars" role="img" aria-label="Hours logged per week, last 10 weeks">
        {weekly.map((w, i) => {
          const last = i === weekly.length - 1
          return (
            <div key={w.weekStart} className="pp-bar-col" title={`Week of ${w.weekStart}: ${formatMinutes(w.minutes)}`}>
              <div className="pp-bar-val mono">{w.minutes ? fmtHours(w.minutes) : ''}</div>
              <div className="pp-bar-track">
                <div className="pp-bar" style={{ height: `${(w.minutes / max) * 100}%`, background: last ? 'var(--brand-mid)' : 'var(--brand-bar)', opacity: last ? 1 : 0.7 }} />
              </div>
              <div className="pp-bar-label">{new Date(w.weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- 3. Time by category --------------------------------------------------------------------------
export function CategoryBreakdown({ byCategory, total }: { byCategory: ProjectStats['byCategory']; total: number }) {
  return (
    <div className="card pp-card">
      <div className="pp-card-head">
        <div className="pp-card-title">Time by category</div>
      </div>
      {byCategory.length === 0 ? (
        <div className="pp-empty">No time logged yet.</div>
      ) : (
        <>
          <div className="pp-stack" aria-hidden>
            {byCategory.map((c) => (
              <div key={c.category} style={{ width: `${(c.minutes / total) * 100}%`, background: categoryColor(c.category) }} />
            ))}
          </div>
          <div className="pp-legend">
            {byCategory.map((c) => (
              <div key={c.category} className="pp-legend-row">
                <span className="pp-swatch" style={{ background: categoryColor(c.category) }} />
                <span className="pp-legend-name">{c.category}</span>
                <span className="pp-legend-pct">{Math.round((c.minutes / total) * 100)}%</span>
                <span className="mono pp-legend-val">{fmtHours(c.minutes)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- 4. Team table --------------------------------------------------------------------------------
export function TeamPanel({
  members,
  contributors,
  today,
  onCommit,
  onAdd,
}: {
  members: MemberStat[]
  contributors: MemberStat[]
  today: string
  onCommit: (personId: string) => void
  onAdd: () => void
}) {
  const [showOthers, setShowOthers] = useState(false)
  return (
    <div className="card pp-card">
      <div className="pp-card-head">
        <div className="pp-card-title">Team ({members.length})</div>
        <button className="btn-outline" style={{ height: 30, fontSize: 12 }} onClick={onAdd}>
          <StaffingIcon size={13} color="var(--color-text-primary)" /> Commit hours
        </button>
      </div>
      {members.length === 0 ? (
        <div className="pp-empty">No one staffed on this project yet.</div>
      ) : (
        <div className="pp-team">
          <div className="pp-team-row pp-team-head">
            <span>Member</span>
            <span className="r">Committed</span>
            <span className="r">This month</span>
            <span className="r">Share</span>
            <span className="r hide-narrow">Last logged</span>
          </div>
          {[...members, ...(showOthers ? contributors : [])].map((m) => {
            const person = personById(m.personId)
            if (!person) return null
            return (
              <div key={m.personId} className="pp-team-row">
                <Link to={`/people/${person.id}`} className="pp-member">
                  <span className="avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>{avatarContent(person)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="pp-member-name">{person.name}</span>
                    <span className="pp-member-title">{person.title}</span>
                  </span>
                </Link>
                <span className="r mono" data-label="Committed">{m.committedPerWeek ? `${m.committedPerWeek}h/wk` : <button className="pp-link" onClick={() => onCommit(person.id)}>Commit</button>}</span>
                <span className="r mono" data-label="This month">{m.loggedMonthMinutes ? fmtHours(m.loggedMonthMinutes) : '—'}</span>
                <span className="r" data-label="Share">
                  {m.sharePct ? (
                    <span className="pp-share"><span className="pp-share-bar"><span style={{ width: `${m.sharePct}%` }} /></span>{m.sharePct}%</span>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="r hide-narrow pp-muted">{ago(m.lastLogged, today)}</span>
              </div>
            )
          })}
          {contributors.length > 0 && (
            <button type="button" className="pp-more" onClick={() => setShowOthers((v) => !v)}>
              {showOthers ? 'Hide' : 'Show'} {contributors.length} other {contributors.length === 1 ? 'contributor' : 'contributors'} who logged time
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---- 5. Heads-up ----------------------------------------------------------------------------------
const HEADSUP_SHOWN = 4

export function HeadsUpPanel({ items }: { items: HeadsUp[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, HEADSUP_SHOWN)
  const icon = (k: HeadsUp['kind']) =>
    k === 'leave' ? <CalendarIcon size={15} color="var(--color-text-secondary)" /> : k === 'event' ? <FlagIcon size={15} color="var(--color-text-secondary)" /> : k === 'over' ? <AlertCircleIcon size={15} color="#e11d48" /> : <ClockIcon size={15} color="var(--color-text-secondary)" />
  return (
    <div className="card pp-card">
      <div className="pp-card-head">
        <div className="pp-card-title">Heads-up</div>
        {items.length > 0 && <span className="badge b-ember">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="pp-empty">Nothing needs attention. No leave, over-allocation or events in the next two weeks.</div>
      ) : (
        <div className="pp-headsup">
          {shown.map((h, i) => (
            <div key={i} className="pp-headsup-row">
              <span className="pp-headsup-icon">{icon(h.kind)}</span>
              <span style={{ minWidth: 0 }}>
                <span className="pp-headsup-text">{h.text}</span>
                {h.detail && <span className="pp-headsup-detail">{h.detail}</span>}
              </span>
            </div>
          ))}
          {items.length > HEADSUP_SHOWN && (
            <button type="button" className="pp-more" onClick={() => setAll((v) => !v)}>
              {all ? 'Show less' : `Show ${items.length - HEADSUP_SHOWN} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---- 6. Recent activity ---------------------------------------------------------------------------
export function ActivityPanel({ recent, today }: { recent: TimeEntry[]; today: string }) {
  return (
    <div className="card pp-card">
      <div className="pp-card-head">
        <div className="pp-card-title">Recent activity</div>
      </div>
      {recent.length === 0 ? (
        <div className="pp-empty">Time logged on this project will show up here.</div>
      ) : (
        <div className="pp-activity">
          {recent.map((e) => {
            const person = personById(e.personId)
            return (
              <div key={e.id} className="pp-activity-row">
                <span className="avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>{person ? avatarContent(person) : '?'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="pp-activity-text">
                    <b>{person?.name.split(' ')[0] ?? 'Someone'}</b> logged <span className="mono">{formatMinutes(e.minutes)}</span> · {e.description || 'Untitled entry'}
                  </span>
                  <span className="pp-activity-meta">
                    <span className="pp-swatch" style={{ background: categoryColor(e.category) }} /> {e.category} · {ago(e.date, today)}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
