import { Link, useParams } from 'react-router-dom'
import { DownloadIcon } from '../../components/icons'
import Breadcrumb from '../../components/Breadcrumb'
import { CURRENT_USER_ID, personById } from '../../data/people'
import {
  adjustmentsTotal,
  deductionsTotal,
  earningsTotal,
  netPay,
  statusBadgeClass,
  usePayrollPeriods,
} from '../../data/payroll'

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Payslip() {
  const { periodId } = useParams<{ periodId: string }>()
  const periods = usePayrollPeriods()
  const period = periodId ? periods.find((p) => p.id === periodId) : undefined
  const person = period ? personById(period.personId) : undefined

  if (!period || !person) {
    return (
      <section className="stage">
        <div className="canvas" style={{ maxWidth: 700, padding: 24 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that payslip.</div>
            <Link to="/payroll/my" className="btn-outline">Back to Payroll</Link>
          </div>
        </div>
      </section>
    )
  }

  const earnings = period.earnings ?? { base: period.grossPay, incentives: 0, bonus: 0 }
  const deductions = period.deductions ?? { providentFund: 0, salaryAdvance: 0, other: 0 }
  const adjustments = period.adjustments ?? []
  const gross = earningsTotal(period)
  const totalDeductions = deductionsTotal(period)
  const totalAdjustments = adjustmentsTotal(period)
  const net = netPay(period)
  const generatedAt = new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <section className="stage" style={{ background: 'var(--color-background-subtle)' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: '24px 16px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Breadcrumb
            items={[
              { label: 'Payroll', to: '/payroll' },
              person.id === CURRENT_USER_ID ? { label: 'My Payroll', to: '/payroll/my' } : { label: 'Reviews', to: '/payroll/reviews' },
              { label: period.label },
            ]}
          />
          <button className="btn-dark" onClick={() => window.print()}>
            <DownloadIcon size={14} color="var(--color-text-inverse)" /> Download PDF
          </button>
        </div>

        <div className="doc-page" style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececee', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.62)' }}>Type B OS · Payroll</span>
            <span className={`badge ${statusBadgeClass(period.status)}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{period.status}</span>
          </div>

          <div>
            <div className="serif" style={{ fontSize: 26, letterSpacing: '-0.8px' }}>Payslip</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.62)', marginTop: 2 }}>{period.label}</div>
          </div>

          <div style={{ borderTop: '1px solid #ececee' }} />

          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{person.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.62)', marginTop: 2 }}>Pay cycle {period.cycle}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginTop: 16 }}>
              <InfoField label="Employee ID" value={person.employeeId ?? '—'} />
              <InfoField label="Bank name" value={person.bankName ?? '—'} />
              <InfoField label="Email" value={person.email} />
              <InfoField label="Bank account no." value={person.bankAccountNo ?? '—'} />
              <InfoField label="Contact no." value={person.phone ?? '—'} />
              <InfoField label="Pay date" value={period.payDate ? fmtDate(period.payDate) : 'Pending'} />
            </div>
          </div>

          <LineItemTable
            title="Earnings"
            rows={[
              { label: 'Salary (prorated)', amount: earnings.base },
              { label: 'Incentives', amount: earnings.incentives },
              { label: 'Bonus', amount: earnings.bonus },
            ]}
          />

          {totalDeductions > 0 && (
            <LineItemTable
              title="Deductions"
              rows={[
                { label: 'Provident fund', amount: deductions.providentFund },
                { label: 'Salary advance', amount: deductions.salaryAdvance },
                { label: 'Other deductions', amount: deductions.other },
              ]}
            />
          )}

          {adjustments.length > 0 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Adjustments</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {adjustments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f5f5f5' }}>
                    <span className="badge b-neutral" style={{ fontSize: 10, flexShrink: 0 }}>{a.type}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{a.description}</span>
                    <span className="mono" style={{ fontSize: 12, color: 'rgba(0,0,0,0.62)', flexShrink: 0 }}>{fmtDate(a.date)}</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 70, textAlign: 'right', flexShrink: 0 }}>{money(a.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', borderRadius: 10, padding: '16px 20px' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Net Salary (USD)</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>${money(net)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.62)', marginBottom: 24 }}>Employer signature</div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.2)', paddingTop: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Type B OS Payroll</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.62)' }}>Signed electronically</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.62)', marginBottom: 24 }}>Date</div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.2)', paddingTop: 6 }}>
                <div className="mono" style={{ fontSize: 12 }}>{period.payDate ? fmtDate(period.payDate) : '—'}</div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #ececee', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Generated {generatedAt}. This document is auto-generated from your payroll record.</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)' }}>TYPE B</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.62)' }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function LineItemTable({ title, rows }: { title: string; rows: { label: string; amount: number }[] }) {
  const visibleRows = rows.filter((r) => r.amount !== 0)
  if (visibleRows.length === 0) return null
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #ececee' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.62)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.62)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</span>
      </div>
      {visibleRows.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
          <span style={{ fontSize: 13 }}>{r.label}</span>
          <span className="mono" style={{ fontSize: 13 }}>{money(r.amount)}</span>
        </div>
      ))}
    </div>
  )
}
