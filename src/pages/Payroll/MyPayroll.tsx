import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { PayrollFileIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { statusBadgeClass, submitPeriod, usePayrollPeriods } from '../../data/payroll'

export default function MyPayroll() {
  const periods = usePayrollPeriods().filter((p) => p.personId === CURRENT_USER_ID)
  const dueCount = periods.filter((p) => p.status === 'Timesheet pending').length

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="my-payroll" />}>
      <div className="page-title">My Payroll</div>

      {dueCount > 0 && (
        <div style={{ background: '#fff4ec', border: '1px solid #ffdacc', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#cc3a00', marginBottom: 4 }}>Submission due</div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>
            {dueCount} {dueCount === 1 ? 'period has' : 'periods have'} ended and still {dueCount === 1 ? 'needs' : 'need'} to be submitted.
          </div>
        </div>
      )}

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
            {periods.map((p) => {
              const behind = p.actualHours < p.targetHours
              return (
                <tr key={p.id}>
                  <td className="td2" style={{ fontWeight: 600 }}>{p.label}</td>
                  <td className="td2">{p.cycle}</td>
                  <td className="td2 mono">${p.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="td2 mono">
                    <span style={{ color: behind ? '#cc3a00' : undefined }}>{p.actualHours} / {p.targetHours}</span>
                  </td>
                  <td className="td2"><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                  <td className="td2">
                    {p.status === 'Timesheet pending' && (
                      <button className="btn-dark" onClick={() => submitPeriod(p.id)}>Submit</button>
                    )}
                  </td>
                </tr>
              )
            })}
            {periods.length === 0 && (
              <tr>
                <td className="td2" colSpan={6} style={{ color: 'rgba(0,0,0,0.4)' }}>No payroll periods yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
