import { Link, useParams } from 'react-router-dom'
import Breadcrumb from '../../components/Breadcrumb'
import { DownloadIcon } from '../../components/icons'
import { fmtDate, money } from '../../components/PayrollParts'
import { CURRENT_USER_ID, personById } from '../../data/people'
import { adjustmentsTotal, earningsTotal, usePayrollPeriods } from '../../data/payroll'
import { reconcile } from '../../data/payrollInsights'

const COMPANY_NAME = 'Type B Digital (Pvt) Ltd'
const COMPANY_ADDRESS = '14 Level Road, Colombo 03, Sri Lanka'

// The billing document for a pay period: what the contractor invoices Type B for. White paper in every theme.
export default function Invoice() {
  const { periodId } = useParams<{ periodId: string }>()
  const periods = usePayrollPeriods()
  const period = periodId ? periods.find((p) => p.id === periodId) : undefined
  const person = period ? personById(period.personId) : undefined

  if (!period || !person) {
    return (
      <section className="stage">
        <div className="canvas" style={{ maxWidth: 700, padding: 24 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that invoice.</div>
            <Link to="/payroll/my" className="btn-outline">Back to Payroll</Link>
          </div>
        </div>
      </section>
    )
  }

  const rec = reconcile(period)
  const earnings = period.earnings ?? { base: period.grossPay, incentives: 0, bonus: 0 }
  const total = period.invoiceAmount ?? earningsTotal(period) + adjustmentsTotal(period)
  const state = period.invoicePaidAt ? 'Paid' : period.invoiceNumber ? 'Issued' : period.status === 'Timesheet pending' ? 'Draft' : 'Submitted'
  const lines = [
    { label: `Salary — ${period.label} (${period.eligibleDays ?? period.workingDays ?? '—'} paid days)`, amount: earnings.base },
    ...(earnings.incentives ? [{ label: 'Incentives', amount: earnings.incentives }] : []),
    ...(earnings.bonus ? [{ label: 'Bonus', amount: earnings.bonus }] : []),
    ...(period.adjustments ?? []).map((a) => ({ label: `${a.type} — ${a.description}`, amount: a.amount })),
  ]

  return (
    <section className="stage" style={{ background: 'var(--color-background-subtle)' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: '24px 16px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Breadcrumb
            items={[
              { label: 'Payroll', to: '/payroll' },
              person.id === CURRENT_USER_ID ? { label: 'My Payroll', to: '/payroll/my' } : { label: 'Reviews', to: '/payroll/reviews' },
              { label: period.label, to: person.id === CURRENT_USER_ID ? `/payroll/my/${period.id}` : `/payroll/reviews/${period.id}` },
              { label: 'Invoice' },
            ]}
          />
          <button className="btn-dark" onClick={() => window.print()}>
            <DownloadIcon size={14} color="var(--color-text-inverse)" /> Download PDF
          </button>
        </div>

        <div className="doc-page" style={{ background: '#fff', borderRadius: 14, border: '1px solid #ececee', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div className="serif" style={{ fontSize: 28, letterSpacing: '-0.9px' }}>Invoice</div>
              <div className="mono" style={{ fontSize: 13, color: 'rgba(0,0,0,0.62)', marginTop: 2 }}>{period.invoiceNumber ?? 'Number assigned when approved'}</div>
            </div>
            <span className="badge b-neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>{state}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.62)' }}>From</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{person.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.62)' }}>{person.email}</div>
              {person.bankName && <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.62)' }}>{person.bankName} · {person.bankAccountNo ?? '—'}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.62)' }}>Bill to</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{COMPANY_NAME}</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.62)' }}>{COMPANY_ADDRESS}</div>
            </div>
            <Meta label="Pay cycle" value={period.cycle} />
            <Meta label="Issued" value={period.invoiceIssuedAt ? fmtDate(period.invoiceIssuedAt) : '—'} />
            <Meta label="Paid" value={period.invoicePaidAt ? fmtDate(period.invoicePaidAt) : period.payDate ? `Due ${fmtDate(period.payDate)}` : '—'} />
            <Meta label="Hours (actual / target)" value={`${period.actualHours} / ${period.targetHours}`} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.62)', paddingBottom: 8, borderBottom: '1px solid #ececee' }}>
              <span>Description</span>
              <span>Amount</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span>{l.label}</span>
                <span className="mono">{money(l.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', fontSize: 15, fontWeight: 700 }}>
              <span>Total due</span>
              <span className="mono">{money(total)}</span>
            </div>
          </div>

          {!rec.reconciled && (
            <div style={{ background: '#fff4ec', border: '1px solid #ffdacc', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#a62e00' }}>
              This invoice doesn’t match the calculated pay by {money(Math.abs(rec.residual ?? 0))}. Finance will check the difference before approving.
            </div>
          )}

          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.62)' }}>This is a system-generated invoice and does not require a signature.</div>
        </div>
      </div>
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.62)' }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 3 }}>{value}</div>
    </div>
  )
}
