import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, personById } from './people'
import { showToast } from './toast'
import { supabase } from '../lib/supabaseClient'

export type PayrollStatus = 'Timesheet pending' | 'Under review' | 'Update needed' | 'Approved' | 'Paid out'

export interface PayrollHistoryEvent {
  status: PayrollStatus
  at: string // ISO timestamp
  note?: string
}

export interface PayrollEarnings {
  base: number
  incentives: number
  bonus: number
}

export interface PayrollDeductions {
  providentFund: number
  salaryAdvance: number
  other: number
}

export interface PayrollAdjustment {
  type: 'Equipment' | 'Software' | 'Travel' | 'Other'
  description: string
  date: string // YYYY-MM-DD
  amount: number
}

export interface PayrollPeriod {
  id: string
  personId: string
  label: string // "September 2026"
  cycle: string // "Aug 25 – Sep 24"
  cycleStart?: string // YYYY-MM-DD — bounds used to pull in real timesheet entries for this period
  cycleEnd?: string // YYYY-MM-DD
  grossPay: number
  actualHours: number
  targetHours: number
  status: PayrollStatus
  payDate?: string // YYYY-MM-DD — when it was/will be paid out, shown on the payslip
  earnings?: PayrollEarnings
  deductions?: PayrollDeductions
  adjustments?: PayrollAdjustment[]
  notes?: string // admin-facing note, e.g. the reason an update was requested
  history?: PayrollHistoryEvent[]
  workingDays?: number
  holidays?: number
  eligibleDays?: number // paid days once prorated for start/end-of-cycle joiners/leavers
  ptoHours?: number // reconciled from approved leave, editable by the employee before submitting
  unpaidHours?: number // UPTO — unpaid time off
  timesheetConfirmed?: boolean
  timesheetConfirmedAt?: string // ISO timestamp
  timesheetConfirmedBy?: string // name — set when an admin confirms on the employee's behalf
  invoiceNumber?: string
  invoiceAmount?: number
  invoiceIssuedAt?: string // YYYY-MM-DD
  invoicePaidAt?: string // YYYY-MM-DD
}

// Falls back to grossPay as a single line when a period has no earnings breakdown on file.
export function earningsTotal(p: PayrollPeriod): number {
  if (!p.earnings) return p.grossPay
  return p.earnings.base + p.earnings.incentives + p.earnings.bonus
}

export function deductionsTotal(p: PayrollPeriod): number {
  if (!p.deductions) return 0
  return p.deductions.providentFund + p.deductions.salaryAdvance + p.deductions.other
}

export function adjustmentsTotal(p: PayrollPeriod): number {
  return (p.adjustments ?? []).reduce((sum, a) => sum + a.amount, 0)
}

export function netPay(p: PayrollPeriod): number {
  return earningsTotal(p) - deductionsTotal(p) + adjustmentsTotal(p)
}

const STORAGE_KEY = 'typeb-hr.payroll.v1'

const seedPeriods: PayrollPeriod[] = [
  {
    id: 'pp0',
    personId: CURRENT_USER_ID,
    label: 'October 2026',
    cycle: 'Sep 25 – Oct 24',
    cycleStart: '2026-09-25',
    cycleEnd: '2026-10-24',
    grossPay: 4200,
    actualHours: 24,
    targetHours: 152,
    status: 'Timesheet pending',
    workingDays: 22,
    holidays: 1,
    eligibleDays: 22,
    ptoHours: 0,
    unpaidHours: 0,
    timesheetConfirmed: false,
    earnings: { base: 3800, incentives: 250, bonus: 150 },
    deductions: { providentFund: 200, salaryAdvance: 0, other: 0 },
    adjustments: [],
  },
  {
    id: 'pp1',
    personId: CURRENT_USER_ID,
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    cycleStart: '2026-08-25',
    cycleEnd: '2026-09-24',
    grossPay: 4200,
    actualHours: 152,
    targetHours: 152,
    status: 'Under review',
    workingDays: 21,
    holidays: 2,
    eligibleDays: 21,
    ptoHours: 0,
    unpaidHours: 0,
    timesheetConfirmed: true,
    timesheetConfirmedAt: '2026-09-25T09:10:00.000Z',
    timesheetConfirmedBy: 'Pranath',
    earnings: { base: 3800, incentives: 250, bonus: 150 },
    deductions: { providentFund: 200, salaryAdvance: 0, other: 0 },
    adjustments: [
      { type: 'Equipment', description: 'Monitor reimbursement', date: '2026-09-08', amount: 75 },
      { type: 'Software', description: 'Annual license reimbursement', date: '2026-09-10', amount: 25 },
    ],
  },
  {
    id: 'pp2',
    personId: CURRENT_USER_ID,
    label: 'August 2026',
    cycle: 'Jul 25 – Aug 24',
    cycleStart: '2026-07-25',
    cycleEnd: '2026-08-24',
    grossPay: 4200,
    actualHours: 148,
    targetHours: 160,
    status: 'Approved',
    payDate: '2026-08-30',
    workingDays: 21,
    holidays: 0,
    eligibleDays: 21,
    ptoHours: 8,
    unpaidHours: 0,
    timesheetConfirmed: true,
    timesheetConfirmedAt: '2026-08-25T09:00:00.000Z',
    timesheetConfirmedBy: 'Pranath',
    invoiceNumber: 'INV-2026-08-001',
    invoiceAmount: 4200,
    invoiceIssuedAt: '2026-08-25',
    earnings: { base: 3800, incentives: 250, bonus: 150 },
    deductions: { providentFund: 200, salaryAdvance: 0, other: 0 },
    adjustments: [],
  },
  {
    id: 'pp3',
    personId: CURRENT_USER_ID,
    label: 'July 2026',
    cycle: 'Jun 25 – Jul 24',
    cycleStart: '2026-06-25',
    cycleEnd: '2026-07-24',
    grossPay: 4200,
    actualHours: 160,
    targetHours: 160,
    status: 'Paid out',
    payDate: '2026-07-31',
    workingDays: 22,
    holidays: 1,
    eligibleDays: 22,
    ptoHours: 0,
    unpaidHours: 0,
    timesheetConfirmed: true,
    timesheetConfirmedAt: '2026-06-25T09:00:00.000Z',
    timesheetConfirmedBy: 'Pranath',
    invoiceNumber: 'INV-2026-07-001',
    invoiceAmount: 4200,
    invoiceIssuedAt: '2026-06-25',
    invoicePaidAt: '2026-07-31',
    earnings: { base: 3800, incentives: 250, bonus: 150 },
    deductions: { providentFund: 200, salaryAdvance: 500, other: 0 },
    adjustments: [{ type: 'Travel', description: 'Client site visit reimbursement', date: '2026-07-14', amount: 60 }],
  },
  { id: 'pp4', personId: 'ajith-pathmanathan', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 879.65, actualHours: 175.55, targetHours: 152, status: 'Under review' },
  { id: 'pp5', personId: 'ashkar-haris', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 1600, actualHours: 0, targetHours: 160, status: 'Timesheet pending' },
  {
    id: 'pp6',
    personId: 'hashan-wijesinghe',
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    grossPay: 2200,
    actualHours: 160,
    targetHours: 160,
    status: 'Approved',
    payDate: '2026-09-30',
    earnings: { base: 2000, incentives: 150, bonus: 50 },
    deductions: { providentFund: 100, salaryAdvance: 0, other: 0 },
    adjustments: [{ type: 'Equipment', description: 'Keyboard reimbursement', date: '2026-09-05', amount: 30 }],
  },
  { id: 'pp7', personId: 'charinda-dissanayake', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 640, actualHours: 0, targetHours: 160, status: 'Timesheet pending' },
  {
    id: 'pp8',
    personId: 'devon-marsh',
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    grossPay: 5200,
    actualHours: 160,
    targetHours: 160,
    status: 'Approved',
    payDate: '2026-09-30',
    earnings: { base: 4800, incentives: 300, bonus: 100 },
    deductions: { providentFund: 250, salaryAdvance: 0, other: 0 },
    adjustments: [],
  },
  { id: 'pp9', personId: 'isabela-costa', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 3100, actualHours: 142, targetHours: 160, status: 'Under review' },
  {
    id: 'pp10',
    personId: 'kwame-mensah',
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    grossPay: 2900,
    actualHours: 176,
    targetHours: 160,
    status: 'Paid out',
    payDate: '2026-09-30',
    earnings: { base: 2700, incentives: 150, bonus: 50 },
    deductions: { providentFund: 135, salaryAdvance: 0, other: 0 },
    adjustments: [],
  },
  { id: 'pp11', personId: 'nadia-rahman', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 2600, actualHours: 0, targetHours: 160, status: 'Timesheet pending' },
  { id: 'pp12', personId: 'felix-huber', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 3400, actualHours: 90, targetHours: 160, status: 'Under review' },
  {
    id: 'pp13',
    personId: 'batool-abdullah',
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    grossPay: 2650,
    actualHours: 150,
    targetHours: 160,
    status: 'Approved',
    payDate: '2026-09-30',
    earnings: { base: 2400, incentives: 200, bonus: 50 },
    deductions: { providentFund: 120, salaryAdvance: 0, other: 0 },
    adjustments: [],
  },
  {
    id: 'pp14',
    personId: 'dinusha-randika',
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    grossPay: 2100,
    actualHours: 160,
    targetHours: 160,
    status: 'Paid out',
    payDate: '2026-09-30',
    earnings: { base: 1950, incentives: 100, bonus: 50 },
    deductions: { providentFund: 100, salaryAdvance: 0, other: 0 },
    adjustments: [],
  },
  { id: 'pp15', personId: 'priya-nair', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 2300, actualHours: 40, targetHours: 160, status: 'Timesheet pending' },
  { id: 'pp16', personId: 'chamika-wijeratne', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 2500, actualHours: 155, targetHours: 160, status: 'Under review' },
  {
    id: 'pp17',
    personId: 'yuki-tanaka',
    label: 'September 2026',
    cycle: 'Aug 25 – Sep 24',
    grossPay: 3000,
    actualHours: 170,
    targetHours: 160,
    status: 'Approved',
    payDate: '2026-09-30',
    earnings: { base: 2750, incentives: 200, bonus: 50 },
    deductions: { providentFund: 137, salaryAdvance: 0, other: 0 },
    adjustments: [{ type: 'Software', description: 'IDE license reimbursement', date: '2026-09-12', amount: 20 }],
  },
]

function load(): PayrollPeriod[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PayrollPeriod[]) : seedPeriods
  } catch {
    return seedPeriods
  }
}

function save(v: PayrollPeriod[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    // ignore
  }
}

let listeners: Array<(v: PayrollPeriod[]) => void> = []
let periods: PayrollPeriod[] = load()

function setState(next: PayrollPeriod[]) {
  periods = next
  save(periods)
  listeners.forEach((l) => l(periods))
}

interface PayrollPeriodRow {
  id: string
  person_id: string
  label: string
  cycle: string
  cycle_start: string | null
  cycle_end: string | null
  gross_pay: number
  actual_hours: number
  target_hours: number
  status: PayrollStatus
  pay_date: string | null
  earnings: PayrollEarnings | null
  deductions: PayrollDeductions | null
  adjustments: PayrollAdjustment[] | null
  notes: string | null
  history: PayrollHistoryEvent[] | null
  working_days: number | null
  holidays: number | null
  eligible_days: number | null
  pto_hours: number | null
  unpaid_hours: number | null
  timesheet_confirmed: boolean | null
  timesheet_confirmed_at: string | null
  timesheet_confirmed_by: string | null
  invoice_number: string | null
  invoice_amount: number | null
  invoice_issued_at: string | null
  invoice_paid_at: string | null
}

function payrollPeriodFromRow(row: PayrollPeriodRow): PayrollPeriod {
  return {
    id: row.id,
    personId: row.person_id,
    label: row.label,
    cycle: row.cycle,
    cycleStart: row.cycle_start ?? undefined,
    cycleEnd: row.cycle_end ?? undefined,
    grossPay: row.gross_pay,
    actualHours: row.actual_hours,
    targetHours: row.target_hours,
    status: row.status,
    payDate: row.pay_date ?? undefined,
    earnings: row.earnings ?? undefined,
    deductions: row.deductions ?? undefined,
    adjustments: row.adjustments ?? undefined,
    notes: row.notes ?? undefined,
    history: row.history ?? undefined,
    workingDays: row.working_days ?? undefined,
    holidays: row.holidays ?? undefined,
    eligibleDays: row.eligible_days ?? undefined,
    ptoHours: row.pto_hours ?? undefined,
    unpaidHours: row.unpaid_hours ?? undefined,
    timesheetConfirmed: row.timesheet_confirmed ?? undefined,
    timesheetConfirmedAt: row.timesheet_confirmed_at ?? undefined,
    timesheetConfirmedBy: row.timesheet_confirmed_by ?? undefined,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceAmount: row.invoice_amount ?? undefined,
    invoiceIssuedAt: row.invoice_issued_at ?? undefined,
    invoicePaidAt: row.invoice_paid_at ?? undefined,
  }
}

function payrollPeriodToRow(p: PayrollPeriod): PayrollPeriodRow {
  return {
    id: p.id,
    person_id: p.personId,
    label: p.label,
    cycle: p.cycle,
    cycle_start: p.cycleStart ?? null,
    cycle_end: p.cycleEnd ?? null,
    gross_pay: p.grossPay,
    actual_hours: p.actualHours,
    target_hours: p.targetHours,
    status: p.status,
    pay_date: p.payDate ?? null,
    earnings: p.earnings ?? null,
    deductions: p.deductions ?? null,
    adjustments: p.adjustments ?? null,
    notes: p.notes ?? null,
    history: p.history ?? null,
    working_days: p.workingDays ?? null,
    holidays: p.holidays ?? null,
    eligible_days: p.eligibleDays ?? null,
    pto_hours: p.ptoHours ?? null,
    unpaid_hours: p.unpaidHours ?? null,
    timesheet_confirmed: p.timesheetConfirmed ?? null,
    timesheet_confirmed_at: p.timesheetConfirmedAt ?? null,
    timesheet_confirmed_by: p.timesheetConfirmedBy ?? null,
    invoice_number: p.invoiceNumber ?? null,
    invoice_amount: p.invoiceAmount ?? null,
    invoice_issued_at: p.invoiceIssuedAt ?? null,
    invoice_paid_at: p.invoicePaidAt ?? null,
  }
}

async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('payroll_periods').select('*')
  if (error || !data) return
  setState(data.map((row) => payrollPeriodFromRow(row as PayrollPeriodRow)))
}

hydrateFromSupabase()

function syncUpsert(period: PayrollPeriod) {
  supabase
    .from('payroll_periods')
    .upsert(payrollPeriodToRow(period))
    .then(({ error }) => {
      if (error) showToast('Could not sync payroll period to the server', 'danger')
    })
}

function syncUpsertMany(list: PayrollPeriod[]) {
  if (list.length === 0) return
  supabase
    .from('payroll_periods')
    .upsert(list.map(payrollPeriodToRow))
    .then(({ error }) => {
      if (error) showToast('Could not sync payroll periods to the server', 'danger')
    })
}

export function usePayrollPeriods(): PayrollPeriod[] {
  const [value, setValue] = useState(periods)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

function appendHistory(p: PayrollPeriod, status: PayrollStatus, note?: string): PayrollPeriod {
  const event: PayrollHistoryEvent = { status, at: new Date().toISOString(), note }
  return { ...p, status, history: [...(p.history ?? []), event] }
}

export function submitPeriod(id: string) {
  setState(periods.map((p) => (p.id === id ? appendHistory(p, 'Under review') : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  showToast('Submitted for payroll review', 'success')
}

export function reviewPeriod(id: string, status: 'Approved' | 'Rejected') {
  const period = periods.find((p) => p.id === id)
  setState(periods.map((p) => (p.id === id ? appendHistory(p, status === 'Rejected' ? 'Timesheet pending' : 'Approved') : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  const person = period ? personById(period.personId) : undefined
  showToast(`${person?.name ?? 'Payroll'} for ${period?.label ?? 'period'} ${status === 'Approved' ? 'approved' : 'sent back'}`, status === 'Approved' ? 'success' : 'danger')
}

// Flags a review for the employee/finance to fix something before it can be approved —
// distinct from "Rejected" (which just resets to Timesheet pending with no record of why).
export function requestUpdate(id: string, note: string) {
  const period = periods.find((p) => p.id === id)
  setState(periods.map((p) => (p.id === id ? appendHistory({ ...p, notes: note }, 'Update needed', note) : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  const person = period ? personById(period.personId) : undefined
  showToast(`Requested an update for ${person?.name ?? 'this period'}`, 'danger')
}

export function markPaidOut(id: string, payDate: string) {
  const period = periods.find((p) => p.id === id)
  setState(periods.map((p) => (p.id === id ? appendHistory({ ...p, payDate }, 'Paid out') : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  const person = period ? personById(period.personId) : undefined
  showToast(`${person?.name ?? 'Payroll'} marked as paid out`, 'success')
}

export function addAdjustment(id: string, adjustment: PayrollAdjustment) {
  setState(periods.map((p) => (p.id === id ? { ...p, adjustments: [...(p.adjustments ?? []), adjustment] } : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  showToast('Adjustment added', 'success')
}

export function removeAdjustment(id: string, index: number) {
  setState(periods.map((p) => (p.id === id ? { ...p, adjustments: (p.adjustments ?? []).filter((_, i) => i !== index) } : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
}

// Reconciles leave hours against the employee's own figures before they submit —
// distinct from the Adjustments list, which is for one-off reimbursements.
export function setLeaveHours(id: string, ptoHours: number, unpaidHours: number) {
  setState(periods.map((p) => (p.id === id ? { ...p, ptoHours, unpaidHours } : p)))
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  showToast('Leave hours saved', 'success')
}

// A separate step from submitting: confirms the underlying timesheet entries are
// correct and final, which gates the Submit/Re-submit payroll action.
export function confirmTimesheet(id: string, confirmedBy: string) {
  setState(
    periods.map((p) =>
      p.id === id ? { ...p, timesheetConfirmed: true, timesheetConfirmedAt: new Date().toISOString(), timesheetConfirmedBy: confirmedBy } : p,
    ),
  )
  const updated = periods.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
  showToast('Timesheet confirmed — ready for payroll', 'success')
}

export function bulkApprove(ids: string[]) {
  const idSet = new Set(ids)
  setState(periods.map((p) => (idSet.has(p.id) ? appendHistory(p, 'Approved') : p)))
  syncUpsertMany(periods.filter((p) => idSet.has(p.id)))
  showToast(`Approved ${ids.length} ${ids.length === 1 ? 'review' : 'reviews'}`, 'success')
}

export function statusBadgeClass(status: PayrollStatus): string {
  if (status === 'Approved' || status === 'Paid out') return 'b-pine'
  if (status === 'Under review') return 'b-ember'
  if (status === 'Update needed') return 'b-danger'
  return 'b-neutral'
}
