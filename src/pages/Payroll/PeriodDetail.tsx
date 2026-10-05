import { useEffect, useMemo, useState } from 'react'
import DatePicker from '../../components/DatePicker'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { avatarContent } from '../../components/Avatar'
import { ChevronLeftIcon, DownloadIcon, HistoryIcon, PayrollFileIcon, PlusIcon, TrashIcon, WalletIcon } from '../../components/icons'
import { CURRENT_USER_ID, personById } from '../../data/people'
import { useLeaveRequests, type LeaveRequest } from '../../data/leave'
import { showToast } from '../../data/toast'
import {
  entriesForPersonWeek,
  formatMinutes,
  formatWeekRange,
  minutesForPersonWeek,
  projectLabel,
  submissionFor,
  useSubmissions,
  useTimeEntries,
  weeksOverlapping,
  type TimeEntry,
} from '../../data/timeEntries'
import {
  addAdjustment,
  adjustmentsTotal,
  confirmTimesheet,
  deductionsTotal,
  earningsTotal,
  markPaidOut,
  netPay,
  removeAdjustment,
  requestUpdate,
  reviewPeriod,
  setLeaveHours,
  statusBadgeClass,
  submitPeriod,
  usePayrollPeriods,
  type PayrollAdjustment,
} from '../../data/payroll'
import { Select } from '../../components/SearchableSelect'

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ADJUSTMENT_TYPES: PayrollAdjustment['type'][] = ['Equipment', 'Software', 'Travel', 'Other']

// A leave request is parsed from its "14-Sep-2026" display date and matched to the
// period purely by name (leave.ts has no personId), scoped to the period's cycle range.
function parseLeaveDate(display: string): string {
  const d = new Date(display)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function leaveInRange(requests: LeaveRequest[], personName: string, start?: string, end?: string): LeaveRequest[] {
  if (!start || !end) return []
  return requests.filter((r) => {
    if (r.requestedBy !== personName) return false
    const d = parseLeaveDate(r.date)
    return d >= start && d <= end
  })
}

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
  const [ptoDraft, setPtoDraft] = useState('')
  const [unpaidDraft, setUnpaidDraft] = useState('')

  const allEntries = useTimeEntries()
  useSubmissions() // re-render when submissions change, read via submissionFor below
  const leaveRequests = useLeaveRequests()

  const backHref = mode === 'admin' ? '/payroll/reviews' : '/payroll/my'

  useEffect(() => {
    if (!period) return
    setPtoDraft(String(period.ptoHours ?? 0))
    setUnpaidDraft(String(period.unpaidHours ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id])

  const weeks = useMemo(() => (period?.cycleStart && period?.cycleEnd ? weeksOverlapping(period.cycleStart, period.cycleEnd) : []), [period?.cycleStart, period?.cycleEnd])
  const leaveTaken = useMemo(
    () => (person ? leaveInRange(leaveRequests, person.name, period?.cycleStart, period?.cycleEnd) : []),
    [leaveRequests, person, period?.cycleStart, period?.cycleEnd],
  )

  if (!period || !person) {
    return (
      <AppShell appIcon={<WalletIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active={mode === 'admin' ? 'reviews' : 'my-payroll'} />}>
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

  function saveLeaveHours() {
    setLeaveHours(period!.id, Number(ptoDraft) || 0, Number(unpaidDraft) || 0)
  }

  function doConfirmTimesheet() {
    confirmTimesheet(period!.id, person!.name)
  }

  function reviewInvoice() {
    showToast("Invoice preview isn't wired up in this build", 'info')
  }

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
    <AppShell appIcon={<WalletIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active={mode === 'admin' ? 'reviews' : 'my-payroll'} />}>
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

      {mode === 'admin' && period.status === 'Update needed' && period.notes && (
        <div style={{ background: 'var(--color-status-warning-bg)', border: '1px solid var(--color-status-warning-border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-status-warning-text)', marginBottom: 4 }}>Update needed</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{period.notes}</div>
        </div>
      )}

      {mode === 'self' && period.status === 'Timesheet pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'var(--color-background-subtle)', border: '1px solid var(--color-border-default)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              This is your draft for this period — nothing has been sent to finance yet. Check the pay breakdown and leave hours, add anything that's missing, then submit for review.
            </div>
          </div>
          <div style={{ background: 'var(--color-status-warning-bg)', border: '1px solid var(--color-status-warning-border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--color-status-warning-text)' }}>
              Your pay cycle ended on {period.cycleEnd ? fmtDate(period.cycleEnd) : 'recently'} and this period still hasn't been submitted. Check your hours before and submit as soon as possible.
            </div>
          </div>
        </div>
      )}

      {mode === 'self' && period.status === 'Update needed' && (
        <div style={{ background: 'var(--color-status-warning-bg)', border: '1px solid var(--color-status-warning-border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-status-warning-text)', marginBottom: 4 }}>Finance has requested a change</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{period.notes || 'Edit the figures below to correct them, then re-submit.'}</div>
        </div>
      )}

      {mode === 'self' && period.status === 'Paid out' && (
        <div style={{ background: 'rgba(0, 150, 100, 0.08)', border: '1px solid rgba(0, 150, 100, 0.25)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
            You've been paid for this period. {period.payDate ? `Paid on ${fmtDate(period.payDate)}.` : ''}
          </div>
        </div>
      )}

      {mode === 'self' && (period.status === 'Under review' || period.status === 'Approved') && (
        <div style={{ background: 'var(--color-background-subtle)', border: '1px solid var(--color-border-default)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {period.status === 'Under review' ? "Submitted — waiting on finance review." : "Approved — waiting to be paid out."}
          </div>
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
              valueColor={behind ? 'var(--warn-fg)' : undefined}
            />
            <Stat label="Pay date" value={period.payDate ? new Date(period.payDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Pending'} />
            {mode === 'self' && period.workingDays !== undefined && (
              <Stat label="Working days" value={`${period.workingDays}${period.holidays ? ` (${period.holidays} holiday${period.holidays === 1 ? '' : 's'})` : ''}`} />
            )}
            {mode === 'self' && period.eligibleDays !== undefined && (
              <Stat label="Eligible days" value={String(period.eligibleDays)} />
            )}
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
                  <Select className="input" style={{ width: 120 }} value={adjType} onChange={(e) => setAdjType(e.target.value as PayrollAdjustment['type'])}>
                    {ADJUSTMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
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

          {mode === 'self' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Leave taken this period</div>
                {leaveTaken.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 6 }}>No leave taken this period.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                    {leaveTaken.map((l, i) => (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--table-row-border)' }}>
                        <span style={{ fontSize: 13, flex: 1 }}>{l.date}</span>
                        <span className="badge b-neutral" style={{ fontSize: 10 }}>{l.type}</span>
                        <span className="mono" style={{ fontSize: 12 }}>{l.days}d</span>
                        <span className={`badge ${l.status === 'Approved' ? 'b-pine' : l.status === 'Rejected' ? 'b-danger' : 'b-ember'}`} style={{ fontSize: 10 }}>{l.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--table-row-border)', paddingTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Leave hours</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2, marginBottom: 10 }}>
                  Taken from your approved leave — if the hours here don't match the time you actually took, correct them before payroll uses these figures.
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div className="field-label">PTO hours</div>
                    <input className="input" type="number" value={ptoDraft} onChange={(e) => setPtoDraft(e.target.value)} disabled={!canEdit && period.status !== 'Timesheet pending'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div className="field-label">Unpaid (UPTO) hours</div>
                    <input className="input" type="number" value={unpaidDraft} onChange={(e) => setUnpaidDraft(e.target.value)} disabled={!canEdit && period.status !== 'Timesheet pending'} />
                  </div>
                  <button className="btn-outline" onClick={saveLeaveHours} disabled={canEdit ? false : period.status !== 'Timesheet pending'}>Save hours</button>
                </div>
              </div>
            </div>
          )}

          {mode === 'self' && weeks.length > 0 && (
            <TimesheetEntriesCard personId={period.personId} weeks={weeks} entries={allEntries} />
          )}
        </div>

        {/* Sidebar column */}
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Actions</div>

            {mode === 'self' && (period.status === 'Timesheet pending' || period.status === 'Update needed') && (
              <>
                {!period.timesheetConfirmed ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Check the timesheet entries below, then confirm they're complete and ready for payroll.
                    </div>
                    <button className="btn-outline" onClick={doConfirmTimesheet}>Confirm timesheet</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    Confirmed {new Date(period.timesheetConfirmedAt!).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })} — your timesheet is ready for payroll.
                  </div>
                )}
                <button className="btn-dark" disabled={!period.timesheetConfirmed} onClick={() => submitPeriod(period.id)}>
                  {period.status === 'Update needed' ? 'Re-submit payroll' : 'Submit payroll'}
                </button>
              </>
            )}
            {mode === 'self' && period.status !== 'Timesheet pending' && period.status !== 'Update needed' && (
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
                  <DatePicker value={payDate} onChange={setPayDate} />
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

          {mode === 'self' && period.invoiceNumber && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Invoice</div>
              <Field label="Invoice number" value={period.invoiceNumber} />
              <Field label="Amount" value={money(period.invoiceAmount ?? period.grossPay)} />
              <Field label="Issued" value={period.invoiceIssuedAt ? fmtDate(period.invoiceIssuedAt) : '—'} />
              <Field label="Paid" value={period.invoicePaidAt ? fmtDate(period.invoicePaidAt) : '—'} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/payroll/payslip/${period.id}`} className="btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
                  <DownloadIcon size={13} /> Payslip
                </Link>
                <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={reviewInvoice}>Review invoice</button>
              </div>
            </div>
          )}
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

// Pulls the real, already-tracked time entries + their week-level approval status
// into the payroll period — rather than inventing a parallel "payroll timesheet"
// record, this reuses the same data the Timesheets/Approvals pages already show.
function TimesheetEntriesCard({ personId, weeks, entries }: { personId: string; weeks: string[]; entries: TimeEntry[] }) {
  const [openWeek, setOpenWeek] = useState<string | null>(null)
  const mine = entries.filter((e) => e.personId === personId)
  const totalMinutes = weeks.reduce((sum, w) => sum + minutesForPersonWeek(mine, personId, w), 0)
  const totalEntries = weeks.reduce((sum, w) => sum + entriesForPersonWeek(mine, personId, w).length, 0)
  const approvedWeeks = weeks.filter((w) => submissionFor(personId, w)?.status === 'Approved').length
  const approvedPct = weeks.length ? Math.round((approvedWeeks / weeks.length) * 100) : 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Timesheet entries</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} · {formatMinutes(totalMinutes)}
          </span>
          <span className={`badge ${approvedPct === 100 ? 'b-pine' : 'b-ember'}`} style={{ fontSize: 10 }}>
            {approvedPct}% approved
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weeks.map((w) => {
          const sub = submissionFor(personId, w)
          const status = sub?.status ?? 'Not Submitted'
          const minutes = minutesForPersonWeek(mine, personId, w)
          const weekEntries = entriesForPersonWeek(mine, personId, w)
          const isOpen = openWeek === w
          return (
            <div key={w} style={{ border: '1px solid var(--table-row-border)', borderRadius: 8 }}>
              <button
                onClick={() => setOpenWeek(isOpen ? null : w)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', gap: 8 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatWeekRange(w)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatMinutes(minutes)}</span>
                  <span className={`badge ${status === 'Approved' ? 'b-pine' : status === 'Rejected' ? 'b-danger' : 'b-ember'}`} style={{ fontSize: 9 }}>{status}</span>
                </span>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--table-row-border)', padding: '6px 12px 10px' }}>
                  {weekEntries.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', padding: '6px 0' }}>Nothing logged this week.</div>
                  ) : (
                    weekEntries.map((entry) => (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--table-row-border)' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', width: 70, flexShrink: 0 }}>
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                        </span>
                        <span className="mono" style={{ fontSize: 12, width: 48, flexShrink: 0 }}>{formatMinutes(entry.minutes)}</span>
                        {entry.billable !== false && <span className="badge b-pine" style={{ fontSize: 9 }}>Billable</span>}
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{projectLabel(entry.projectId)}</span>
                        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.category}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
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
