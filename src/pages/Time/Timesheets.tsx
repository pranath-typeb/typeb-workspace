import { useMemo, useState } from 'react'
import DatePicker from '../../components/DatePicker'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { committedHoursFor, useAssignments } from '../../data/staffing'
import {
  addDays,
  formatMinutes,
  formatWeekRange,
  minutesForPersonDate,
  minutesForPersonWeek,
  payCycleRangeFor,
  submissionFor,
  submitWeek,
  todayLocal,
  toLocalDateStr,
  useSubmissions,
  useTimeEntries,
  weekStartFor,
  weeksOverlapping,
  WEEKLY_TARGET_MINUTES,
} from '../../data/timeEntries'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const statusBadge: Record<string, string> = {
  'Not Submitted': 'b-neutral',
  Pending: 'b-ember',
  Approved: 'b-pine',
  Rejected: 'b-danger',
}

function WeekCard({
  weekStart,
  minutes,
  status,
  dayMinutes,
  onClick,
}: {
  weekStart: string
  minutes: number
  status: string
  dayMinutes: number[]
  onClick: () => void
}) {
  const max = Math.max(1, ...dayMinutes)
  return (
    <div
      className="card task-row"
      style={{ width: 212, flexShrink: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatWeekRange(weekStart)}</div>
        <span className={`badge ${statusBadge[status]}`} style={{ fontSize: 9, flexShrink: 0, whiteSpace: 'nowrap' }}>{status}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.6px' }}>{formatMinutes(minutes)}</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 32 }}>
        {dayMinutes.map((m, i) => (
          <div key={i} style={{ flex: 1, borderRadius: 2, background: m > 0 ? 'var(--brand-bar)' : 'var(--color-border-default)', height: Math.max(3, (m / max) * 32) }} />
        ))}
      </div>
    </div>
  )
}

export default function Timesheets() {
  const entries = useTimeEntries()
  const submissions = useSubmissions()
  const navigate = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [customRangeOpen, setCustomRangeOpen] = useState(false)

  // Your real weekly target is your own allocation across assigned projects, not the flat
  // 40h cap — see data/timesheetFlags.ts for the same reasoning applied to review flags.
  const assignments = useAssignments()
  const allocatedMinutes = committedHoursFor(assignments, CURRENT_USER_ID, 1) * 60
  const weeklyTarget = allocatedMinutes > 0 ? allocatedMinutes : WEEKLY_TARGET_MINUTES

  const today = todayLocal()
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(today + 'T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isCurrentMonth = (() => {
    const d = new Date(today + 'T00:00:00')
    return d.getFullYear() === monthCursor.year && d.getMonth() === monthCursor.month
  })()

  function goPrevMonth() {
    setMonthCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  }
  function goNextMonth() {
    setMonthCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
  }
  function goThisMonth() {
    const d = new Date(today + 'T00:00:00')
    setMonthCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const weeks = useMemo(() => {
    const monthStart = `${monthCursor.year}-${pad2(monthCursor.month + 1)}-01`
    const monthEnd = toLocalDateStr(new Date(monthCursor.year, monthCursor.month + 1, 0))
    return weeksOverlapping(monthStart, monthEnd)
  }, [monthCursor])

  const cycle = useMemo(() => payCycleRangeFor(todayLocal()), [])
  const cycleWeeks = useMemo(() => weeksOverlapping(cycle.start, cycle.end), [cycle])

  const rows = weeks.map((w) => {
    const minutes = minutesForPersonWeek(entries, CURRENT_USER_ID, w)
    const submission = submissionFor(CURRENT_USER_ID, w)
    const status = submission?.status ?? 'Not Submitted'
    return { weekStart: w, minutes, submission, status }
  })

  const current = rows.filter((r) => r.status !== 'Approved')
  const history = rows.filter((r) => r.status === 'Approved')

  function submitCustomRange() {
    if (!from) return
    const rangeEnd = to || from
    const targets = weeksOverlapping(from, rangeEnd)
    let submitted = 0
    targets.forEach((w) => {
      const sub = submissionFor(CURRENT_USER_ID, w)
      const status = sub?.status ?? 'Not Submitted'
      const minutes = minutesForPersonWeek(entries, CURRENT_USER_ID, w)
      if ((status === 'Not Submitted' || status === 'Rejected') && minutes > 0) {
        submitWeek(CURRENT_USER_ID, w)
        submitted++
      }
    })
    if (submitted > 0) {
      setFrom('')
      setTo('')
      setCustomRangeOpen(false)
    }
  }

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="timesheets" />}>
      <div className="page-title">Timesheets</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: -8 }}>
        Submit your hours each week for review. Click a week to see the full breakdown before you send it.
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
          This pay cycle · {fmtDate(cycle.start)} – {fmtDate(cycle.end)}
        </div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, minWidth: 0 }}>
          {cycleWeeks.map((w) => {
            const minutes = minutesForPersonWeek(entries, CURRENT_USER_ID, w)
            const submission = submissionFor(CURRENT_USER_ID, w)
            const status = submission?.status ?? 'Not Submitted'
            const dayMinutes = Array.from({ length: 7 }, (_, i) => minutesForPersonDate(entries, CURRENT_USER_ID, addDays(w, i)))
            return (
              <WeekCard
                key={w}
                weekStart={w}
                minutes={minutes}
                status={status}
                dayMinutes={dayMinutes}
                onClick={() => navigate(`/time/timesheets/${CURRENT_USER_ID}/${w}`)}
              />
            )
          })}
        </div>
      </div>

      {customRangeOpen ? (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Submit a custom range</div>
            <button
              className="btn-outline"
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
              onClick={() => {
                setCustomRangeOpen(false)
                setFrom('')
                setTo('')
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Leave "To" empty to submit a single day's week.</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="field-label">From</div>
              <DatePicker value={from} onChange={setFrom} allowClear />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="field-label">To</div>
              <DatePicker value={to} onChange={setTo} placeholder="Same as From" allowClear />
            </div>
            <button className="btn-dark" disabled={!from} onClick={submitCustomRange}>Submit for review</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCustomRangeOpen(true)}
          style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Submit a custom range…
        </button>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Timesheets</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isCurrentMonth && <button className="btn-outline" onClick={goThisMonth}>This month</button>}
            <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={goPrevMonth} aria-label="Previous month">
              <ChevronLeftIcon size={14} color="var(--color-text-primary)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{monthLabel}</span>
            <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={goNextMonth} aria-label="Next month">
              <ChevronRightIcon size={14} color="var(--color-text-primary)" />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {current.map((r) => (
            <TimesheetRow key={r.weekStart} {...r} weeklyTarget={weeklyTarget} onClick={() => navigate(`/time/timesheets/${CURRENT_USER_ID}/${r.weekStart}`)} />
          ))}
          {current.length === 0 && <div className="card" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Nothing open right now.</div>}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((r) => (
              <TimesheetRow key={r.weekStart} {...r} weeklyTarget={weeklyTarget} onClick={() => navigate(`/time/timesheets/${CURRENT_USER_ID}/${r.weekStart}`)} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}

function TimesheetRow({
  weekStart,
  minutes,
  status,
  submission,
  weeklyTarget,
  onClick,
}: {
  weekStart: string
  minutes: number
  status: string
  submission?: { comment?: string }
  weeklyTarget: number
  onClick: () => void
}) {
  const pct = Math.min(100, Math.round((minutes / weeklyTarget) * 100))
  return (
    <div
      className="card task-row"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', gap: 16 }}
      onClick={onClick}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{formatWeekRange(weekStart)}</div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {formatMinutes(minutes)} / {formatMinutes(weeklyTarget)}
        </div>
        <div style={{ height: 4, background: 'var(--color-border-default)', borderRadius: 9999, overflow: 'hidden', marginTop: 8, maxWidth: 220 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: status === 'Rejected' ? '#ff6d33' : 'var(--brand-deep)' }} />
        </div>
      </div>
      {status === 'Rejected' && submission?.comment && (
        <div style={{ fontSize: 12, color: 'var(--danger-fg)', maxWidth: 220, flexShrink: 0 }}>{submission.comment}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span className={`badge ${statusBadge[status]}`}>{status}</span>
        {(status === 'Not Submitted' || status === 'Rejected') && minutes > 0 && (
          <button
            className="btn-dark"
            onClick={(e) => {
              e.stopPropagation()
              submitWeek(CURRENT_USER_ID, weekStart)
            }}
          >
            Submit
          </button>
        )}
        <ChevronRightIcon size={14} color="var(--color-text-tertiary)" />
      </div>
    </div>
  )
}
