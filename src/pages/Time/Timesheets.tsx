import { useMemo } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import {
  addDays,
  formatMinutes,
  formatWeekRange,
  minutesForPersonWeek,
  submissionFor,
  submitWeek,
  todayLocal,
  useSubmissions,
  useTimeEntries,
  weekStartFor,
  WEEKLY_TARGET_MINUTES,
} from '../../data/timeEntries'

const statusBadge: Record<string, string> = {
  'Not Submitted': 'b-neutral',
  Pending: 'b-ember',
  Approved: 'b-pine',
  Rejected: 'b-danger',
}

export default function Timesheets() {
  const entries = useTimeEntries()
  const submissions = useSubmissions()

  const weeks = useMemo(() => {
    const currentWeek = weekStartFor(todayLocal())
    return Array.from({ length: 6 }, (_, i) => addDays(currentWeek, -7 * i))
  }, [])

  return (
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="timesheets" />}>
      <div className="page-title">Timesheets</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {weeks.map((w) => {
          const minutes = minutesForPersonWeek(entries, CURRENT_USER_ID, w)
          const submission = submissionFor(CURRENT_USER_ID, w)
          const status = submission?.status ?? 'Not Submitted'
          return (
            <div key={w} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatWeekRange(w)}</div>
                <div className="mono" style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>
                  {formatMinutes(minutes)} / {formatMinutes(WEEKLY_TARGET_MINUTES)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge ${statusBadge[status]}`}>{status}</span>
                {(status === 'Not Submitted' || status === 'Rejected') && minutes > 0 && (
                  <button className="btn-dark" onClick={() => submitWeek(CURRENT_USER_ID, w)}>Submit</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
