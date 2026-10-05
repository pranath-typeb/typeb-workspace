import { useEffect, useState } from 'react'
import { showToast } from './toast'
import { supabase } from '../lib/supabaseClient'

export type LeaveType = 'PTO' | 'Sick Leave' | 'Unpaid Time Off' | 'Accrued Public Holiday' | 'LIEU'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected'

export interface LeaveRequest {
  id: string
  type: LeaveType
  date: string
  status: LeaveStatus
  requestedBy: string
  days: number
}

const STORAGE_KEY = 'typeb-hr.leave-requests.v1'

const seedRequests: LeaveRequest[] = [
  { id: 'l1', type: 'Unpaid Time Off', date: '14-Sep-2026', status: 'Pending', requestedBy: 'Ridhwan Rahman', days: 1 },
  { id: 'l2', type: 'PTO', date: '10-Oct-2026', status: 'Approved', requestedBy: 'Sarah Malik', days: 2 },
  { id: 'l3', type: 'Sick Leave', date: '01-Nov-2026', status: 'Rejected', requestedBy: 'Ali Khan', days: 1 },
  { id: 'l4', type: 'Accrued Public Holiday', date: '15-Nov-2026', status: 'Pending', requestedBy: 'Fatima Hussain', days: 1 },
  { id: 'l5', type: 'Unpaid Time Off', date: '20-Dec-2026', status: 'Approved', requestedBy: 'Omar Farooq', days: 3 },
  { id: 'l6', type: 'Unpaid Time Off', date: '05-Jan-2027', status: 'Pending', requestedBy: 'Zeeshan Ali', days: 1 },
  { id: 'l7', type: 'LIEU', date: '26-Sep-2026', status: 'Pending', requestedBy: 'Priya Nair', days: 1 },
  { id: 'l8', type: 'PTO', date: '30-Sep-2026', status: 'Approved', requestedBy: 'Marcus Chen', days: 5 },
  { id: 'l9', type: 'Sick Leave', date: '22-Sep-2026', status: 'Approved', requestedBy: 'Yuki Tanaka', days: 2 },
  { id: 'l10', type: 'PTO', date: '18-Oct-2026', status: 'Rejected', requestedBy: 'Layla Haddad', days: 4 },
  { id: 'l11', type: 'Accrued Public Holiday', date: '02-Nov-2026', status: 'Approved', requestedBy: 'Amina Diallo', days: 1 },
  { id: 'l12', type: 'Unpaid Time Off', date: '12-Dec-2026', status: 'Pending', requestedBy: 'Oliver Bennett', days: 2 },
  { id: 'l13', type: 'LIEU', date: '08-Jan-2027', status: 'Approved', requestedBy: 'Sara Kowalski', days: 1 },
  { id: 'l14', type: 'PTO', date: '20-Jan-2027', status: 'Pending', requestedBy: 'Tomás Rivera', days: 3 },
  { id: 'l15', type: 'PTO', date: '24-Oct-2026', status: 'Approved', requestedBy: 'Pranath', days: 2 },
  { id: 'l16', type: 'LIEU', date: '02-Oct-2026', status: 'Pending', requestedBy: 'Pranath', days: 1 },
  { id: 'l17', type: 'PTO', date: '15-Oct-2026', status: 'Approved', requestedBy: 'Devon Marsh', days: 3 },
  { id: 'l18', type: 'Sick Leave', date: '03-Nov-2026', status: 'Pending', requestedBy: 'Isabela Costa', days: 1 },
  { id: 'l19', type: 'Unpaid Time Off', date: '20-Nov-2026', status: 'Rejected', requestedBy: 'Kwame Mensah', days: 2 },
  { id: 'l20', type: 'LIEU', date: '28-Sep-2026', status: 'Approved', requestedBy: 'Nadia Rahman', days: 1 },
  { id: 'l21', type: 'PTO', date: '01-Dec-2026', status: 'Pending', requestedBy: 'Felix Huber', days: 4 },
  { id: 'l22', type: 'Accrued Public Holiday', date: '25-Dec-2026', status: 'Approved', requestedBy: 'Meera Pillai', days: 1 },
  { id: 'l23', type: 'PTO', date: '10-Jan-2027', status: 'Pending', requestedBy: 'Diego Alvarez', days: 2 },
  { id: 'l24', type: 'Sick Leave', date: '14-Oct-2026', status: 'Approved', requestedBy: 'Grace Kim', days: 1 },
  { id: 'l25', type: 'Unpaid Time Off', date: '05-Feb-2027', status: 'Pending', requestedBy: 'Henrik Larsen', days: 3 },
  { id: 'l26', type: 'PTO', date: '19-Nov-2026', status: 'Approved', requestedBy: 'Aaliyah Johnson', days: 5 },
  { id: 'l27', type: 'LIEU', date: '30-Oct-2026', status: 'Rejected', requestedBy: 'Fatima Al-Sayed', days: 1 },
  { id: 'l28', type: 'PTO', date: '22-Dec-2026', status: 'Pending', requestedBy: 'Rohan Kapoor', days: 2 },
  { id: 'l29', type: 'Sick Leave', date: '11-Oct-2026', status: 'Approved', requestedBy: 'Charinda Dissanayake', days: 1 },
  { id: 'l30', type: 'Accrued Public Holiday', date: '07-Nov-2026', status: 'Pending', requestedBy: 'Ajith Pathmanathan', days: 1 },
]

// ---- date helpers ('14-Sep-2026' strings + working-day spans) ---------------------------------
const DISMISSED_KEY = 'typeb-hr.leave-dismissed.v1'

function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function formatLeaveDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

export function parseLeaveDate(display: string): Date | null {
  const d = new Date(display.replace(/-/g, ' '))
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// The working days (Mon–Fri) a request covers, as YYYY-MM-DD, starting from its first date.
export function leaveWorkingDays(req: Pick<LeaveRequest, 'date' | 'days'>): string[] {
  const start = parseLeaveDate(req.date)
  if (!start) return []
  const out: string[] = []
  const cursor = new Date(start)
  let remaining = Math.max(1, Math.ceil(req.days))
  let guard = 0
  while (remaining > 0 && guard++ < 400) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) {
      out.push(toYmd(cursor))
      remaining--
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function leaveCoversDate(req: Pick<LeaveRequest, 'date' | 'days'>, ymd: string): boolean {
  return leaveWorkingDays(req).includes(ymd)
}

// Demo absences for the team, anchored to the week the dashboard is showing so "Who's off"
// has real requests to click through to. Added once; deleting one is remembered.
function demoAbsences(): LeaveRequest[] {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = monday.getDay()
  monday.setDate(monday.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow)) // this Monday, or next if it's the weekend
  const at = (offset: number) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + offset)
    return formatLeaveDate(d)
  }
  return [
    { id: 'ld1', type: 'PTO', date: at(0), status: 'Approved', requestedBy: 'Dinusha Randika', days: 3 },
    { id: 'ld2', type: 'Sick Leave', date: at(1), status: 'Approved', requestedBy: 'Batool Abdullah', days: 1 },
    { id: 'ld3', type: 'PTO', date: at(2), status: 'Approved', requestedBy: 'Chamika Wijeratne', days: 2 },
    { id: 'ld4', type: 'Unpaid Time Off', date: at(3), status: 'Approved', requestedBy: 'Ashkar Haris', days: 1 },
    { id: 'ld5', type: 'PTO', date: at(4), status: 'Approved', requestedBy: 'Charinda Dissanayake', days: 1 },
    { id: 'ld6', type: 'LIEU', date: at(0), status: 'Approved', requestedBy: 'Devon Marsh', days: 1 },
    { id: 'ld7', type: 'Sick Leave', date: at(1), status: 'Approved', requestedBy: 'Grace Kim', days: 2 },
    { id: 'ld8', type: 'PTO', date: at(3), status: 'Approved', requestedBy: 'Viktor Petrov', days: 2 },
  ]
}

function dismissedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function load(): LeaveRequest[] {
  const dismissed = dismissedIds()
  const demos = demoAbsences()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const base = raw ? (JSON.parse(raw) as LeaveRequest[]) : seedRequests
    const have = new Set(base.map((r) => r.id))
    return [...base, ...demos.filter((d) => !have.has(d.id) && !dismissed.includes(d.id))]
  } catch {
    return [...seedRequests, ...demos.filter((d) => !dismissed.includes(d.id))]
  }
}

function save(requests: LeaveRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(r: LeaveRequest[]) => void> = []
let state: LeaveRequest[] = load()

function setState(next: LeaveRequest[]) {
  state = next
  save(state)
  listeners.forEach((l) => l(state))
}

interface LeaveRequestRow {
  id: string
  type: LeaveType
  date: string
  status: LeaveStatus
  requested_by: string
  days: number
}

function leaveRequestFromRow(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    status: row.status,
    requestedBy: row.requested_by,
    days: row.days,
  }
}

function leaveRequestToRow(r: LeaveRequest): LeaveRequestRow {
  return {
    id: r.id,
    type: r.type,
    date: r.date,
    status: r.status,
    requested_by: r.requestedBy,
    days: r.days,
  }
}

// The real, persisted requests come from Supabase; the "this week" demo absences
// are synthetic (regenerated relative to today on every load) and never stored
// there — the same merge load() already does against localStorage/seed data.
async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('leave_requests').select('*')
  if (error || !data) return
  const fromRows = data.map((row) => leaveRequestFromRow(row as LeaveRequestRow))
  const dismissed = dismissedIds()
  const demos = demoAbsences()
  const have = new Set(fromRows.map((r) => r.id))
  setState([...fromRows, ...demos.filter((d) => !have.has(d.id) && !dismissed.includes(d.id))])
}

hydrateFromSupabase()

function syncUpsert(request: LeaveRequest) {
  supabase
    .from('leave_requests')
    .upsert(leaveRequestToRow(request))
    .then(({ error }) => {
      if (error) showToast('Could not sync leave request to the server', 'danger')
    })
}

function syncDelete(id: string) {
  supabase
    .from('leave_requests')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) showToast('Could not sync deletion to the server', 'danger')
    })
}

export function addLeaveRequest(input: Omit<LeaveRequest, 'id' | 'status'>) {
  const request: LeaveRequest = {
    ...input,
    id: `l${Date.now()}`,
    status: 'Pending',
  }
  setState([request, ...state])
  syncUpsert(request)
  showToast(`${request.type} request submitted for ${request.date}`, 'success')
}

export function updateLeaveRequest(id: string, patch: Partial<Omit<LeaveRequest, 'id'>>) {
  setState(state.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const updated = state.find((r) => r.id === id)
  if (updated) syncUpsert(updated)
  showToast('Leave request updated', 'success')
}

export function deleteLeaveRequest(id: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedIds(), id]))
  } catch {
    // ignore
  }
  setState(state.filter((r) => r.id !== id))
  syncDelete(id)
  showToast('Leave request deleted', 'success')
}

export function useLeaveRequests(): LeaveRequest[] {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export const PTO_TOTAL_ACCRUED = 14.5
export const PTO_TOTAL_USED = 3
export const LIEU_GRANTED = 2
export const LEAVE_CYCLE = '26 January 2026 — 25 January 2027'
