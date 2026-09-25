import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { PayrollFileIcon } from '../../components/icons'
import { personById } from '../../data/people'
import { reviewPeriod, statusBadgeClass, usePayrollPeriods, type PayrollStatus } from '../../data/payroll'

export default function Reviews() {
  const periods = usePayrollPeriods()
  const [status, setStatus] = useState<'All' | PayrollStatus>('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return periods.filter((p) => {
      const person = personById(p.personId)
      const matchesQuery = !q || (person?.name.toLowerCase().includes(q) ?? false)
      const matchesStatus = status === 'All' || p.status === status
      return matchesQuery && matchesStatus
    })
  }, [periods, query, status])

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="reviews" />}>
      <div className="page-title">Payroll Reviews</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <div className="field-label">Search</div>
          <input className="input" placeholder="Search employees…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="field-label">Status</div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'All' | PayrollStatus)}>
            <option value="All">All statuses</option>
            <option value="Timesheet pending">Timesheet pending</option>
            <option value="Under review">Under review</option>
            <option value="Approved">Approved</option>
            <option value="Paid out">Paid out</option>
          </select>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>{filtered.length} {filtered.length === 1 ? 'review' : 'reviews'}</div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2">Employee</th>
              <th className="th2">Pay cycle</th>
              <th className="th2">Gross</th>
              <th className="th2">Hours (actual / target)</th>
              <th className="th2">Status</th>
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const person = personById(p.personId)
              const behind = p.actualHours < p.targetHours
              return (
                <tr key={p.id}>
                  <td className="td2">
                    <Link to={`/people/${p.personId}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{person?.initials ?? '—'}</div>
                      <span style={{ fontWeight: 600 }}>{person?.name ?? 'Unknown'}</span>
                    </Link>
                  </td>
                  <td className="td2">{p.cycle}</td>
                  <td className="td2 mono">${p.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="td2 mono">
                    <span style={{ color: behind ? '#cc3a00' : undefined }}>{p.actualHours} / {p.targetHours}</span>
                  </td>
                  <td className="td2"><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                  <td className="td2">
                    {p.status === 'Under review' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-outline" onClick={() => reviewPeriod(p.id, 'Rejected')}>Send back</button>
                        <button className="btn-dark" onClick={() => reviewPeriod(p.id, 'Approved')}>Approve</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td2" colSpan={6} style={{ color: 'rgba(0,0,0,0.4)' }}>No reviews match those filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
