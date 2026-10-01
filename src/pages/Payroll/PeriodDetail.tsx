import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { avatarContent } from '../../components/Avatar'
import { ChevronLeftIcon, HistoryIcon, PayrollFileIcon, PlusIcon, TrashIcon } from '../../components/icons'
import { CURRENT_USER_ID, personById } from '../../data/people'
import {
  addAdjustment,
  adjustmentsTotal,
  deductionsTotal,
  earningsTotal,
  markPaidOut,
  netPay,
  removeAdjustment,
  requestUpdate,
  reviewPeriod,
  statusBadgeClass,
  submitPeriod,
  usePayrollPeriods,
  type PayrollAdjustment,
} from '../../data/payroll'

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const ADJUSTMENT_TYPES: PayrollAdjustment['type'][] = ['Equipment', 'Software', 'Travel', 'Other']

export default function PeriodDetail({ mode }: { mode: 'admin' | 'self' }) {
  const { periodId } = useParams<{ periodId: string }>()
  const periods = usePayrollPeriods()
  const period = periodId ? periods.find((p) => p.id === periodId) : undefined
  const person = period ? personById(period.personId) : undefined

  const [noteDraft, setNoteDraft] = useState('')
  const [showNoteField, setShowNoteField] = useState(false)
  const [adjType, setAdjType] = useState<PayrollAdjustment['type']>('Other')
  const [adjDesc, setAdjDesc] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showPayDateField, setShowPayDateField] = useState(false)

  const backHref = mode === 'admin' ? '/payroll/reviews' : '/payroll/my'

  if (!period || !person) {
    return (
      <AppShell appIcon={<PayrollFileIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active={mode === 'admin' ? 'reviews' : 'my-payroll'} />}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that payroll period.</div>
          <Link to={backHref} className="btn-outline">Back</Link>
        </div>
      </AppShell>
    )
  }

  const gross = earningsTotal(period)
  const net = netPay(period)
  const behind = period.actualHours < period.targetHours
  const history = period.history ?? []
  const canEdit = mode === 'admin'

  function submitAdjustment() {
    const amount = Number(adjAmount)
    if (!adjDesc.trim() || !amount) return
    addAdjustment(period!.id, { type: adjType, description: adjDesc.trim(), date: new Date().toISOString().slice(0, 10), amount })
    setAdjDesc('')
    setAdjAmount('')
  }

  function confirmRequestUpdate() {
    if (!noteDraft.trim()) return
    requestUpdate(period!.id, noteDraft.trim())
    setShowNoteField(false)
    setNoteDraft('')
  }

  function confirmMarkPaid() {
    markPaidOut(period!.id, payDate)
    setShowPayDateField(false)
  }

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active={mode === 'admin' ? 'reviews' : 'my-payroll'} />}>
      <Link to={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
        <ChevronLeftIcon size={14} color="var(--color-text-secondary)" /> Back to {mode === 'admin' ? 'Reviews' : 'My Payroll'}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {mode === 'admin' && (
            <Link to={`/people/${person.id}`} className="avatar" style={{ width: 44, height: 44, fontSize: 15, flexShrink: 0 }}>
              {avatarContent(person)}
            </Link>
          )}
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, letterSpacing: '-0.8px' }}>
              {mode === 'admin' ? person.name : period.label}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {mode === 'admin' ? `${period.label} · ${period.cycle}` : period.cycle}
            </div>
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(period.status)}`} style={{ fontSize: 12 }}>{period.status}</span>
      </div>

      {period.status === 'Update needed' && period.notes && (
        <div style={{ background: 'var(--color-status-warning-bg)', border: '1px solid var(--color-status-warning-border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-status-warning-text)', marginBottom: 4 }}>Update needed</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{period.notes}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Main column */}
        <div style={{ flex: 2, minWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Stat label="Gross pay" value={money(gross)} />
            <Stat label="Net pay" value={money(net)} />
            <Stat
              label="Hours (actual / target)"
              value={`${period.actualHours} / ${period.targetHours}`}
              valueColor={behind ? '#cc3a00' : undefined}
            />
            <Stat label="Pay date" value={period.payDate ? new Date(period.payDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Pending'} />
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Pay breakdown</div>

            {period.earnings && (
              <LineSection
                title="Earnings"
                rows={[
                  { label: 'Salary (prorated)', amount: period.earnings.base },
                  { label: 'Incentives', amount: period.earnings.incentives },
                  { label: 'Bonus', amount: period.earnings.bonus },
                ]}
              />
            )}

            {period.deductions && deductionsTotal(period) > 0 && (
              <LineSection
                title="Deductions"
                negative
                rows={[
                  { label: 'Provident fund', amount: period.deductions.providentFund },
                  { label: 'Salary advance', amount: period.deductions.salaryAdvance },
                  { label: 'Other', amount: period.deductions.other },
                ]}
              />
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Adjustments</div>
                {adjustmentsTotal(period) !== 0 && <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{money(adjustmentsTotal(period))}</span>}
              </div>
              {(period.adjustments ?? []).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No adjustments.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(period.adjustments ?? []).map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--table-row-border)' }}>
                      <span className="badge b-neutral" style={{ fontSize: 10, flexShrink: 0 }}>{a.type}</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{a.description}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{money(a.amount)}</span>
                      {canEdit && (
                        <button onClick={() => removeAdjustment(period.id, i)} aria-label="Remove adjustment" style={{ display: 'flex', padding: 2 }}>
                          <TrashIcon size={13} color="var(--color-text-tertiary)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <select className="input" style={{ width: 120 }} value={adjType} onChange={(e) => setAdjType(e.target.value as PayrollAdjustment['type'])}>
                    {ADJUSTMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Description" value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} />
                  <input className="input" style={{ width: 100 }} type="number" placeholder="Amount" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
                  <button className="btn-outline" onClick={submitAdjustment} disabled={!adjDesc.trim() || !adjAmount}>
                    <PlusIcon size={13} /> Add
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-background-subtle)', borderRadius: 10, padding: '12px 16px', marginTop: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Net pay</span>
              <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{money(net)}</span>
            </div>
          </div>
        </div>

        {/* Sidebar column */}
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Actions</div>

            {mode === 'self' && period.status === 'Timesheet pending' && (
              <button className="btn-dark" onClick={() => submitPeriod(period.id)}>Submit timesheet</button>
            )}
            {mode === 'self' && period.status !== 'Timesheet pending' && (
              <Link to={`/payroll/payslip/${period.id}`} className="btn-outline" style={{ justifyContent: 'center' }}>View payslip</Link>
            )}

            {mode === 'admin' && period.status === 'Timesheet pending' && (
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Waiting on the employee to submit their timesheet.</div>
            )}

            {mode === 'admin' && (period.status === 'Under review' || period.status === 'Update needed') && (
              <>
                <button className="btn-dark" onClick={() => reviewPeriod(period.id, 'Approved')}>Approve</button>
                {!showNoteField ? (
                  <button className="btn-outline" onClick={() => { setNoteDraft(period.notes ?? ''); setShowNoteField(true) }}>
                    {period.status === 'Update needed' ? 'Edit update note' : 'Request update'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      className="input"
                      style={{ height: 70, padding: 10 }}
                      placeholder="What needs to change before this can be approved?"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowNoteField(false)}>Cancel</button>
                      <button className="btn-dark" style={{ flex: 1, justifyContent: 'center' }} disabled={!noteDraft.trim()} onClick={confirmRequestUpdate}>Send</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === 'admin' && period.status === 'Approved' && (
              !showPayDateField ? (
                <button className="btn-dark" onClick={() => setShowPayDateField(true)}>Mark as paid out</button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="field-label">Pay date</div>
                  <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowPayDateField(false)}>Cancel</button>
                    <button className="btn-dark" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmMarkPaid}>Confirm</button>
                  </div>
                </div>
              )
            )}

            {mode === 'admin' && period.status === 'Paid out' && (
              <Link to={`/payroll/payslip/${period.id}`} className="btn-outline" style={{ justifyContent: 'center' }}>View payslip</Link>
            )}
          </div>

          {mode === 'admin' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Employee</div>
              <Field label="Email" value={person.email} />
              <Field label="Employee ID" value={person.employeeId ?? '—'} />
              <Field label="Department" value={person.department ?? '—'} />
              <Field label="Jurisdiction" value={person.jurisdiction ?? '—'} />
            </div>
          )}

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HistoryIcon size={14} color="var(--color-text-secondary)" /> Status history
            </div>
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No history on file yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...history].reverse().map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--table-row-border)' }}>
                    <span className={`badge ${statusBadgeClass(h.status)}`} style={{ fontSize: 9, flexShrink: 0, alignSelf: 'flex-start' }}>{h.status}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {h.note && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{h.note}</div>}
                      <div className="mono" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{fmtDateTime(h.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="stat" style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, marginTop: 6, color: valueColor }}>{value}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 1 }}>{value}</div>
    </div>
  )
}

function LineSection({ title, rows, negative }: { title: string; rows: { label: string; amount: number }[]; negative?: boolean }) {
  const visible = rows.filter((r) => r.amount !== 0)
  if (visible.length === 0) return null
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{title}</div>
      {visible.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--table-row-border)' }}>
          <span style={{ fontSize: 13 }}>{r.label}</span>
          <span className="mono" style={{ fontSize: 13 }}>{negative ? '−' : ''}{money(r.amount)}</span>
        </div>
      ))}
    </div>
  )
}
