import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon, CloseIcon, LockIcon } from '../../components/icons'
import Breadcrumb from '../../components/Breadcrumb'
import { avatarContent } from '../../components/Avatar'
import { DecisionBar, ReviewTrack, Sparkline, VerdictCard } from '../../components/ReviewParts'
import { computeTimesheetFlags, flagsByEntry, type TimesheetFlag } from '../../data/timesheetFlags'
import { getApprovalQueue, type QueueItem } from '../../data/approvalQueue'
import { useLeaveRequests } from '../../data/leave'
import { showToast } from '../../data/toast'
import { CURRENT_USER_ID, personById } from '../../data/people'
import {
  addDays,
  entriesForPersonWeek,
  formatMinutes,
  formatTimeRange,
  formatWeekRange,
  isLockedStatus,
  nextReviewStage,
  pendingRecallRequest,
  projectLabel,
  requestRecall,
  respondToRecall,
  reviewSubmission,
  submissionFor,
  submitWeek,
  updateEntry,
  useSubmissions,
  useTimeEntries,
  WEEKLY_TARGET_MINUTES,
  type ReviewStage,
} from '../../data/timeEntries'
import { committedHoursFor, committedHoursForProject, useAssignments } from '../../data/staffing'

const statusBadge: Record<string, string> = {
  'Not Submitted': 'b-neutral',
  Pending: 'b-ember',
  Approved: 'b-pine',
  Rejected: 'b-danger',
}

const weekDotColor: Record<string, string> = {
  Pending: 'var(--warn-fg)',
  Approved: 'var(--brand-deep)',
  Rejected: 'var(--danger-fg)',
}

const STAGE_LABEL: Record<ReviewStage, string> = { lm: 'Line Manager', hr: 'HR' }

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' · ' + new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function TimesheetDetail() {
  const { personId, weekStart } = useParams<{ personId: string; weekStart: string }>()
  const navigate = useNavigate()
  const entries = useTimeEntries()
  const assignments = useAssignments()
  const allSubmissions = useSubmissions() // also subscribes so this view re-renders after approve/reject/submit
  const leaveRequests = useLeaveRequests()
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<Set<string>>(new Set())
  const keysRef = useRef<{ next?: () => void; prev?: () => void; approve?: () => void; reject?: () => void } | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')
  const [recalling, setRecalling] = useState(false)
  const [recallReason, setRecallReason] = useState('')

  // Reviewer shortcuts: J/K = next/previous, A = approve, R = reject. Ignored while typing or in a dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], .modal, .ss-panel, .ss-sheet')) return
      const h = keysRef.current
      if (!h) return
      const k = e.key.toLowerCase()
      if (k === 'j' && h.next) h.next()
      else if (k === 'k' && h.prev) h.prev()
      else if (k === 'a' && h.approve) h.approve()
      else if (k === 'r' && h.reject) {
        e.preventDefault()
        h.reject()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const person = personId ? personById(personId) : undefined
  const reviewer = personById(CURRENT_USER_ID)!

  if (!person || !weekStart) {
    return (
      <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="timesheets" />}>
        <div className="page-title">Timesheet</div>
        <div className="card">
          <div style={{ fontWeight: 600 }}>We couldn't find that timesheet.</div>
        </div>
      </AppShell>
    )
  }

  const isOwn = person.id === CURRENT_USER_ID
  const submission = submissionFor(person.id, weekStart)
  const status = submission?.status ?? 'Not Submitted'
  const weekEntries = entriesForPersonWeek(entries, person.id, weekStart)
  const totalMinutes = weekEntries.reduce((s, e) => s + e.minutes, 0)
  const billableMinutes = weekEntries.filter((e) => e.billable !== false).reduce((s, e) => s + e.minutes, 0)
  const billablePct = totalMinutes ? Math.round((billableMinutes / totalMinutes) * 100) : 0
  const avgPerDay = totalMinutes / 7 / 60
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const byDay = days.map((d) => ({ date: d, entries: weekEntries.filter((e) => e.date === d) }))
  const daysWorked = byDay.filter((d) => d.entries.length > 0).length
  const maxDayMinutes = Math.max(1, ...byDay.map((d) => d.entries.reduce((s, e) => s + e.minutes, 0)))

  const nearbyWeeks = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, -14 + i * 7)), [weekStart])

  const byProject = useMemo(() => {
    const map = new Map<string, number>()
    weekEntries.forEach((e) => {
      const key = e.projectId ?? '__none__'
      map.set(key, (map.get(key) ?? 0) + e.minutes)
    })
    return [...map.entries()]
      .map(([key, minutes]) => {
        const projectId = key === '__none__' ? null : key
        const assignedHours = projectId ? committedHoursForProject(assignments, person.id, projectId) : 0
        const assignedMinutes = assignedHours * 60
        return {
          name: projectLabel(projectId),
          minutes,
          assignedMinutes,
          pct: assignedMinutes ? Math.round((minutes / assignedMinutes) * 100) : null,
        }
      })
      .sort((a, b) => b.minutes - a.minutes)
  }, [weekEntries, assignments, person.id])

  const stage = submission ? nextReviewStage(submission) : null
  const locked = isLockedStatus(status)
  const recallReq = submission ? pendingRecallRequest(submission) : null
  const canReview = !isOwn && stage !== null && !recallReq
  const canSubmit = isOwn && (status === 'Not Submitted' || status === 'Rejected') && totalMinutes > 0
  const canRequestRecall = isOwn && locked && !recallReq
  const canHandleRecall = !isOwn && recallReq !== null

  // ---- review intelligence ------------------------------------------------------------------
  const todayStr = new Date().toLocaleDateString('en-CA')
  const flags = computeTimesheetFlags({
    person,
    weekStart,
    weekEntries,
    allocationMin: (projectId) => committedHoursForProject(assignments, person.id, projectId) * 60,
    totalAllocationMin: committedHoursFor(assignments, person.id, 1) * 60,
    leaveRequests,
    today: todayStr,
  })
  const flagMap = flagsByEntry(flags)
  const unreviewedWarns = flags.filter((f) => f.severity === 'warn' && !reviewed.has(f.id)).length

  // compare with this person's last 4 weeks
  const prevTotals = [4, 3, 2, 1].map((k) => entriesForPersonWeek(entries, person.id, addDays(weekStart, -7 * k)).reduce((s, e) => s + e.minutes, 0))
  const nonZeroPrev = prevTotals.filter((m) => m > 0)
  const prevAvg = nonZeroPrev.length ? nonZeroPrev.reduce((a, b) => a + b, 0) / nonZeroPrev.length : 0
  const deltaMin = Math.round(totalMinutes - prevAvg)

  // ---- queue (Previous / Next) -----------------------------------------------------------------
  const storedQueue = getApprovalQueue()
  const queue: QueueItem[] =
    submission && storedQueue.some((q) => q.id === submission.id)
      ? storedQueue
      : allSubmissions
          .filter((s) => nextReviewStage(s) !== null)
          .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
          .map((s) => ({ id: s.id, personId: s.personId, weekStart: s.weekStart }))
  const queueIndex = submission ? queue.findIndex((q) => q.id === submission.id) : -1
  const goTo = (q: QueueItem) => navigate(`/time/timesheets/${q.personId}/${q.weekStart}`)
  const prevItem = queueIndex > 0 ? queue[queueIndex - 1] : undefined
  const nextItem = queueIndex >= 0 ? queue[queueIndex + 1] : queue[0]

  // After a decision, move on to the next timesheet that still needs one — or back to the list.
  function advance() {
    const decidedId = submission?.id
    const actionable = (q: QueueItem) => q.id !== decidedId && allSubmissions.some((s) => s.id === q.id && nextReviewStage(s) !== null)
    const target = queue.slice(Math.max(queueIndex, 0) + 1).find(actionable) ?? queue.slice(0, Math.max(queueIndex, 0)).find(actionable)
    if (target) {
      goTo(target)
    } else {
      showToast('Queue cleared — nothing left waiting on you', 'success')
      navigate('/time/approvals')
    }
  }

  function toggleReviewed(id: string) {
    setReviewed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function jumpToFlag(flag: TimesheetFlag) {
    const first = flag.entryIds[0]
    document.getElementById(`entry-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(new Set(flag.entryIds))
    window.setTimeout(() => setFlash(new Set()), 1900)
  }

  function approve() {
    if (!submission || !stage) return
    reviewSubmission(submission.id, stage, 'Approved', reviewer.name)
    advance()
  }

  function confirmReject() {
    if (!submission || !stage) return
    reviewSubmission(submission.id, stage, 'Rejected', reviewer.name, comment.trim() || undefined)
    setRejecting(false)
    setComment('')
    advance()
  }

  const personIdForSubmit = person.id
  const weekStartForSubmit = weekStart
  function submit() {
    submitWeek(personIdForSubmit, weekStartForSubmit)
    navigate(-1)
  }

  function confirmRequestRecall() {
    if (!submission) return
    requestRecall(submission.id, recallReason.trim())
    setRecalling(false)
    setRecallReason('')
  }

  function approveRecall() {
    if (!submission) return
    respondToRecall(submission.id, 'Approved', reviewer.name)
  }

  function denyRecall() {
    if (!submission) return
    respondToRecall(submission.id, 'Denied', reviewer.name)
  }

  keysRef.current = {
    next: nextItem ? () => goTo(nextItem) : undefined,
    prev: prevItem ? () => goTo(prevItem) : undefined,
    approve: canReview ? approve : undefined,
    reject: canReview ? () => setRejecting(true) : undefined,
  }

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active={isOwn ? 'timesheets' : 'approvals'} />}>
      <Breadcrumb
        items={[
          { label: 'Time', to: '/time' },
          isOwn ? { label: 'Timesheets', to: '/time/timesheets' } : { label: 'Approvals', to: '/time/approvals' },
          { label: isOwn ? 'Your timesheet' : person.name },
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 14 }}>{avatarContent(person)}</div>
          <div>
            <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>{isOwn ? 'Your timesheet' : person.name}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{formatWeekRange(weekStart)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${statusBadge[status]}`} style={{ fontSize: 12 }}>{status}</span>
          {submission && status === 'Pending' && (
            <span className="badge b-neutral" style={{ fontSize: 12 }}>
              Awaiting {STAGE_LABEL[stage ?? 'lm']}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nearbyWeeks.map((w) => {
          const weekStatus = submissionFor(person.id, w)?.status ?? 'Not Submitted'
          const active = w === weekStart
          return (
            <button
              key={w}
              onClick={() => navigate(`/time/timesheets/${person.id}/${w}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-background-inverse)' : 'var(--color-background-muted)',
              }}
            >
              {weekStatus !== 'Not Submitted' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: weekDotColor[weekStatus] }} />
              )}
              {formatWeekRange(w)}
            </button>
          )
        })}
      </div>

      {submission && status !== 'Not Submitted' && <ReviewTrack submission={submission} />}

      {weekEntries.length > 0 && (canReview || isOwn || submission) && (
        <VerdictCard flags={flags} reviewed={reviewed} onToggle={toggleReviewed} onJump={jumpToFlag} forOwner={isOwn} />
      )}

      {locked && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-background-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LockIcon size={16} color="var(--color-text-secondary)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {recallReq ? 'Recall requested' : status === 'Approved' ? 'This week is locked — approved' : 'This week is locked — submitted for review'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {recallReq
                  ? `“${recallReq.reason}”`
                  : 'Entries can’t be edited while a submission is in review or approved. Request a recall if something needs fixing.'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {canRequestRecall && (
              <button className="btn-outline" onClick={() => setRecalling(true)}>Request recall</button>
            )}
            {isOwn && recallReq && <span className="badge b-ember" style={{ fontSize: 11 }}>Awaiting approval</span>}
            {canHandleRecall && (
              <>
                <button className="btn-outline" onClick={denyRecall}>Deny recall</button>
                <button className="btn-dark" onClick={approveRecall}>Approve recall</button>
              </>
            )}
          </div>
        </div>
      )}

      {submission?.status === 'Rejected' && submission.comment && (
        <div className="card" style={{ borderColor: '#ffb199', background: '#fff4f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger-fg)', marginBottom: 4 }}>Rejection note</div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>{submission.comment}</div>
        </div>
      )}

      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Breakdown</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div className="stat" style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Total hours</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{formatMinutes(totalMinutes)}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{weekEntries.length} entries</div>
            {prevAvg > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: Math.abs(deltaMin) < 60 ? 'var(--color-text-secondary)' : deltaMin > 0 ? 'var(--warn-fg)' : 'var(--color-text-secondary)' }}>
                  {deltaMin >= 0 ? '▲' : '▼'} {formatMinutes(Math.abs(deltaMin))} vs 4-wk avg
                </span>
                <Sparkline values={[...prevTotals, totalMinutes]} />
              </div>
            )}
          </div>
          <div className="stat" style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Billable</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{billablePct}%</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{formatMinutes(billableMinutes)} billable</div>
          </div>
          <div className="stat" style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Avg hours/day</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{avgPerDay.toFixed(1)}h</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>over 7 days</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>By project</div>
          {byProject.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No entries logged this week.</div>
          ) : (
            byProject.map((row) => (
              <div key={row.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{row.name}</span>
                  {row.pct === null ? (
                    <span className="mono" style={{ color: 'var(--color-text-tertiary)' }}>{formatMinutes(row.minutes)} · no allocation</span>
                  ) : (
                    <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatMinutes(row.minutes)} / {formatMinutes(row.assignedMinutes)} · {row.pct}%
                    </span>
                  )}
                </div>
                <div style={{ height: 6, background: 'var(--color-border-default)', borderRadius: 9999, overflow: 'hidden' }}>
                  {row.pct !== null && (
                    <div style={{ height: '100%', width: `${Math.min(row.pct, 100)}%`, background: row.pct > 100 ? 'var(--warn-fg)' : 'var(--brand-deep)' }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>By day</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
            {byDay.map(({ date, entries: dayEntries }) => {
              const mins = dayEntries.reduce((s, e) => s + e.minutes, 0)
              const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
              return (
                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    className="mono"
                    title={formatMinutes(mins)}
                    style={{ width: '100%', maxWidth: 26, borderRadius: '4px 4px 2px 2px', background: mins > 0 ? 'var(--brand-bar)' : 'var(--color-border-default)', height: Math.max(3, (mins / maxDayMinutes) * 76) }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Entries</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
          {locked ? 'Locked — request a recall to make changes.' : "Toggle billable if it's wrong — the change is recorded in the history below."}
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th className="th2">Time</th>
                <th className="th2">Description</th>
                <th className="th2">Category</th>
                <th className="th2">Project</th>
                <th className="th2">Billable</th>
                <th className="th2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map(({ date, entries: dayEntries }) => {
                if (dayEntries.length === 0) return null
                const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const dayMinutes = dayEntries.reduce((s, e) => s + e.minutes, 0)
                return (
                  <Fragment key={date}>
                    <tr>
                      <td className="td2" colSpan={6} style={{ background: 'var(--color-background-muted)', fontWeight: 700, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{dayLabel}</span>
                          <span className="mono" style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{formatMinutes(dayMinutes)}</span>
                        </div>
                      </td>
                    </tr>
                    {dayEntries.map((e) => (
                      <tr key={e.id} id={`entry-${e.id}`} className={`ts-row${flagMap.get(e.id)?.some((f) => f.severity === 'warn') ? ' flag-warn' : flagMap.has(e.id) ? ' flag-info' : ''}${flash.has(e.id) ? ' flash' : ''}`}>
                        <td className="td2 mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{e.startMinutes !== undefined ? formatTimeRange(e.startMinutes, e.minutes) : '—'}</td>
                        <td className="td2 wrap">
                          {e.description || 'Untitled entry'}
                          {[...new Map((flagMap.get(e.id) ?? []).filter((f) => f.short).map((f) => [f.short, f])).values()].slice(0, 2).map((f) => (
                            <span key={f.short} className={`ts-tag${f.severity === 'warn' ? ' warn' : ''}`}>{f.short}</span>
                          ))}
                        </td>
                        <td className="td2" style={{ color: 'var(--color-text-secondary)' }}>{e.category}</td>
                        <td className="td2">{projectLabel(e.projectId)}</td>
                        <td className="td2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={e.billable !== false}
                            disabled={locked}
                            className={`switch${e.billable !== false ? ' on' : ''}`}
                            onClick={() => updateEntry(e.id, { billable: e.billable === false })}
                          >
                            <span className="switch-knob" />
                          </button>
                        </td>
                        <td className="td2 mono">{formatMinutes(e.minutes)}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              {weekEntries.length === 0 && (
                <tr>
                  <td className="td2" colSpan={6} style={{ color: 'var(--color-text-tertiary)' }}>No time logged this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canSubmit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-dark" onClick={submit}>Submit for review</button>
        </div>
      )}

      {submission && submission.history.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>History</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...submission.history].reverse().map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-border-subtle)', marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{h.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{fmtWhen(h.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canReview && (
        <DecisionBar
          person={person}
          weekLabel={formatWeekRange(weekStart)}
          totalLabel={formatMinutes(totalMinutes)}
          unreviewedWarns={unreviewedWarns}
          position={queueIndex >= 0 ? queueIndex + 1 : 0}
          total={queue.length}
          onPrev={prevItem ? () => goTo(prevItem) : undefined}
          onNext={nextItem ? () => goTo(nextItem) : undefined}
          stageLabel={STAGE_LABEL[stage!]}
          onApprove={approve}
          onReject={() => setRejecting(true)}
        />
      )}

      {rejecting && (
        <div className="modal-backdrop" onClick={() => setRejecting(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Reject timesheet</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{person.name} · {formatWeekRange(weekStart)}</div>
              </div>
              <button onClick={() => setRejecting(false)} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloseIcon color="var(--color-text-secondary)" />
              </button>
            </div>

            <div>
              <div className="field-label">Quick reasons</div>
              <div className="reject-reasons">
                {[
                  ...flags.slice(0, 3).map((f) => ({ label: f.title, text: f.suggestion })),
                  { label: 'Missing descriptions', text: 'Please add descriptions to all entries.' },
                  { label: 'Wrong project', text: 'Some entries look like they are on the wrong project.' },
                  { label: 'Hours look off', text: 'The hours look off — please recheck and resubmit.' },
                ].map((r) => {
                  const on = comment.includes(r.text)
                  return (
                    <button
                      key={r.label}
                      type="button"
                      className={on ? 'on' : ''}
                      onClick={() => setComment((c) => (on ? c.replace(r.text, '').replace(/\n{2,}/g, '\n').trim() : c ? `${c}\n${r.text}` : r.text))}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
              <div className="field-label" style={{ marginTop: 12 }}>Note to {person.name.split(' ')[0]} *</div>
              <textarea
                className="input"
                style={{ height: 100, alignItems: 'flex-start', paddingTop: 10, resize: 'vertical' }}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Let them know what needs fixing…"
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
              <button className="btn-outline" onClick={() => setRejecting(false)}>Cancel</button>
              <button className="btn-dark" disabled={!comment.trim()} onClick={confirmReject}>Reject timesheet</button>
            </div>
          </div>
        </div>
      )}

      {recalling && (
        <div className="modal-backdrop" onClick={() => setRecalling(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Request recall</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{person.name} · {formatWeekRange(weekStart)}</div>
              </div>
              <button onClick={() => setRecalling(false)} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloseIcon color="var(--color-text-secondary)" />
              </button>
            </div>

            <div>
              <div className="field-label">Reason *</div>
              <textarea
                className="input"
                style={{ height: 90, alignItems: 'flex-start', paddingTop: 10, resize: 'vertical' }}
                value={recallReason}
                onChange={(e) => setRecallReason(e.target.value)}
                placeholder="Why does this week need to be reopened?"
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
              <button className="btn-outline" onClick={() => setRecalling(false)}>Cancel</button>
              <button className="btn-dark" disabled={!recallReason.trim()} onClick={confirmRequestRecall}>Request recall</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
