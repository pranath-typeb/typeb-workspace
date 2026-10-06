import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import Breadcrumb from '../../components/Breadcrumb'
import DatePicker from '../../components/DatePicker'
import { avatarContent } from '../../components/Avatar'
import { ChecksPanel, HoursMeter, Section, StageChip, Stepper, Timeline, fmtDate, fmtDateTime, money } from '../../components/PayrollParts'
import { CloseIcon, DownloadIcon, TrashIcon, WalletIcon } from '../../components/icons'
import { Select } from '../../components/SearchableSelect'
import { CURRENT_USER_ID, personById } from '../../data/people'
import { parseLeaveDate as parseLeaveDateObj, useLeaveRequests, type LeaveRequest } from '../../data/leave'
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
  submitPeriod,
  usePayrollPeriods,
  type PayrollAdjustment,
  type PayrollPeriod,
} from '../../data/payroll'
import { addDocument, removeDocument, saveReviewNotes, usePayrollExtras } from '../../data/payrollExtras'
import { cycleBounds, isOverdue, nextStep, reconcile, reviewChecks, stageOf, weeksProgress } from '../../data/payrollInsights'

const ADJUSTMENT_TYPES: PayrollAdjustment['type'][] = ['Equipment', 'Software', 'Travel', 'Other']

function leaveInRange(requests: LeaveRequest[], personName: string, start: string, end: string): LeaveRequest[] {
  return requests.filter((r) => {
    if (r.requestedBy !== personName) return false
    const d = parseLeaveDateObj(r.date)
    if (!d) return false
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return ymd >= start && ymd <= end
  })
}

const BANNER_TONE: Record<string, string> = {
  'awaiting-confirmation': 'purple',
  'awaiting-approval': 'neutral',
  ready: 'teal',
  'under-review': 'amber',
  'update-needed': 'red',
  approved: 'green',
  paid: 'green',
}

export default function PeriodDetail({ mode }: { mode: 'admin' | 'self' }) {
  const { periodId } = useParams<{ periodId: string }>()
  const periods = usePayrollPeriods()
  const period = periodId ? periods.find((p) => p.id === periodId) : undefined
  const person = period ? personById(period.personId) : undefined
  const extras = usePayrollExtras(period?.id)
  const me = personById(CURRENT_USER_ID)?.name ?? 'You'

  const allEntries = useTimeEntries()
  useSubmissions()
  const leaveRequests = useLeaveRequests()

  const [ptoDraft, setPtoDraft] = useState('')
  const [unpaidDraft, setUnpaidDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [evidenceDraft, setEvidenceDraft] = useState('')
  const [decisionNote, setDecisionNote] = useState('')
  const [changesOpen, setChangesOpen] = useState(false)
  const [changesNote, setChangesNote] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [adjType, setAdjType] = useState<PayrollAdjustment['type']>('Other')
  const [adjDesc, setAdjDesc] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!period) return
    setPtoDraft(String(period.ptoHours ?? 0))
    setUnpaidDraft(String(period.unpaidHours ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id, period?.ptoHours, period?.unpaidHours])
  useEffect(() => {
    setNotesDraft(extras.reviewNotes ?? '')
    setEvidenceDraft(extras.evidence ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id, extras.reviewNotes, extras.evidence])

  const bounds = period ? cycleBounds(period) : { start: '', end: '' }
  const weeks = useMemo(() => (period ? weeksOverlapping(bounds.start, bounds.end) : []), [period, bounds.start, bounds.end])
  const leaveTaken = useMemo(() => (person ? leaveInRange(leaveRequests, person.name, bounds.start, bounds.end) : []), [leaveRequests, person, bounds.start, bounds.end])

  const backHref = mode === 'admin' ? '/payroll/reviews' : '/payroll/my'
  const sidebarKey = mode === 'admin' ? 'reviews' : 'my-payroll'
  const shell = (children: React.ReactNode) => (
    <AppShell appIcon={<WalletIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active={sidebarKey} />}>
      {children}
    </AppShell>
  )

  if (!period || !person) {
    return shell(
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that payroll period.</div>
        <Link to={backHref} className="btn-outline">Back</Link>
      </div>,
    )
  }

  const p: PayrollPeriod = period
  const stage = stageOf(p)
  const overdue = isOverdue(p)
  const step = nextStep(p, mode === 'admin' ? 'admin' : 'self')
  const checks = reviewChecks(p)
  const rec = reconcile(p)
  const wp = weeksProgress(p)
  const gross = earningsTotal(p)
  const net = netPay(p)
  const canEditLeave = mode === 'admin' ? p.status !== 'Paid out' : p.status === 'Timesheet pending' || p.status === 'Update needed'
  const isAdminDecision = mode === 'admin' && (p.status === 'Under review' || p.status === 'Update needed')
  const issues = checks.filter((c) => c.state !== 'ok').length
  const leaveDirty = ptoDraft !== String(p.ptoHours ?? 0) || unpaidDraft !== String(p.unpaidHours ?? 0) || notesDraft !== (extras.reviewNotes ?? '') || evidenceDraft !== (extras.evidence ?? '')
  const tone = BANNER_TONE[stage.key]

  function saveChanges() {
    const pto = Number(ptoDraft) || 0
    const upto = Number(unpaidDraft) || 0
    if (pto !== (p.ptoHours ?? 0) || upto !== (p.unpaidHours ?? 0)) setLeaveHours(p.id, pto, upto, me)
    if (mode === 'admin') saveReviewNotes(p.id, { reviewNotes: notesDraft, evidence: evidenceDraft }, me)
  }
  function submitAdjustment() {
    const amount = Number(adjAmount)
    if (!adjDesc.trim() || !amount) return
    addAdjustment(p.id, { type: adjType, description: adjDesc.trim(), date: new Date().toISOString().slice(0, 10), amount })
    setAdjDesc('')
    setAdjAmount('')
  }
  function approve() {
    reviewPeriod(p.id, 'Approved', decisionNote)
    setDecisionNote('')
  }
  function sendChanges() {
    if (!changesNote.trim()) return
    requestUpdate(p.id, changesNote.trim())
    setChangesOpen(false)
    setChangesNote('')
  }
  function onPickFiles(files: FileList | null) {
    Array.from(files ?? []).forEach((f) => addDocument(p.id, { name: f.name, size: f.size }, me))
    if (fileRef.current) fileRef.current.value = ''
  }

  const editRows = extras.edits ?? []

  return shell(
    <>
      <Breadcrumb
        items={[
          { label: 'Payroll', to: '/payroll' },
          { label: mode === 'admin' ? 'Reviews' : 'My Payroll', to: backHref },
          { label: mode === 'admin' ? person.name : p.label },
        ]}
      />

      {/* header */}
      <div className="pr-head">
        <div className="pr-head-id">
          {mode === 'admin' && (
            <Link to={`/people/${person.id}`} className="avatar" style={{ width: 46, height: 46, fontSize: 15, flexShrink: 0 }}>
              {avatarContent(person)}
            </Link>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="serif pr-head-title">{mode === 'admin' ? person.name : p.label}</h1>
            <div className="pr-dash-sub">{mode === 'admin' ? `${p.label} · ` : ''}Pay cycle {p.cycle}</div>
          </div>
        </div>
        <StageChip stage={stage} overdue={overdue} />
      </div>

      {/* what is happening + what happens next */}
      <div className={`pr-banner tone-${tone}`}>
        <div className="pr-banner-text">
          <div className="pr-banner-title">{step.title}</div>
          <div className="pr-banner-body">{step.body}</div>
          {overdue && mode === 'self' && <div className="pr-banner-body" style={{ marginTop: 4 }}>Your pay cycle ended on {fmtDate(bounds.end)}.</div>}
        </div>
        <Stepper stage={stage} flagged={stage.key === 'update-needed'} />
      </div>

      <div className="pr-layout">
        <div className="pr-main">
          {/* key numbers */}
          <div className="pr-keys">
            <div className="pr-key">
              <span className="pr-tile-label">{mode === 'admin' ? 'Gross pay' : 'You earn'}</span>
              <span className="mono pr-key-val">{money(gross)}</span>
            </div>
            <div className="pr-key">
              <span className="pr-tile-label">Net pay</span>
              <span className="mono pr-key-val">{money(net)}</span>
            </div>
            <div className="pr-key">
              <span className="pr-tile-label">Hours vs target</span>
              <HoursMeter p={p} />
            </div>
            <div className="pr-key">
              <span className="pr-tile-label">Pay date</span>
              <span className="mono pr-key-val">{p.payDate ? fmtDate(p.payDate) : 'Not set'}</span>
            </div>
          </div>

          <Section title="Pay breakdown" summary={<span className="mono">{money(net)} net</span>}>
            {p.earnings && <Lines title="Earnings" rows={[{ label: 'Salary (prorated)', amount: p.earnings.base }, { label: 'Incentives', amount: p.earnings.incentives }, { label: 'Bonus', amount: p.earnings.bonus }]} />}
            {!p.earnings && <Lines title="Earnings" rows={[{ label: 'Salary', amount: p.grossPay }]} />}
            {p.deductions && deductionsTotal(p) > 0 && (
              <Lines title="Deductions" negative rows={[{ label: 'Provident fund', amount: p.deductions.providentFund }, { label: 'Salary advance', amount: p.deductions.salaryAdvance }, { label: 'Other', amount: p.deductions.other }]} />
            )}
            <div>
              <div className="pr-lines-title">
                <span>Adjustments</span>
                {adjustmentsTotal(p) !== 0 && <span className="mono">{money(adjustmentsTotal(p))}</span>}
              </div>
              {(p.adjustments ?? []).length === 0 ? (
                <div className="pp-empty">No adjustments.</div>
              ) : (
                (p.adjustments ?? []).map((a, i) => (
                  <div key={i} className="pr-line">
                    <span className="badge b-neutral" style={{ fontSize: 10 }}>{a.type}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{a.description}</span>
                    <span className="mono" style={{ fontSize: 13 }}>{money(a.amount)}</span>
                    {mode === 'admin' && (
                      <button onClick={() => removeAdjustment(p.id, i)} aria-label="Remove adjustment" style={{ display: 'flex', padding: 2 }}>
                        <TrashIcon size={13} color="var(--color-text-tertiary)" />
                      </button>
                    )}
                  </div>
                ))
              )}
              {mode === 'admin' && p.status !== 'Paid out' && (
                <div className="pr-adj-form">
                  <Select className="input" style={{ width: 120 }} value={adjType} onChange={(e) => setAdjType(e.target.value as PayrollAdjustment['type'])}>
                    {ADJUSTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Description" value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} />
                  <input className="input" style={{ width: 100 }} type="number" placeholder="Amount" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
                  <button className="btn-outline" onClick={submitAdjustment} disabled={!adjDesc.trim() || !adjAmount}>+ Add</button>
                </div>
              )}
            </div>
            <div className="pr-net">
              <span>Net pay</span>
              <span className="mono">{money(net)}</span>
            </div>
          </Section>

          <Section title="Calculation & reconciliation" badge={<span className={`pr-flag ${rec.reconciled ? 'ok' : 'warn'}`}>{rec.reconciled ? 'Reconciled' : 'Doesn’t add up'}</span>}>
            <div className="pr-two">
              <div>
                <div className="pr-lines-title"><span>How pay was worked out</span></div>
                <KV label="Working days (full month)" value={String(p.workingDays ?? '—')} />
                <KV label="Public holidays" value={String(p.holidays ?? 0)} />
                <KV label="Eligible paid days" value={String(p.eligibleDays ?? p.workingDays ?? '—')} />
                <KV label="PTO / UPTO hours" value={`${p.ptoHours ?? 0} / ${p.unpaidHours ?? 0}`} />
                <KV label="Timesheet hours" value={String(p.actualHours)} />
                <KV label="Gross pay" value={money(gross)} strong />
              </div>
              <div>
                <div className="pr-lines-title"><span>Does it match?</span></div>
                <KV label="Target hours" value={String(rec.targetHours)} />
                <KV label="Timesheet hours" value={String(rec.timesheetHours)} />
                <KV label="Hours difference" value={`${rec.hoursDiff > 0 ? '+' : ''}${rec.hoursDiff}`} warn={rec.hoursDiff < 0} />
                <KV label="Invoice amount" value={rec.invoiceAmount === null ? 'No invoice yet' : money(rec.invoiceAmount)} />
                <KV label="Invoice vs gross" value={rec.amountDiff === null ? '—' : money(rec.amountDiff)} warn={!!rec.amountDiff && Math.abs(rec.amountDiff) > 0.01} />
                <KV label="Adjustments total" value={money(rec.adjustments)} />
                <KV label="Left unexplained" value={rec.residual === null ? '—' : money(rec.residual)} strong warn={!rec.reconciled} />
              </div>
            </div>
          </Section>

          <Section title="Leave & notes" summary={`${leaveTaken.length} ${leaveTaken.length === 1 ? 'leave request' : 'leave requests'} this cycle`}>
            <div>
              <div className="pr-lines-title"><span>Leave taken this cycle</span></div>
              {leaveTaken.length === 0 ? (
                <div className="pp-empty">No leave taken this period.</div>
              ) : (
                leaveTaken.map((l) => (
                  <div key={l.id} className="pr-line">
                    <span style={{ flex: 1, fontSize: 13 }}>{l.date}</span>
                    <span className="badge b-neutral" style={{ fontSize: 10 }}>{l.type}</span>
                    <span className="mono" style={{ fontSize: 12 }}>{l.days}d</span>
                    <span className={`badge ${l.status === 'Approved' ? 'b-pine' : l.status === 'Rejected' ? 'b-danger' : 'b-ember'}`} style={{ fontSize: 10 }}>{l.status}</span>
                  </div>
                ))
              )}
            </div>
            <div className="pr-leave-edit">
              <div className="pr-lines-title"><span>Leave hours payroll will use</span></div>
              <div className="pp-empty" style={{ marginTop: -4 }}>
                Taken from approved leave. If the hours don’t match the time actually taken, correct them. Unpaid hours reduce the days that are paid.
              </div>
              <div className="pr-leave-fields">
                <div>
                  <div className="field-label">PTO hours</div>
                  <input className="input" type="number" min={0} value={ptoDraft} onChange={(e) => setPtoDraft(e.target.value)} disabled={!canEditLeave} />
                </div>
                <div>
                  <div className="field-label">Unpaid (UPTO) hours</div>
                  <input className="input" type="number" min={0} value={unpaidDraft} onChange={(e) => setUnpaidDraft(e.target.value)} disabled={!canEditLeave} />
                </div>
              </div>
              {mode === 'admin' && (
                <>
                  <div>
                    <div className="field-label">Notes</div>
                    <textarea className="input" style={{ height: 64, padding: 10 }} placeholder="Anything finance should know about this period" value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} disabled={!canEditLeave} />
                  </div>
                  <div>
                    <div className="field-label">Supporting evidence (reference)</div>
                    <input className="input" placeholder="Ticket, email or document reference" value={evidenceDraft} onChange={(e) => setEvidenceDraft(e.target.value)} disabled={!canEditLeave} />
                  </div>
                </>
              )}
              {canEditLeave && (
                <div>
                  <button className="btn-dark" disabled={!leaveDirty} onClick={saveChanges}>{mode === 'admin' ? 'Save & recompute' : 'Save hours'}</button>
                </div>
              )}
            </div>
          </Section>

          {weeks.length > 0 && (
            <Section title="Timesheet entries" defaultOpen={mode === 'self'} badge={<span className={`pr-flag ${wp.approved === wp.total ? 'ok' : 'warn'}`}>{wp.approved}/{wp.total} weeks approved</span>}>
              <TimesheetWeeks personId={p.personId} weeks={weeks} entries={allEntries} />
            </Section>
          )}

          <Section title="Documents" defaultOpen={(extras.documents ?? []).length > 0} summary={(extras.documents ?? []).length ? `${(extras.documents ?? []).length} attached` : undefined}>
            {(extras.documents ?? []).length === 0 && <div className="pp-empty">No documents attached.</div>}
            {(extras.documents ?? []).map((d) => (
              <div key={d.id} className="pr-line">
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span className="pr-muted">{(d.size / 1024).toFixed(0)} KB · {d.uploadedBy} · {fmtDateTime(d.uploadedAt)}</span>
                <button onClick={() => removeDocument(p.id, d.id)} aria-label={`Remove ${d.name}`} style={{ display: 'flex', padding: 2 }}>
                  <TrashIcon size={13} color="var(--color-text-tertiary)" />
                </button>
              </div>
            ))}
            <div>
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
              <button className="btn-outline" onClick={() => fileRef.current?.click()}>+ Upload document</button>
            </div>
          </Section>

          <Section title="Edit history" defaultOpen={false} summary={`${editRows.length} ${editRows.length === 1 ? 'change' : 'changes'}`}>
            {editRows.length === 0 ? (
              <div className="pp-empty">No edits have been made to this period.</div>
            ) : (
              [...editRows].reverse().map((e, i) => (
                <div key={i} className="pr-line" style={{ alignItems: 'flex-start' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    <b>{e.field}</b> changed from <span className="mono">{e.from || '—'}</span> to <span className="mono">{e.to || '—'}</span>
                    <span className="pr-muted" style={{ display: 'block' }}>{e.by} · {fmtDateTime(e.at)}</span>
                  </span>
                </div>
              ))
            )}
          </Section>
        </div>

        <aside className="pr-side">
          {/* admin decision */}
          {mode === 'admin' && (
            <div className="card pr-decision pr-first">
              <div className="pr-section-title">{isAdminDecision ? 'Your decision' : 'Actions'}</div>
              {p.status === 'Timesheet pending' && (
                <>
                  <div className="pp-empty" style={{ padding: 0 }}>{step.body}</div>
                  {!p.timesheetConfirmed && <button className="btn-outline" onClick={() => confirmTimesheet(p.id, me)}>Confirm timesheet on their behalf</button>}
                </>
              )}
              {isAdminDecision && (
                <>
                  <textarea className="input" style={{ height: 64, padding: 10 }} placeholder="Note (optional) — shown in the status history" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
                  {issues > 0 && <div className="pr-decision-warn">{issues} {issues === 1 ? 'check needs' : 'checks need'} a look in the checklist below.</div>}
                  <button className="btn-dark" onClick={approve} disabled={p.status === 'Update needed'} title={p.status === 'Update needed' ? 'Waiting for the employee to re-submit' : undefined}>Approve</button>
                  <button className="btn-outline" onClick={() => { setChangesNote(p.notes ?? ''); setChangesOpen(true) }}>{p.status === 'Update needed' ? 'Edit change request' : 'Request changes'}</button>
                </>
              )}
              {p.status === 'Approved' && (
                !payOpen ? (
                  <button className="btn-dark" onClick={() => setPayOpen(true)}>Mark as paid out</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="field-label">Pay date</div>
                    <DatePicker value={payDate} onChange={setPayDate} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPayOpen(false)}>Cancel</button>
                      <button className="btn-dark" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { markPaidOut(p.id, payDate); setPayOpen(false) }}>Confirm</button>
                    </div>
                  </div>
                )
              )}
              {p.status === 'Paid out' && <div className="pp-empty" style={{ padding: 0 }}>Paid{p.payDate ? ` on ${fmtDate(p.payDate)}` : ''}. Nothing more to do.</div>}
            </div>
          )}

          {/* employee actions */}
          {mode === 'self' && (p.status === 'Timesheet pending' || p.status === 'Update needed') && (
            <div className="card pr-decision pr-first">
              <div className="pr-section-title">Your steps</div>
              <Step n={1} done={!!p.timesheetConfirmed} title="Confirm your timesheet" body={p.timesheetConfirmed ? `Confirmed ${fmtDate((p.timesheetConfirmedAt ?? '').slice(0, 10))}` : 'Check the entries and leave, then confirm they are complete.'} />
              {!p.timesheetConfirmed && <button className="btn-outline" onClick={() => confirmTimesheet(p.id, me)}>Confirm timesheet</button>}
              <Step n={2} done={false} title={p.status === 'Update needed' ? 'Re-submit your payroll' : 'Submit your payroll'} body={p.timesheetConfirmed ? 'Send it to finance for review.' : 'Available once your timesheet is confirmed.'} />
              <button className="btn-dark" disabled={!p.timesheetConfirmed} onClick={() => submitPeriod(p.id)}>{p.status === 'Update needed' ? 'Re-submit payroll' : 'Submit payroll'}</button>
            </div>
          )}

          {mode === 'admin' && <ChecksPanelCard checks={checks} />}
          {mode === 'self' && (p.status === 'Timesheet pending' || p.status === 'Update needed') && <ChecksPanelCard checks={checks.filter((c) => ['confirmed', 'weeks', 'leave'].includes(c.key))} />}

          {mode === 'admin' && (
            <div className="card pr-info">
              <div className="pr-section-title">Employee</div>
              <KV label="Email" value={person.email} />
              <KV label="Employee ID" value={person.employeeId ?? '—'} />
              <KV label="Department" value={person.department ?? '—'} />
              <KV label="Jurisdiction" value={person.jurisdiction ?? '—'} />
            </div>
          )}

          <div className="card pr-info">
            <div className="pr-section-title">Invoice</div>
            <KV label="Invoice number" value={p.invoiceNumber ?? (p.status === 'Approved' || p.status === 'Paid out' ? '—' : 'Assigned when approved')} />
            <KV label="Amount" value={money(p.invoiceAmount ?? gross)} />
            <KV label="Issued" value={p.invoiceIssuedAt ? fmtDate(p.invoiceIssuedAt) : '—'} />
            <KV label="Paid" value={p.invoicePaidAt ? fmtDate(p.invoicePaidAt) : '—'} />
            <div className="pr-doc-links">
              <Link to={`/payroll/invoice/${p.id}`} className="btn-outline" style={{ flex: 1, justifyContent: 'center' }}>View invoice</Link>
              <Link to={`/payroll/payslip/${p.id}`} className="btn-outline" style={{ flex: 1, justifyContent: 'center' }}><DownloadIcon size={13} /> Payslip</Link>
            </div>
          </div>

          <div className="card pr-info">
            <div className="pr-section-title">Status history</div>
            <Timeline history={p.history ?? []} />
          </div>
        </aside>
      </div>

      {changesOpen && (
        <div className="modal-backdrop" onClick={() => setChangesOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Request changes</div>
              <button onClick={() => setChangesOpen(false)} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloseIcon color="var(--color-text-secondary)" />
              </button>
            </div>
            <div className="pr-dash-sub">{person.name} will be notified, fix what you list here and re-submit {p.label}.</div>
            <div>
              <div className="field-label">What needs to change? *</div>
              <textarea className="input" style={{ height: 96, padding: 10 }} autoFocus placeholder="e.g. Unpaid leave on 12 Oct is missing" value={changesNote} onChange={(e) => setChangesNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-outline" onClick={() => setChangesOpen(false)}>Cancel</button>
              <button className="btn-dark" disabled={!changesNote.trim()} onClick={sendChanges}>Request changes</button>
            </div>
          </div>
        </div>
      )}
    </>,
  )
}

function ChecksPanelCard({ checks }: { checks: ReturnType<typeof reviewChecks> }) {
  return (
    <div className="card pr-info pr-first">
      <ChecksPanel checks={checks} />
    </div>
  )
}

function Step({ n, done, title, body }: { n: number; done: boolean; title: string; body: string }) {
  return (
    <div className="pr-step-row">
      <span className={`pr-step-num${done ? ' done' : ''}`}>{done ? '✓' : n}</span>
      <span>
        <span className="pr-check-label">{title}</span>
        <span className="pr-check-detail">{body}</span>
      </span>
    </div>
  )
}

function KV({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="pr-kv">
      <span>{label}</span>
      <span className={`mono${strong ? ' strong' : ''}`} style={warn ? { color: 'var(--warn-fg)' } : undefined}>{value}</span>
    </div>
  )
}

function Lines({ title, rows, negative }: { title: string; rows: { label: string; amount: number }[]; negative?: boolean }) {
  const visible = rows.filter((r) => r.amount !== 0)
  if (visible.length === 0) return null
  return (
    <div>
      <div className="pr-lines-title"><span>{title}</span></div>
      {visible.map((r) => (
        <div key={r.label} className="pr-kv">
          <span>{r.label}</span>
          <span className="mono">{negative ? '−' : ''}{money(r.amount)}</span>
        </div>
      ))}
    </div>
  )
}

// Real, already-tracked time entries plus each week's approval status (same data the Timesheets page shows).
function TimesheetWeeks({ personId, weeks, entries }: { personId: string; weeks: string[]; entries: TimeEntry[] }) {
  const [openWeek, setOpenWeek] = useState<string | null>(null)
  const mine = entries.filter((e) => e.personId === personId)
  const totalMinutes = weeks.reduce((sum, w) => sum + minutesForPersonWeek(mine, personId, w), 0)
  const totalEntries = weeks.reduce((sum, w) => sum + entriesForPersonWeek(mine, personId, w).length, 0)
  return (
    <>
      <div className="pr-muted">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} · {formatMinutes(totalMinutes)} logged in this cycle</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weeks.map((w) => {
          const status = submissionFor(personId, w)?.status ?? 'Not Submitted'
          const weekEntries = entriesForPersonWeek(mine, personId, w)
          const open = openWeek === w
          return (
            <div key={w} className="pr-week">
              <button type="button" className="pr-week-head" onClick={() => setOpenWeek(open ? null : w)}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatWeekRange(w)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatMinutes(minutesForPersonWeek(mine, personId, w))}</span>
                  <span className={`badge ${status === 'Approved' ? 'b-pine' : status === 'Rejected' ? 'b-danger' : 'b-ember'}`} style={{ fontSize: 9 }}>{status}</span>
                </span>
              </button>
              {open && (
                <div className="pr-week-body">
                  {weekEntries.length === 0 ? (
                    <div className="pp-empty">Nothing logged this week.</div>
                  ) : (
                    weekEntries.map((entry) => (
                      <div key={entry.id} className="pr-line" style={{ padding: '6px 0' }}>
                        <span className="mono pr-muted" style={{ width: 62, flexShrink: 0 }}>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</span>
                        <span className="mono" style={{ fontSize: 12, width: 44, flexShrink: 0 }}>{formatMinutes(entry.minutes)}</span>
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
    </>
  )
}
