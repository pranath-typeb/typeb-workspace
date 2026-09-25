import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon } from '../../components/icons'
import { personById } from '../../data/people'
import { formatMinutes, formatWeekRange, minutesForPersonWeek, reviewSubmission, useSubmissions, useTimeEntries, type SubmissionStatus } from '../../data/timeEntries'

type Tab = 'Pending' | 'Approved' | 'Rejected' | 'All'

export default function Approvals() {
  const submissions = useSubmissions()
  const entries = useTimeEntries()
  const [tab, setTab] = useState<Tab>('Pending')

  const counts = useMemo(
    () => ({
      Pending: submissions.filter((s) => s.status === 'Pending').length,
      Approved: submissions.filter((s) => s.status === 'Approved').length,
      Rejected: submissions.filter((s) => s.status === 'Rejected').length,
      All: submissions.length,
    }),
    [submissions],
  )

  const filtered = tab === 'All' ? submissions : submissions.filter((s) => s.status === tab)

  return (
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="approvals" />}>
      <div className="page-title">Timesheet approvals</div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #ebebeb' }}>
        {(['Pending', 'Approved', 'Rejected', 'All'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              paddingBottom: 10,
              fontSize: 14,
              fontWeight: t === tab ? 600 : 500,
              color: t === tab ? '#0f0f10' : 'rgba(0,0,0,0.53)',
              borderBottom: t === tab ? '2px solid #171717' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t}
            <span className="mono" style={{ background: t === tab ? '#171717' : '#ebebeb', color: t === tab ? '#fff' : '#525252', borderRadius: 9999, fontSize: 11, padding: '1px 7px' }}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2">Employee</th>
              <th className="th2">Period</th>
              <th className="th2">Hours</th>
              <th className="th2">Status</th>
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const person = personById(s.personId)
              const minutes = minutesForPersonWeek(entries, s.personId, s.weekStart)
              return (
                <tr key={s.id}>
                  <td className="td2">
                    <Link to={`/people/${s.personId}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{person?.initials ?? '—'}</div>
                      <span style={{ fontWeight: 600 }}>{person?.name ?? 'Unknown'}</span>
                    </Link>
                  </td>
                  <td className="td2">{formatWeekRange(s.weekStart)}</td>
                  <td className="td2 mono">{formatMinutes(minutes)}</td>
                  <td className="td2">
                    <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
                  </td>
                  <td className="td2">
                    {s.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline" onClick={() => reviewSubmission(s.id, 'Rejected')}>Reject</button>
                        <button className="btn-dark" onClick={() => reviewSubmission(s.id, 'Approved')}>Approve</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td2" colSpan={5} style={{ color: 'rgba(0,0,0,0.4)' }}>Nothing here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}

function statusBadge(status: SubmissionStatus): string {
  if (status === 'Approved') return 'b-pine'
  if (status === 'Rejected') return 'b-danger'
  if (status === 'Pending') return 'b-ember'
  return 'b-neutral'
}
