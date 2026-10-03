import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, CloseIcon } from './icons'
import { avatarContent } from './Avatar'
import { Select } from './SearchableSelect'
import { leaveWorkingDays, useLeaveRequests, type LeaveRequest } from '../data/leave'
import { CURRENT_USER_ID, personById, usePeople, type Department, type Person } from '../data/people'
import { useProjects } from '../data/projects'
import { toLocalDateStr, todayLocal } from '../data/timeEntries'

interface Entry {
  request: LeaveRequest
  person: Person | null
}

const dayLabel = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', opts)

// This week's Mon–Fri — or next week's, when it's the weekend.
function workWeek(): string[] {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow))
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return toLocalDateStr(x)
  })
}

function RequestDetail({ entry, day, onClose }: { entry: Entry; day: string; onClose: () => void }) {
  const { request, person } = entry
  const days = leaveWorkingDays(request)
  const first = days[0]
  const last = days[days.length - 1]
  const manager = person?.managerId ? personById(person.managerId) : undefined
  const range = first === last ? dayLabel(first, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : `${dayLabel(first, { weekday: 'short', month: 'short', day: 'numeric' })} – ${dayLabel(last, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
  const statusClass = request.status === 'Approved' ? 'b-pine' : request.status === 'Pending' ? 'b-ember' : 'b-neutral'

  const rows: Array<[string, React.ReactNode]> = [
    ['Type', request.type],
    ['Dates', range],
    ['Duration', `${request.days} working ${request.days === 1 ? 'day' : 'days'}`],
    ['Status', <span key="s" className={`badge ${statusClass}`}>{request.status}</span>],
    ['Approver', manager ? manager.name : 'Line manager'],
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Leave request">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Leave request</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>

        <div className="wio-letter">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 14, flexShrink: 0 }}>
              {person ? avatarContent(person) : request.requestedBy.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{request.requestedBy}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {person ? [person.title, person.department].filter(Boolean).join(' · ') : 'Team member'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
            {request.requestedBy.split(' ')[0]} has requested <b>{request.type}</b> for <b>{range}</b>
            {first !== last ? ` (${request.days} working days)` : ''}. This request is <b>{request.status.toLowerCase()}</b>.
          </div>

          <div className="wio-day">On {dayLabel(day, { weekday: 'long', month: 'long', day: 'numeric' })}</div>

          <dl className="wio-details">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Link to="/hr/leave" className="btn-outline" onClick={onClose}>Open My Leave</Link>
          <button className="btn-dark" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// Dashboard "Who's off": switch department, pick a day, and open anyone's actual leave request.
export default function WhoIsOff() {
  const requests = useLeaveRequests()
  const people = usePeople()
  const projects = useProjects()
  const week = useMemo(workWeek, [])
  const today = todayLocal()
  const [day, setDay] = useState(week.includes(today) ? today : week[0])
  const [dept, setDept] = useState<'All' | 'mine' | Department>('All')
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState<Entry | null>(null)

  const departments = useMemo(() => [...new Set(people.map((p) => p.department).filter(Boolean))] as Department[], [people])
  // "My team": your direct reports, your manager and peers, and teammates on your projects (plus you).
  // If none of those exist (e.g. a founder with no reports), it falls back to your own department.
  const myTeamIds = useMemo(() => {
    const me = people.find((p) => p.id === CURRENT_USER_ID)
    const ids = new Set<string>()
    people.forEach((p) => {
      if (p.managerId === CURRENT_USER_ID) ids.add(p.id)
      if (me?.managerId && (p.id === me.managerId || p.managerId === me.managerId)) ids.add(p.id)
    })
    projects.filter((p) => p.teamIds.includes(CURRENT_USER_ID)).forEach((p) => p.teamIds.forEach((id) => ids.add(id)))
    ids.delete(CURRENT_USER_ID)
    if (ids.size === 0 && me?.department) people.forEach((p) => p.department === me.department && ids.add(p.id))
    ids.add(CURRENT_USER_ID)
    return ids
  }, [people, projects])
  const byName = useMemo(() => new Map(people.map((p) => [p.name.toLowerCase(), p])), [people])

  const entriesFor = (ymd: string): Entry[] =>
    requests
      .filter((r) => r.status !== 'Rejected' && leaveWorkingDays(r).includes(ymd))
      .map((r) => ({ request: r, person: byName.get(r.requestedBy.toLowerCase()) ?? null }))
      .filter((e) => dept === 'All' || (dept === 'mine' ? !!e.person && myTeamIds.has(e.person.id) : e.person?.department === dept))
      .sort((a, b) => a.request.requestedBy.localeCompare(b.request.requestedBy))

  const list = entriesFor(day)
  const shown = expanded ? list : list.slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Who&apos;s off</div>
        <div style={{ width: 160 }}>
          <Select value={dept} onChange={(e) => setDept(e.target.value as 'All' | 'mine' | Department)} aria-label="Team">
            <option value="All">All teams</option>
            <option value="mine">My team</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="wio-days" role="tablist" aria-label="Day">
        {week.map((d) => {
          const count = entriesFor(d).length
          return (
            <button key={d} role="tab" aria-selected={d === day} className={`wio-day-chip${d === day ? ' active' : ''}${d === today ? ' today' : ''}`} onClick={() => { setDay(d); setExpanded(false) }}>
              <span>{dayLabel(d, { weekday: 'short' })}</span>
              <b>{dayLabel(d, { day: 'numeric' })}</b>
              <i className={count ? 'has' : ''}>{count || '·'}</i>
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div className="wio-empty">
          {dept === 'mine' ? 'No one on your team is off' : dept !== 'All' ? `No one in ${dept} is off` : 'Everyone is in'} on {dayLabel(day, { weekday: 'long' })}.
        </div>
      ) : (
        <div className="wio-list">
          {shown.map((e) => (
            <button key={e.request.id} className="wio-row" onClick={() => setOpen(e)} aria-label={`${e.request.requestedBy} — ${e.request.type}, open request`}>
              <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0, background: e.request.status === 'Pending' ? 'var(--warn-bg)' : undefined }}>
                {e.person ? avatarContent(e.person) : e.request.requestedBy.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div className="wio-name">{e.request.requestedBy}</div>
                <div className="wio-sub">
                  {[e.person?.department, e.request.type].filter(Boolean).join(' · ')}
                  {e.request.status === 'Pending' && <span className="wio-pending">Pending</span>}
                </div>
              </div>
              <span className="mono wio-days-count">{e.request.days}d</span>
              <ChevronRightIcon size={12} color="var(--color-text-tertiary)" />
            </button>
          ))}
          {list.length > 4 && (
            <button className="wio-more" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show fewer' : `Show all ${list.length}`}
            </button>
          )}
        </div>
      )}

      {open && <RequestDetail entry={open} day={day} onClose={() => setOpen(null)} />}
    </div>
  )
}
