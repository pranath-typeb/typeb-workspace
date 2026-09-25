import { useEffect, useState } from 'react'
import { showToast } from './toast'
import { personById } from './people'
import { projectById } from './projects'

export interface Assignment {
  id: string
  personId: string
  projectId: string
  hoursPerWeek: number
  startDate: string
  openEnded: boolean
  note?: string
}

const STORAGE_KEY = 'typeb-hr.staffing.v1'

export const MONTHLY_CAPACITY_HOURS = 176

const seedAssignments: Assignment[] = [
  { id: 's1', personId: 'ajith-pathmanathan', projectId: 'atlas-launch', hoursPerWeek: 10, startDate: '2026-08-31', openEnded: true },
  { id: 's2', personId: 'ashkar-haris', projectId: 'echo-integration', hoursPerWeek: 15, startDate: '2026-08-01', openEnded: true },
  { id: 's3', personId: 'charinda-dissanayake', projectId: 'echo-migration', hoursPerWeek: 20, startDate: '2026-07-01', openEnded: true },
  { id: 's4', personId: 'charinda-dissanayake', projectId: 'cobalt-launch', hoursPerWeek: 8, startDate: '2026-09-01', openEnded: true },
  // Over-allocated: two concurrent commitments push this well past 100%
  { id: 's5', personId: 'faran-siddiqui', projectId: 'falcon-launch', hoursPerWeek: 30, startDate: '2026-09-07', openEnded: true },
  { id: 's6', personId: 'faran-siddiqui', projectId: 'vantage-crm', hoursPerWeek: 30, startDate: '2026-08-01', openEnded: true },
  // At capacity: exactly 40h/wk ≈ 176h/month
  { id: 's7', personId: 'hashan-wijesinghe', projectId: 'legacy-migration', hoursPerWeek: 40, startDate: '2025-11-01', openEnded: false, note: 'Backfilled while hiring' },
  // Has room: small, partial commitments
  { id: 's8', personId: 'priya-nair', projectId: 'atlas-launch', hoursPerWeek: 8, startDate: '2026-09-10', openEnded: true },
  { id: 's9', personId: 'dinusha-randika', projectId: 'beacon-support', hoursPerWeek: 5, startDate: '2026-01-01', openEnded: true },
  { id: 's10', personId: 'yuki-tanaka', projectId: 'vantage-crm', hoursPerWeek: 20, startDate: '2026-08-01', openEnded: true },
]

function load(): Assignment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedAssignments
    return JSON.parse(raw) as Assignment[]
  } catch {
    return seedAssignments
  }
}

function save(assignments: Assignment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(a: Assignment[]) => void> = []
let state: Assignment[] = load()

function setState(next: Assignment[]) {
  state = next
  save(state)
  listeners.forEach((l) => l(state))
}

export function addAssignment(input: Omit<Assignment, 'id'>) {
  const assignment: Assignment = { ...input, id: `s${Date.now()}` }
  setState([assignment, ...state])
  const person = personById(assignment.personId)
  const project = projectById(assignment.projectId)
  showToast(`Committed ${assignment.hoursPerWeek}h/wk for ${person?.name ?? 'employee'} on ${project?.name ?? 'project'}`, 'success')
  return assignment
}

export function removeAssignment(id: string) {
  const assignment = state.find((a) => a.id === id)
  setState(state.filter((a) => a.id !== id))
  if (assignment) {
    const person = personById(assignment.personId)
    const project = projectById(assignment.projectId)
    showToast(`Removed ${person?.name ?? 'employee'}'s commitment on ${project?.name ?? 'project'}`, 'danger')
  }
}

export function useAssignments(): Assignment[] {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function committedHoursFor(assignments: Assignment[], personId: string, weeksMultiplier = 4.4): number {
  return assignments
    .filter((a) => a.personId === personId)
    .reduce((sum, a) => sum + Math.round(a.hoursPerWeek * weeksMultiplier), 0)
}

export function allocationStatus(pct: number): { label: string; badgeClass: string } {
  if (pct === 0) return { label: 'UNASSIGNED', badgeClass: 'b-neutral' }
  if (pct > 100) return { label: 'OVER-ALLOCATED', badgeClass: 'b-danger' }
  if (pct >= 95) return { label: 'AT CAPACITY', badgeClass: 'b-pine' }
  return { label: 'PARTIALLY ALLOCATED', badgeClass: 'b-ember' }
}
