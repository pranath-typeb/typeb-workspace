import type { PayrollPeriod } from './payroll'
import { adjustmentsTotal, earningsTotal, netPay } from './payroll'
import { staticEvents, type CalendarEvent } from './calendarEvents'
import { submissionFor, todayLocal, weeksOverlapping } from './timeEntries'
import type { Person } from './people'

// Everything the payroll pages explain — what stage a period is in and what happens next, whether the
// numbers reconcile, which checks still need attention, and how many working days each country has.

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => new Date(`${s}T00:00:00`)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// A pay cycle named "October 2026" runs 25 Sep – 24 Oct. Uses the stored bounds when the period has them.
export function cycleBounds(p: Pick<PayrollPeriod, 'label' | 'cycleStart' | 'cycleEnd'>): { start: string; end: string } {
  if (p.cycleStart && p.cycleEnd) return { start: p.cycleStart, end: p.cycleEnd }
  const [monthName, yearStr] = p.label.split(' ')
  const m = MONTHS.indexOf(monthName)
  const y = Number(yearStr)
  if (m < 0 || !y) return { start: todayLocal(), end: todayLocal() }
  return { start: ymd(new Date(y, m - 1, 25)), end: ymd(new Date(y, m, 24)) }
}

// ---- stages ------------------------------------------------------------------------------------------

export type StageKey = 'awaiting-confirmation' | 'awaiting-approval' | 'ready' | 'under-review' | 'update-needed' | 'approved' | 'paid'
export type Tone = 'purple' | 'dark' | 'neutral' | 'amber' | 'red' | 'green' | 'teal'

export interface Stage {
  key: StageKey
  label: string
  tone: Tone
  step: 0 | 1 | 2 | 3 // Timesheet · Review · Approved · Paid out
}

export const PIPELINE = ['Timesheet', 'Review', 'Approved', 'Paid out'] as const

const STAGES: Record<StageKey, Stage> = {
  'awaiting-confirmation': { key: 'awaiting-confirmation', label: 'Awaiting confirmation', tone: 'purple', step: 0 },
  'awaiting-approval': { key: 'awaiting-approval', label: 'Awaiting approval', tone: 'dark', step: 0 },
  ready: { key: 'ready', label: 'Ready to submit', tone: 'teal', step: 0 },
  'under-review': { key: 'under-review', label: 'Under review', tone: 'amber', step: 1 },
  'update-needed': { key: 'update-needed', label: 'Update needed', tone: 'red', step: 1 },
  approved: { key: 'approved', label: 'Approved', tone: 'green', step: 2 },
  paid: { key: 'paid', label: 'Paid out', tone: 'green', step: 3 },
}

export function weeksProgress(p: PayrollPeriod): { approved: number; total: number } {
  const { start, end } = cycleBounds(p)
  const weeks = weeksOverlapping(start, end)
  return { approved: weeks.filter((w) => submissionFor(p.personId, w)?.status === 'Approved').length, total: weeks.length }
}

export function stageOf(p: PayrollPeriod): Stage {
  switch (p.status) {
    case 'Paid out':
      return STAGES.paid
    case 'Approved':
      return STAGES.approved
    case 'Under review':
      return STAGES['under-review']
    case 'Update needed':
      return STAGES['update-needed']
    default: {
      if (!p.timesheetConfirmed) return STAGES['awaiting-confirmation']
      const w = weeksProgress(p)
      return w.total > 0 && w.approved < w.total ? STAGES['awaiting-approval'] : STAGES.ready
    }
  }
}

export function isOverdue(p: PayrollPeriod, today = todayLocal()): boolean {
  if (p.status !== 'Timesheet pending' && p.status !== 'Update needed') return false
  return cycleBounds(p).end < today
}

// One plain sentence: what is happening, and what (if anything) the reader should do next.
export function nextStep(p: PayrollPeriod, as: 'self' | 'admin'): { title: string; body: string } {
  const stage = stageOf(p)
  const w = weeksProgress(p)
  const overdue = isOverdue(p)
  const money = `$${netPay(p).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  const self: Record<StageKey, { title: string; body: string }> = {
    'awaiting-confirmation': {
      title: overdue ? 'Your timesheet needs confirming — this is overdue' : 'Confirm your timesheet',
      body: 'Check your logged hours and leave below, then confirm. That lets your payroll go to finance.',
    },
    'awaiting-approval': {
      title: 'Waiting for your weekly timesheets to be approved',
      body: `${w.approved} of ${w.total} weeks are approved. Once they all are, you can submit your payroll.`,
    },
    ready: { title: 'Ready to submit', body: 'Everything is confirmed and approved. Submit your payroll so finance can review it.' },
    'under-review': { title: 'Finance is reviewing your payroll', body: 'Nothing to do right now. You will be notified if anything needs changing.' },
    'update-needed': { title: 'Finance asked for a change', body: p.notes || 'Update the figures they flagged, then re-submit.' },
    approved: { title: 'Approved', body: `${money} is approved and will be paid out on the next payroll run.` },
    paid: { title: 'Paid out', body: p.payDate ? `${money} was paid on ${fmtLong(p.payDate)}.` : `${money} has been paid.` },
  }
  const admin: Record<StageKey, { title: string; body: string }> = {
    'awaiting-confirmation': { title: 'Waiting on the employee', body: 'They have not confirmed their timesheet yet. You can nudge them or confirm on their behalf.' },
    'awaiting-approval': { title: 'Waiting on timesheet approvals', body: `${w.approved} of ${w.total} weekly timesheets are approved.` },
    ready: { title: 'Waiting for the employee to submit', body: 'Timesheet is confirmed and approved. It will appear for review once submitted.' },
    'under-review': { title: 'Your decision', body: 'Check the figures below, then approve or request changes.' },
    'update-needed': { title: 'Waiting for the employee to fix and re-submit', body: p.notes ? `You asked: “${p.notes}”` : 'A change was requested.' },
    approved: { title: 'Approved — ready to pay out', body: 'Mark it as paid out, or use Run payroll on the dashboard to pay everyone approved.' },
    paid: { title: 'Paid out', body: p.payDate ? `Paid on ${fmtLong(p.payDate)}.` : 'Paid.' },
  }
  return (as === 'self' ? self : admin)[stage.key]
}

export function fmtLong(iso: string): string {
  return parse(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ---- hours -----------------------------------------------------------------------------------------

export function hoursState(p: PayrollPeriod): { behindPct: number; label: string; tone: 'ok' | 'warn' } {
  if (p.targetHours <= 0) return { behindPct: 0, label: 'No target', tone: 'ok' }
  const behindPct = Math.round((1 - p.actualHours / p.targetHours) * 100)
  if (behindPct > 0) return { behindPct, label: `${behindPct}% behind`, tone: 'warn' }
  if (behindPct < 0) return { behindPct, label: `${Math.abs(behindPct)}% over`, tone: 'ok' }
  return { behindPct, label: 'On target', tone: 'ok' }
}

// ---- reconciliation & checks -----------------------------------------------------------------------

export interface Reconciliation {
  targetHours: number
  timesheetHours: number
  hoursDiff: number
  invoiceAmount: number | null
  gross: number
  amountDiff: number | null
  adjustments: number
  residual: number | null
  reconciled: boolean
}

export function reconcile(p: PayrollPeriod): Reconciliation {
  const gross = earningsTotal(p)
  const adjustments = adjustmentsTotal(p)
  const invoiceAmount = p.invoiceAmount ?? null
  const amountDiff = invoiceAmount === null ? null : round2(invoiceAmount - gross)
  const residual = amountDiff === null ? null : round2(amountDiff - adjustments)
  return {
    targetHours: p.targetHours,
    timesheetHours: p.actualHours,
    hoursDiff: round2(p.actualHours - p.targetHours),
    invoiceAmount,
    gross,
    amountDiff,
    adjustments,
    residual,
    reconciled: residual === null ? true : Math.abs(residual) < 0.01,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface Check {
  key: string
  label: string
  state: 'ok' | 'warn' | 'todo'
  detail: string
}

// The review checklist: each item is either fine, worth a look (warn), or not done yet (todo).
export function reviewChecks(p: PayrollPeriod): Check[] {
  const w = weeksProgress(p)
  const r = reconcile(p)
  const hs = hoursState(p)
  const checks: Check[] = [
    {
      key: 'confirmed',
      label: 'Timesheet confirmed',
      state: p.timesheetConfirmed ? 'ok' : 'todo',
      detail: p.timesheetConfirmed ? `Confirmed${p.timesheetConfirmedBy ? ` by ${p.timesheetConfirmedBy}` : ''}` : 'The employee has not confirmed it yet',
    },
    {
      key: 'weeks',
      label: 'Weekly timesheets approved',
      state: w.total === 0 || w.approved === w.total ? 'ok' : 'warn',
      detail: w.total === 0 ? 'No weekly timesheets in this cycle' : `${w.approved} of ${w.total} weeks approved`,
    },
    {
      key: 'hours',
      label: 'Hours match the target',
      state: hs.tone === 'ok' ? 'ok' : 'warn',
      detail: `${p.actualHours}h logged against ${p.targetHours}h — ${hs.label.toLowerCase()}`,
    },
    {
      key: 'leave',
      label: 'Leave reconciled',
      state: p.ptoHours !== undefined || p.unpaidHours !== undefined ? 'ok' : 'todo',
      detail: `${p.ptoHours ?? 0}h PTO · ${p.unpaidHours ?? 0}h unpaid`,
    },
    {
      key: 'invoice',
      label: 'Invoice matches pay',
      state: r.invoiceAmount === null ? 'todo' : r.reconciled ? 'ok' : 'warn',
      detail: r.invoiceAmount === null ? 'No invoice yet' : r.reconciled ? 'Invoice, pay and adjustments add up' : `Residual of $${Math.abs(r.residual ?? 0).toFixed(2)} unexplained`,
    },
  ]
  return checks
}

// ---- working days & holidays per country ---------------------------------------------------------------

export interface HolidayRow {
  date: string
  title: string
  counted: boolean // false when it falls on a weekend (no working day lost)
}

export interface JurisdictionBreakdown {
  name: string
  employees: number
  workingDays: number
  holidays: HolidayRow[]
  weekendDays: number
  calendarDays: number
}

const ALIASES: Record<string, string> = { usa: 'united states', us: 'united states', uk: 'united kingdom', uae: 'united arab emirates' }
const normCountry = (s: string) => {
  const cleaned = s.replace(/[^\p{L}\s]/gu, '').trim().toLowerCase()
  return ALIASES[cleaned] ?? cleaned
}

export function cycleBreakdown(
  cyclePeriods: PayrollPeriod[],
  people: Pick<Person, 'id' | 'jurisdiction'>[],
  events: CalendarEvent[] = staticEvents,
): JurisdictionBreakdown[] {
  if (cyclePeriods.length === 0) return []
  const { start, end } = cycleBounds(cyclePeriods[0])
  const days: string[] = []
  for (let d = parse(start); ymd(d) <= end; d.setDate(d.getDate() + 1)) days.push(ymd(d))
  const weekend = days.filter((d) => [0, 6].includes(parse(d).getDay()))
  const weekdays = days.length - weekend.length

  const countByCountry = new Map<string, number>()
  for (const p of cyclePeriods) {
    const name = people.find((x) => x.id === p.personId)?.jurisdiction ?? 'No jurisdiction'
    countByCountry.set(name, (countByCountry.get(name) ?? 0) + 1)
  }
  const holidayEvents = events.filter((e) => e.category === 'Public Holiday' && e.date >= start && e.date <= end)

  return Array.from(countByCountry.entries())
    .map(([name, employees]) => {
      const mine = name === 'No jurisdiction' ? [] : holidayEvents.filter((e) => normCountry(e.detail ?? '') === normCountry(name))
      const rows: HolidayRow[] = mine
        .map((e) => ({ date: e.date, title: e.title, counted: ![0, 6].includes(parse(e.date).getDay()) }))
        .sort((a, b) => a.date.localeCompare(b.date))
      return {
        name,
        employees,
        workingDays: weekdays - rows.filter((r) => r.counted).length,
        holidays: rows,
        weekendDays: weekend.length,
        calendarDays: days.length,
      }
    })
    .sort((a, b) => b.employees - a.employees)
}

// ---- cycles ----------------------------------------------------------------------------------------

export interface CycleInfo {
  cycle: string // "Sep 25 – Oct 24"
  label: string // "October 2026"
  year: number
  start: string
  end: string
  headcount: number
}

export function cyclesFrom(periods: PayrollPeriod[]): CycleInfo[] {
  const map = new Map<string, CycleInfo>()
  for (const p of periods) {
    const hit = map.get(p.cycle)
    if (hit) {
      hit.headcount += 1
      continue
    }
    const b = cycleBounds(p)
    map.set(p.cycle, { cycle: p.cycle, label: p.label, year: Number(p.label.split(' ')[1]) || parse(b.end).getFullYear(), start: b.start, end: b.end, headcount: 1 })
  }
  return Array.from(map.values()).sort((a, b) => b.end.localeCompare(a.end))
}

// ---- figures for the Reviews columns ------------------------------------------------------------------

export interface ReviewFigures {
  payoutPct: number
  budgetSalary: number
  salaryPayout: number
  otherPayout: number
  totalPayout: number
  invoiceAmount: number | null
  invoiceDiff: number | null
  allocatedHours: number | null
}

import type { Assignment } from './staffing'

export function reviewFigures(p: PayrollPeriod, assignments: Assignment[]): ReviewFigures {
  const wd = p.workingDays ?? 0
  const eligible = p.eligibleDays ?? wd
  const payoutPct = wd > 0 ? Math.round((eligible / wd) * 100) : 100
  const salaryPayout = earningsTotal(p)
  const otherPayout = adjustmentsTotal(p)
  const totalPayout = round2(salaryPayout + otherPayout)
  const budgetSalary = payoutPct > 0 && payoutPct < 100 ? round2(salaryPayout / (payoutPct / 100)) : (p.earnings?.base ?? salaryPayout)
  const { start, end } = cycleBounds(p)
  const weeks = Math.max((parse(end).getTime() - parse(start).getTime()) / 86400000 / 7, 0)
  const mine = assignments.filter((a) => a.personId === p.personId)
  const allocatedHours = mine.length ? Math.round(mine.reduce((s, a) => s + a.hoursPerWeek, 0) * weeks * 100) / 100 : null
  const invoiceAmount = p.invoiceAmount ?? null
  return {
    payoutPct,
    budgetSalary,
    salaryPayout,
    otherPayout,
    totalPayout,
    invoiceAmount,
    invoiceDiff: invoiceAmount === null ? null : round2(invoiceAmount - totalPayout),
    allocatedHours,
  }
}
