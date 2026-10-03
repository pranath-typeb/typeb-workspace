import { useState } from 'react'
import { AlertCircleIcon, CheckCircleIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'
import { avatarContent } from './Avatar'
import type { Person } from '../data/people'
import type { TimesheetFlag } from '../data/timesheetFlags'
import type { WeekSubmission } from '../data/timeEntries'

// ---- verdict ---------------------------------------------------------------------------------
export function VerdictCard({
  flags,
  reviewed,
  onToggle,
  onJump,
  forOwner,
}: {
  flags: TimesheetFlag[]
  reviewed: Set<string>
  onToggle: (id: string) => void
  onJump: (flag: TimesheetFlag) => void
  forOwner?: boolean
}) {
  const [showAllInfo, setShowAllInfo] = useState(false)
  const warns = flags.filter((f) => f.severity === 'warn')
  const infos = flags.filter((f) => f.severity === 'info')
  const done = flags.filter((f) => reviewed.has(f.id)).length
  const tone = flags.length === 0 ? 'good' : warns.length > 0 ? 'warn' : 'note'
  const visibleInfos = showAllInfo ? infos : infos.slice(0, 2)
  const hiddenInfos = infos.length - visibleInfos.length

  const headline =
    flags.length === 0
      ? forOwner
        ? 'Looks good — ready to submit'
        : 'Looks good — nothing unusual'
      : warns.length > 0
        ? `${warns.length} ${warns.length === 1 ? 'thing' : 'things'} to check`
        : `${infos.length} ${infos.length === 1 ? 'note' : 'notes'} for your review`

  const sub =
    flags.length === 0
      ? 'No long entries, overlaps, gaps or allocation problems found.'
      : done === flags.length
        ? 'All flags reviewed.'
        : `${done} of ${flags.length} reviewed${forOwner ? ' — worth a look before you submit.' : ''}`

  return (
    <section className={`verdict ${tone}`} aria-label="Review summary">
      <div className="verdict-head">
        <span className="verdict-icon">
          {tone === 'good' ? <CheckCircleIcon size={20} color="currentColor" /> : <AlertCircleIcon size={20} color="currentColor" />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="verdict-title">{headline}</div>
          <div className="verdict-sub">{sub}</div>
        </div>
        {flags.length > 0 && (
          <div className="verdict-progress" aria-hidden>
            <span style={{ width: `${(done / flags.length) * 100}%` }} />
          </div>
        )}
      </div>

      {flags.length > 0 && (
        <ul className="verdict-list">
          {[...warns, ...visibleInfos].map((f) => {
            const isDone = reviewed.has(f.id)
            return (
              <li key={f.id} className={`verdict-item ${f.severity}${isDone ? ' done' : ''}`}>
                <button className="verdict-check" role="checkbox" aria-checked={isDone} aria-label={`Mark "${f.title}" as reviewed`} onClick={() => onToggle(f.id)}>
                  {isDone && <CheckIcon size={12} color="currentColor" />}
                </button>
                <div className="verdict-text">
                  <div className="verdict-item-title">
                    <span className={`verdict-dot ${f.severity}`} /> {f.title}
                  </div>
                  <div className="verdict-item-detail">{f.detail}</div>
                </div>
                {f.entryIds.length > 0 && (
                  <button className="verdict-jump" onClick={() => onJump(f)}>
                    Show
                  </button>
                )}
              </li>
            )
          })}
          {hiddenInfos > 0 && (
            <li>
              <button className="verdict-more" onClick={() => setShowAllInfo(true)}>
                Show {hiddenInfos} more {hiddenInfos === 1 ? 'note' : 'notes'}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

// ---- approval track --------------------------------------------------------------------------
type StepState = 'done' | 'current' | 'todo' | 'rejected'

function fmtWhen(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export function ReviewTrack({ submission }: { submission: WeekSubmission }) {
  const submittedAt = submission.history.find((h) => /submitted/i.test(h.label))?.at ?? submission.history[0]?.at
  const pendingOverall = submission.status === 'Pending'
  const lm: StepState = submission.lmStatus === 'Approved' ? 'done' : submission.lmStatus === 'Rejected' ? 'rejected' : pendingOverall ? 'current' : 'todo'
  const hr: StepState = submission.hrStatus === 'Approved' ? 'done' : submission.hrStatus === 'Rejected' ? 'rejected' : pendingOverall && lm === 'done' ? 'current' : 'todo'
  const final: StepState = submission.status === 'Approved' ? 'done' : submission.status === 'Rejected' ? 'rejected' : 'todo'

  const steps: Array<{ label: string; state: StepState; meta: string }> = [
    { label: 'Submitted', state: 'done', meta: fmtWhen(submittedAt) },
    { label: 'Line manager', state: lm, meta: submission.lmBy ? `${submission.lmBy} · ${fmtWhen(submission.lmAt)}` : lm === 'current' ? 'Waiting' : '' },
    { label: 'HR', state: hr, meta: submission.hrBy ? `${submission.hrBy} · ${fmtWhen(submission.hrAt)}` : hr === 'current' ? 'Waiting' : '' },
    { label: final === 'rejected' ? 'Rejected' : 'Approved', state: final, meta: '' },
  ]

  return (
    <ol className="track" aria-label="Approval progress">
      {steps.map((s, i) => (
        <li key={s.label} className={`track-step ${s.state}`}>
          <span className="track-dot">{s.state === 'done' ? <CheckIcon size={11} color="currentColor" /> : s.state === 'rejected' ? '!' : i + 1}</span>
          <div className="track-text">
            <div className="track-label">{s.label}</div>
            {s.meta && <div className="track-meta">{s.meta}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---- sparkline -------------------------------------------------------------------------------
export function Sparkline({ values, highlightLast = true }: { values: number[]; highlightLast?: boolean }) {
  const max = Math.max(1, ...values)
  return (
    <div className="spark" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className={highlightLast && i === values.length - 1 ? 'last' : ''} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

// ---- sticky decision bar ---------------------------------------------------------------------
export function DecisionBar({
  person,
  weekLabel,
  totalLabel,
  unreviewedWarns,
  position,
  total,
  onPrev,
  onNext,
  stageLabel,
  onApprove,
  onReject,
}: {
  person: Person
  weekLabel: string
  totalLabel: string
  unreviewedWarns: number
  position: number // 1-based; 0 = not in a queue
  total: number
  onPrev?: () => void
  onNext?: () => void
  stageLabel: string
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="decision" role="region" aria-label="Decision">
      <div className="decision-who">
        <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0 }}>{avatarContent(person)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="decision-name">{person.name}</div>
          <div className="decision-meta">
            {weekLabel} · <span className="mono">{totalLabel}</span>
            {unreviewedWarns > 0 && <span className="decision-warn">{unreviewedWarns} unreviewed {unreviewedWarns === 1 ? 'flag' : 'flags'}</span>}
          </div>
        </div>
      </div>

      <div className="decision-actions">
        {total > 1 && (
          <div className="decision-nav">
            <button className="decision-icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous timesheet (K)" title="Previous (K)">
              <ChevronLeftIcon size={14} color="currentColor" />
            </button>
            <span className="decision-count mono">{position > 0 ? `${position} of ${total}` : `${total} waiting`}</span>
            <button className="decision-icon" onClick={onNext} disabled={!onNext} aria-label="Next timesheet (J)" title="Next (J)">
              <ChevronRightIcon size={14} color="currentColor" />
            </button>
          </div>
        )}
        <button className="btn-outline decision-reject" onClick={onReject}>
          Reject <kbd>R</kbd>
        </button>
        <button className="btn-dark" onClick={onApprove}>
          Approve as {stageLabel} <kbd>A</kbd>
        </button>
      </div>
    </div>
  )
}
