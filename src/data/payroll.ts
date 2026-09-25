import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, personById } from './people'
import { showToast } from './toast'

export type PayrollStatus = 'Timesheet pending' | 'Under review' | 'Approved' | 'Paid out'

export interface PayrollPeriod {
  id: string
  personId: string
  label: string // "September 2026"
  cycle: string // "Aug 25 – Sep 24"
  grossPay: number
  actualHours: number
  targetHours: number
  status: PayrollStatus
}

const STORAGE_KEY = 'typeb-hr.payroll.v1'

const seedPeriods: PayrollPeriod[] = [
  { id: 'pp1', personId: CURRENT_USER_ID, label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 4200, actualHours: 152, targetHours: 152, status: 'Under review' },
  { id: 'pp2', personId: CURRENT_USER_ID, label: 'August 2026', cycle: 'Jul 25 – Aug 24', grossPay: 4200, actualHours: 148, targetHours: 160, status: 'Approved' },
  { id: 'pp3', personId: CURRENT_USER_ID, label: 'July 2026', cycle: 'Jun 25 – Jul 24', grossPay: 4200, actualHours: 160, targetHours: 160, status: 'Paid out' },
  { id: 'pp4', personId: 'ajith-pathmanathan', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 879.65, actualHours: 175.55, targetHours: 152, status: 'Under review' },
  { id: 'pp5', personId: 'ashkar-haris', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 1600, actualHours: 0, targetHours: 160, status: 'Timesheet pending' },
  { id: 'pp6', personId: 'hashan-wijesinghe', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 2200, actualHours: 160, targetHours: 160, status: 'Approved' },
  { id: 'pp7', personId: 'charinda-dissanayake', label: 'September 2026', cycle: 'Aug 25 – Sep 24', grossPay: 640, actualHours: 0, targetHours: 160, status: 'Timesheet pending' },
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

export function submitPeriod(id: string) {
  setState(periods.map((p) => (p.id === id ? { ...p, status: 'Under review' } : p)))
  showToast('Submitted for payroll review', 'success')
}

export function reviewPeriod(id: string, status: 'Approved' | 'Rejected') {
  const period = periods.find((p) => p.id === id)
  if (status === 'Rejected') {
    setState(periods.map((p) => (p.id === id ? { ...p, status: 'Timesheet pending' } : p)))
  } else {
    setState(periods.map((p) => (p.id === id ? { ...p, status: 'Approved' } : p)))
  }
  const person = period ? personById(period.personId) : undefined
  showToast(`${person?.name ?? 'Payroll'} for ${period?.label ?? 'period'} ${status === 'Approved' ? 'approved' : 'sent back'}`, status === 'Approved' ? 'success' : 'danger')
}

export function statusBadgeClass(status: PayrollStatus): string {
  if (status === 'Approved' || status === 'Paid out') return 'b-pine'
  if (status === 'Under review') return 'b-ember'
  return 'b-neutral'
}
