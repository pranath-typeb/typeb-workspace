import { useEffect, useState } from 'react'
import { showToast } from './toast'

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

function load(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedRequests
    return JSON.parse(raw) as LeaveRequest[]
  } catch {
    return seedRequests
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

export function addLeaveRequest(input: Omit<LeaveRequest, 'id' | 'status'>) {
  const request: LeaveRequest = {
    ...input,
    id: `l${Date.now()}`,
    status: 'Pending',
  }
  setState([request, ...state])
  showToast(`${request.type} request submitted for ${request.date}`, 'success')
}

export function updateLeaveRequest(id: string, patch: Partial<Omit<LeaveRequest, 'id'>>) {
  setState(state.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  showToast('Leave request updated', 'success')
}

export function deleteLeaveRequest(id: string) {
  setState(state.filter((r) => r.id !== id))
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
