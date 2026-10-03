import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon, CloseIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
import { CURRENT_USER_ID, personById, type Department } from '../../data/people'
import {
  formatMinutes,
  formatWeekRange,
  minutesForPersonWeek,
  nextReviewStage,
  reviewSubmissions,
  useSubmissions,
  useTimeEntries,
  type ApprovalStatus,
  type ReviewStage,
  type WeekSubmission,
} from '../../data/timeEntries'
import { Select } from '../../components/SearchableSelect'

type Tab = 'Awaiting me' | 'Pending' | 'Approved' | 'Rejected' | 'All'

const TABS: Tab[] = ['Awaiting me', 'Pending', 'Approved', 'Rejected', 'All']
const DEPARTMENTS: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']
const STAGE_LABEL: Record<ReviewStage, string> = { lm: 'Line Manager', hr: 'HR' }

function approvalBadge(status: ApprovalStatus): string {
  if (status === 'Approved') return 'b-pine'
  if (status === 'Rejected') return 'b-danger'
  return 'b-neutral'
}

export default function Approvals() {
  const submissions = useSubmissions()
  const entries = useTimeEntries()
  const navigate = useNavigate()
  const reviewer = personById(CURRENT_USER_ID)!
  const [tab, setTab] = useState<Tab>('Awaiting me')
  const [weekFilter, setWeekFilter] = useState('All')
  const [deptFilter, setDeptFilter] = useState<Department | 'All'>('All')
  const [query, setQuery] = useState('')
  const [showAllDates, setShowAllDates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectTarget, setRejectTarget] = useState<WeekSubmission | 'bulk' | null>(null)
  const [comment, setComment] = useState('')

  const counts = useMemo(
    () => ({
      'Awaiting me': submissions.filter((s) => nextReviewStage(s) !== null).length,
      Pending: submissions.filter((s) => s.status === 'Pending').length,
      Approved: submissions.filter((s) => s.status === 'Approved').length,
      Rejected: submissions.filter((s) => s.status === 'Rejected').length,
      All: submissions.length,
    }),
    [submissions],
  )

  const weeks = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.weekStart))).sort((a, b) => b.localeCompare(a)),
    [submissions],
  )

  const byTab = useMemo(() => {
    if (tab === 'All') return submissions
    if (tab === 'Awaiting me') return submissions.filter((s) => nextReviewStage(s) !== null)
    return submissions.filter((s) => s.status === tab)
  }, [submissions, tab])

  const effectiveWeekFilter = showAllDates ? 'All' : weekFilter

  const filtered = useMemo(() => {
    let list = byTab
    if (effectiveWeekFilter !== 'All') list = list.filter((s) => s.weekStart === effectiveWeekFilter)
    if (deptFilter !== 'All') list = list.filter((s) => personById(s.personId)?.department === deptFilter)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((s) => (personById(s.personId)?.name ?? '').toLowerCase().includes(q))
    return [...list].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  }, [byTab, effectiveWeekFilter, deptFilter, query])

  // If the active week filter is hiding pending items that exist outside it, tell the
  // reviewer rather than let them silently miss a submission waiting on their decision.
  const hiddenPendingCount = useMemo(() => {
    if (effectiveWeekFilter === 'All') return 0
    return byTab.filter((s) => nextReviewStage(s) !== null && s.weekStart !== effectiveWeekFilter).length
  }, [byTab, effectiveWeekFilter])

  const selectableIds = useMemo(() => filtered.filter((s) => nextReviewStage(s) !== null).map((s) => s.id), [filtered])
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openDetail(s: WeekSubmission) {
    navigate(`/time/timesheets/${s.personId}/${s.weekStart}`)
  }

  // A bulk selection can span rows at different stages (some awaiting LM, some HR) —
  // group by stage so each gets its own reviewSubmissions call under the right name.
  function applyToSelection(decision: 'Approved' | 'Rejected', ids: string[], sharedComment?: string) {
    const byStage = new Map<ReviewStage, string[]>()
    ids.forEach((id) => {
      const sub = submissions.find((s) => s.id === id)
      const stage = sub ? nextReviewStage(sub) : null
      if (!stage) return
      byStage.set(stage, [...(byStage.get(stage) ?? []), id])
    })
    byStage.forEach((stageIds, stage) => reviewSubmissions(stageIds, stage, decision, reviewer.name, sharedComment))
  }

  function approveOne(s: WeekSubmission) {
    const stage = nextReviewStage(s)
    if (!stage) return
    applyToSelection('Approved', [s.id])
  }

  function bulkApprove() {
    applyToSelection('Approved', [...selected])
    setSelected(new Set())
  }

  function confirmReject() {
    const ids = rejectTarget === 'bulk' ? [...selected] : rejectTarget ? [rejectTarget.id] : []
    applyToSelection('Rejected', ids, comment.trim() || undefined)
    if (rejectTarget === 'bulk') setSelected(new Set())
    setRejectTarget(null)
    setComment('')
  }

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="approvals" />}>
      <div className="page-title">Timesheet approvals</div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--color-border-default)', overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              paddingBottom: 10,
              fontSize: 14,
              fontWeight: t === tab ? 600 : 500,
              color: t === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              borderBottom: t === tab ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {t}
            <span className="mono" style={{ background: t === tab ? 'var(--color-background-inverse)' : 'var(--color-background-muted)', color: t === tab ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', borderRadius: 9999, fontSize: 11, padding: '1px 7px' }}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {hiddenPendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: 'var(--color-status-warning-bg)', border: '1px solid var(--color-status-warning-border)', borderRadius: 10, padding: '14px 16px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-status-warning-text)' }}>Pending approvals outside this time filter</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {hiddenPendingCount} timesheet{hiddenPendingCount === 1 ? '' : 's'} awaiting a decision {hiddenPendingCount === 1 ? "falls" : "fall"} outside the selected week and {hiddenPendingCount === 1 ? 'is' : 'are'} not shown here.
            </div>
          </div>
          <button className="btn-dark" style={{ flexShrink: 0 }} onClick={() => setShowAllDates(true)}>Show all dates</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 220 }}>
          <div className="field-label">Search</div>
          <input className="input" placeholder="Employee name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="field-label">Department</div>
          <Select className="input" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | 'All')}>
            <option value="All">Any</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="field-label">Timesheet period</div>
          <Select
            className="input"
            value={effectiveWeekFilter}
            onChange={(e) => {
              setShowAllDates(false)
              setWeekFilter(e.target.value)
            }}
          >
            <option value="All">All weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>{formatWeekRange(w)}</option>
            ))}
          </Select>
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-background-muted)', borderRadius: 10, padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" onClick={() => setRejectTarget('bulk')}>Reject selected</button>
            <button className="btn-dark" onClick={bulkApprove}>Approve selected</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2" style={{ width: 36 }}>
                <input type="checkbox" checked={allSelected} disabled={selectableIds.length === 0} onChange={toggleAll} />
              </th>
              <th className="th2">Employee</th>
              <th className="th2">Department</th>
              <th className="th2">Period</th>
              <th className="th2">Hours</th>
              <th className="th2">Line Manager</th>
              <th className="th2">HR</th>
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const person = personById(s.personId)
              const minutes = minutesForPersonWeek(entries, s.personId, s.weekStart)
              const stage = nextReviewStage(s)
              return (
                <tr key={s.id} className="task-row" style={{ cursor: 'pointer' }} onClick={() => openDetail(s)}>
                  <td className="td2" onClick={(e) => e.stopPropagation()}>
                    {stage && (
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                    )}
                  </td>
                  <td className="td2">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{person ? avatarContent(person) : '—'}</div>
                      <span style={{ fontWeight: 600 }}>{person?.name ?? 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="td2" style={{ color: 'var(--color-text-secondary)' }}>{person?.department ?? '—'}</td>
                  <td className="td2">{formatWeekRange(s.weekStart)}</td>
                  <td className="td2 mono">{formatMinutes(minutes)}</td>
                  <td className="td2">
                    <span className={`badge ${approvalBadge(s.lmStatus)}`} style={{ fontSize: 10 }}>{s.lmStatus}</span>
                    {s.lmBy && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{s.lmBy}</div>}
                  </td>
                  <td className="td2">
                    <span className={`badge ${approvalBadge(s.hrStatus)}`} style={{ fontSize: 10 }}>{s.hrStatus}</span>
                    {s.hrBy && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{s.hrBy}</div>}
                  </td>
                  <td className="td2" onClick={(e) => e.stopPropagation()}>
                    {stage && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline" onClick={() => setRejectTarget(s)}>Reject</button>
                        <button className="btn-dark" onClick={() => approveOne(s)}>Approve ({STAGE_LABEL[stage]})</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td2" colSpan={8} style={{ color: 'var(--color-text-tertiary)' }}>Nothing here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rejectTarget && (
        <div className="modal-backdrop" onClick={() => setRejectTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Reject timesheet{rejectTarget === 'bulk' && selected.size > 1 ? 's' : ''}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {rejectTarget === 'bulk' ? `${selected.size} timesheet${selected.size === 1 ? '' : 's'} selected` : `${personById(rejectTarget.personId)?.name ?? 'Unknown'} · ${formatWeekRange(rejectTarget.weekStart)}`}
                </div>
              </div>
              <button onClick={() => setRejectTarget(null)} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloseIcon color="var(--color-text-secondary)" />
              </button>
            </div>

            <div>
              <div className="field-label">Reason *</div>
              <textarea
                className="input"
                style={{ height: 90, alignItems: 'flex-start', paddingTop: 10, resize: 'vertical' }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Let them know what needs fixing…"
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
              <button className="btn-outline" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn-dark" disabled={!comment.trim()} onClick={confirmReject}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
