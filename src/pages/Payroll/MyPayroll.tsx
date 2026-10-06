import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { HoursMeter, StageChip, Stepper, money } from '../../components/PayrollParts'
import { ChevronRightIcon, WalletIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { submitPeriod, usePayrollPeriods } from '../../data/payroll'
import { cycleBounds, isOverdue, nextStep, stageOf } from '../../data/payrollInsights'
import { useSubmissions } from '../../data/timeEntries'

export default function MyPayroll() {
  const navigate = useNavigate()
  const all = usePayrollPeriods()
  useSubmissions()
  const mine = useMemo(
    () => all.filter((p) => p.personId === CURRENT_USER_ID).sort((a, b) => cycleBounds(b).end.localeCompare(cycleBounds(a).end)),
    [all],
  )

  const rows = mine.map((p) => ({ p, stage: stageOf(p), overdue: isOverdue(p) }))
  const overdue = rows.filter((r) => r.overdue)
  // The period that needs the employee's attention most: overdue (oldest first) → update needed → the latest one.
  const focus = [...overdue].sort((a, b) => cycleBounds(a.p).end.localeCompare(cycleBounds(b.p).end))[0] ?? rows.find((r) => r.stage.key === 'update-needed') ?? rows[0]
  const step = focus ? nextStep(focus.p, 'self') : null
  const canSubmit = focus && (focus.p.status === 'Timesheet pending' || focus.p.status === 'Update needed') && focus.p.timesheetConfirmed

  return (
    <AppShell appIcon={<WalletIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="my-payroll" />}>
      <div className="page-title">My Payroll</div>

      {overdue.length > 0 && (
        <div className="pr-overdue">
          <div>
            <div className="pr-banner-title">Submission due</div>
            <div className="pr-banner-body">
              {overdue.length} {overdue.length === 1 ? 'period’s' : 'periods’'} pay {overdue.length === 1 ? 'cycle has' : 'cycles have'} ended and still {overdue.length === 1 ? 'needs' : 'need'} to be submitted. Start with the oldest.
            </div>
          </div>
          {focus && focus.overdue && (
            <Link to={`/payroll/my/${focus.p.id}`} className="btn-dark" style={{ flexShrink: 0 }}>Open {focus.p.label}</Link>
          )}
        </div>
      )}

      {focus && step && (
        <div className="card pr-focus">
          <div className="pr-focus-top">
            <div style={{ minWidth: 0 }}>
              <div className="pr-tile-label">{focus.overdue ? 'Do this first' : 'Right now'}</div>
              <div className="serif pr-focus-period">{focus.p.label}</div>
              <div className="pr-dash-sub">Pay cycle {focus.p.cycle}</div>
            </div>
            <div className="pr-focus-money">
              <div className="mono pr-funnel-gross">{money(focus.p.grossPay)}</div>
              <StageChip stage={focus.stage} overdue={focus.overdue} />
            </div>
          </div>
          <Stepper stage={focus.stage} flagged={focus.stage.key === 'update-needed'} />
          <div className="pr-focus-next">
            <div>
              <div className="pr-banner-title" style={{ fontSize: 14 }}>{step.title}</div>
              <div className="pr-banner-body">{step.body}</div>
            </div>
            <div className="pr-focus-actions">
              {canSubmit ? (
                <button className="btn-dark" onClick={() => submitPeriod(focus.p.id)}>{focus.p.status === 'Update needed' ? 'Re-submit payroll' : 'Submit payroll'}</button>
              ) : focus.p.status === 'Timesheet pending' || focus.p.status === 'Update needed' ? (
                <button className="btn-dark" onClick={() => navigate(`/payroll/my/${focus.p.id}`)}>{focus.p.timesheetConfirmed ? 'Review' : 'Confirm timesheet'}</button>
              ) : (
                <button className="btn-outline" onClick={() => navigate(`/payroll/my/${focus.p.id}`)}>View details</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="pr-section-title" style={{ marginTop: 4 }}>All periods</div>

      <div className="card pr-table-card">
        <table className="pr-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th className="th2">Period</th>
              <th className="th2">Pay cycle</th>
              <th className="th2">Gross</th>
              <th className="th2">Hours (actual / target)</th>
              <th className="th2">Status</th>
              <th className="th2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, stage, overdue: od }) => (
              <tr key={p.id} className="row-hover" style={{ cursor: 'pointer' }} onClick={() => navigate(`/payroll/my/${p.id}`)}>
                <td className="td2" style={{ fontWeight: 600 }}>{p.label}</td>
                <td className="td2">{p.cycle}</td>
                <td className="td2 mono">{money(p.grossPay)}</td>
                <td className="td2" style={{ minWidth: 150 }}><HoursMeter p={p} compact /></td>
                <td className="td2"><StageChip stage={stage} overdue={od} small /></td>
                <td className="td2" style={{ width: 24 }}><ChevronRightIcon size={14} color="var(--color-text-tertiary)" /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td2" colSpan={6} style={{ color: 'var(--color-text-tertiary)' }}>No payroll periods yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pr-cards">
        {rows.map(({ p, stage, overdue: od }) => (
          <Link key={p.id} to={`/payroll/my/${p.id}`} className="card pr-card">
            <div className="pr-card-top">
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="pr-emp-name">{p.label}</span>
                <span className="pr-emp-sub">{p.cycle}</span>
              </span>
              <span className="mono pr-card-total">{money(p.grossPay)}</span>
            </div>
            <HoursMeter p={p} />
            <div className="pr-card-bottom">
              <StageChip stage={stage} overdue={od} small />
              <ChevronRightIcon size={14} color="var(--color-text-tertiary)" />
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
