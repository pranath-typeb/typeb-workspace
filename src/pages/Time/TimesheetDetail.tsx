import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ChevronLeftIcon, ClockIcon, CloseIcon, LockIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
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
import { committedHoursForProject, useAssignments } from '../../data/staffing'

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
  useSubmissions() // subscribe so this view re-renders after approve/reject/submit
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')
  const [recalling, setRecalling] = useState(false)
  const [recallReason, setRecallReason] = useState('')

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

  function approve() {
    if (!submission || !stage) return
    reviewSubmission(submission.id, stage, 'Approved', reviewer.name)
    navigate(-1)
  }

  function confirmReject() {
    if (!submission || !stage) return
    reviewSubmission(submission.id, stage, 'Rejected', reviewer.name, comment.trim() || undefined)
    setRejecting(false)
    navigate(-1)
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

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active={isOwn ? 'timesheets' : 'approvals'} />}>
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}
      >
        <ChevronLeftIcon color="var(--color-text-secondary)" /> Back
      </button>

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

      {submission && status !== 'Not Submitted' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ApprovalChip label="Line Manager" status={submission.lmStatus} by={submission.lmBy} at={submission.lmAt} />
          <ApprovalChip label="HR" status={submission.hrStatus} by={submission.hrBy} at={submission.hrAt} />
        </div>
      )}

      {locked && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'var(--color-background-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c53030', marginBottom: 4 }}>Rejection note</div>
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
                    <div style={{ height: '100%', width: `${Math.min(row.pct, 100)}%`, background: row.pct > 100 ? '#cc3a00' : '#004543' }} />
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
                    style={{ width: '100%', maxWidth: 26, borderRadius: '4px 4px 2px 2px', background: mins > 0 ? '#3a8f8c' : 'var(--color-border-default)', height: Math.max(3, (mins / maxDayMinutes) * 76) }}
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
                <th className="th2">Day</th>
                <th className="th2">Time</th>
                <th className="th2">Description</th>
                <th className="th2">Category</th>
                <th className="th2">Project</th>
                <th className="th2">Billable</th>
                <th className="th2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {weekEntries.map((e) => (
                <tr key={e.id}>
                  <td className="td2">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                  <td className="td2 mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{e.startMinutes !== undefined ? formatTimeRange(e.startMinutes, e.minutes) : '—'}</td>
                  <td className="td2">{e.description || 'Untitled entry'}</td>
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
              {weekEntries.length === 0 && (
                <tr>
                  <td className="td2" colSpan={7} style={{ color: 'var(--color-text-tertiary)' }}>No time logged this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(canReview || canSubmit) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {canReview && (
            <>
              <button className="btn-outline" onClick={() => setRejecting(true)}>Reject</button>
              <button className="btn-dark" onClick={approve}>Approve as {STAGE_LABEL[stage!]}</button>
            </>
          )}
          {canSubmit && (
            <button className="btn-dark" onClick={submit}>Submit for review</button>
          )}
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

function ApprovalChip({ label, status, by, at }: { label: string; status: 'Pending' | 'Approved' | 'Rejected'; by?: string; at?: string }) {
  const badgeClass = status === 'Approved' ? 'b-pine' : status === 'Rejected' ? 'b-danger' : 'b-neutral'
  return (
    <div className="stat" style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {by ? (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{status} by {by} · {at ? fmtWhen(at) : ''}</div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Not yet reviewed</div>
        )}
      </div>
      <span className={`badge ${badgeClass}`} style={{ fontSize: 10, flexShrink: 0 }}>{status}</span>
    </div>
  )
}
