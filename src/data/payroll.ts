import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, personById } from './people'
import { showToast } from './toast'

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
  showToast('Submitted for payroll review', 'success')
}

export function reviewPeriod(id: string, status: 'Approved' | 'Rejected') {
  const period = periods.find((p) => p.id === id)
  setState(periods.map((p) => (p.id === id ? appendHistory(p, status === 'Rejected' ? 'Timesheet pending' : 'Approved') : p)))
  const person = period ? personById(period.personId) : undefined
  showToast(`${person?.name ?? 'Payroll'} for ${period?.label ?? 'period'} ${status === 'Approved' ? 'approved' : 'sent back'}`, status === 'Approved' ? 'success' : 'danger')
}

// Flags a review for the employee/finance to fix something before it can be approved —
// distinct from "Rejected" (which just resets to Timesheet pending with no record of why).
export function requestUpdate(id: string, note: string) {
  const period = periods.find((p) => p.id === id)
  setState(periods.map((p) => (p.id === id ? appendHistory({ ...p, notes: note }, 'Update needed', note) : p)))
  const person = period ? personById(period.personId) : undefined
  showToast(`Requested an update for ${person?.name ?? 'this period'}`, 'danger')
}

export function markPaidOut(id: string, payDate: string) {
  const period = periods.find((p) => p.id === id)
  setState(periods.map((p) => (p.id === id ? appendHistory({ ...p, payDate }, 'Paid out') : p)))
  const person = period ? personById(period.personId) : undefined
  showToast(`${person?.name ?? 'Payroll'} marked as paid out`, 'success')
}

export function addAdjustment(id: string, adjustment: PayrollAdjustment) {
  setState(periods.map((p) => (p.id === id ? { ...p, adjustments: [...(p.adjustments ?? []), adjustment] } : p)))
  showToast('Adjustment added', 'success')
}

export function removeAdjustment(id: string, index: number) {
  setState(periods.map((p) => (p.id === id ? { ...p, adjustments: (p.adjustments ?? []).filter((_, i) => i !== index) } : p)))
}

// Reconciles leave hours against the employee's own figures before they submit —
// distinct from the Adjustments list, which is for one-off reimbursements.
export function setLeaveHours(id: string, ptoHours: number, unpaidHours: number) {
  setState(periods.map((p) => (p.id === id ? { ...p, ptoHours, unpaidHours } : p)))
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
  showToast('Timesheet confirmed — ready for payroll', 'success')
}

export function bulkApprove(ids: string[]) {
  const idSet = new Set(ids)
  setState(periods.map((p) => (idSet.has(p.id) ? appendHistory(p, 'Approved') : p)))
  showToast(`Approved ${ids.length} ${ids.length === 1 ? 'review' : 'reviews'}`, 'success')
}

export function statusBadgeClass(status: PayrollStatus): string {
  if (status === 'Approved' || status === 'Paid out') return 'b-pine'
  if (status === 'Under review') return 'b-ember'
  if (status === 'Update needed') return 'b-danger'
  return 'b-neutral'
}
