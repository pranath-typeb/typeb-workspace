import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { PayrollFileIcon, ChevronRightIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { statusBadgeClass, submitPeriod, usePayrollPeriods } from '../../data/payroll'

function cycleSortKey(label: string): number {
  const d = new Date(`1 ${label}`)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export default function MyPayroll() {
  const navigate = useNavigate()
  const allPeriods = usePayrollPeriods().filter((p) => p.personId === CURRENT_USER_ID)
  const periods = useMemo(() => [...allPeriods].sort((a, b) => cycleSortKey(b.label) - cycleSortKey(a.label)), [allPeriods])
  const current = periods[0]
  const history = periods.slice(1)

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="my-payroll" />}>
      <div className="page-title">My Payroll</div>

      {current?.status === 'Timesheet pending' && (
        <div style={{ background: 'var(--color-status-warning-bg)', border: '1px solid var(--color-status-warning-border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-status-warning-text)' }}>Submission due</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            One period's pay cycle has ended and still needs to be submitted.
          </div>
        </div>
      )}

      {current && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              {current.status === 'Timesheet pending' ? 'Submission due' : current.status === 'Update needed' ? 'Needs your attention' : 'Current period'}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, letterSpacing: '-0.8px', marginTop: 4 }}>{current.label}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{current.cycle}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 28, fontWeight: 600 }}>${current.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span className={`badge ${statusBadgeClass(current.status)}`} style={{ marginTop: 6, display: 'inline-flex' }}>{current.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {current.status === 'Timesheet pending' ? (
              <button className="btn-dark" onClick={() => submitPeriod(current.id)}>Submit timesheet</button>
            ) : (
              <button className="btn-outline" onClick={() => navigate(`/payroll/my/${current.id}`)}>View details</button>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>History</div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2">Period</th>
              <th className="th2">Pay cycle</th>
              <th className="th2">Gross</th>
              <th className="th2">Hours (actual / target)</th>
              <th className="th2">Status</th>
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => {
              const behind = p.actualHours < p.targetHours
              return (
                <tr key={p.id} className="row-hover" style={{ cursor: 'pointer' }} onClick={() => navigate(`/payroll/my/${p.id}`)}>
                  <td className="td2" style={{ fontWeight: 600 }}>{p.label}</td>
                  <td className="td2">{p.cycle}</td>
                  <td className="td2 mono">${p.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="td2 mono">
                    <span style={{ color: behind ? 'var(--warn-fg)' : undefined }}>{p.actualHours} / {p.targetHours}</span>
                  </td>
                  <td className="td2"><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                  <td className="td2" style={{ width: 24 }}>
                    <ChevronRightIcon size={14} color="var(--color-text-tertiary)" />
                  </td>
                </tr>
              )
            })}
            {history.length === 0 && (
              <tr>
                <td className="td2" colSpan={6} style={{ color: 'var(--color-text-tertiary)' }}>No earlier periods yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
