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

export function committedHoursFor(assignments: Assignment[], personId: string): number {
  return assignments
    .filter((a) => a.personId === personId)
    .reduce((sum, a) => sum + Math.round(a.hoursPerWeek * 4.4), 0)
}

export function allocationStatus(pct: number): { label: string; badgeClass: string } {
  if (pct === 0) return { label: 'UNASSIGNED', badgeClass: 'b-neutral' }
  if (pct > 100) return { label: 'OVER-ALLOCATED', badgeClass: 'b-danger' }
  if (pct >= 95) return { label: 'AT CAPACITY', badgeClass: 'b-pine' }
  return { label: 'PARTIALLY ALLOCATED', badgeClass: 'b-ember' }
}
