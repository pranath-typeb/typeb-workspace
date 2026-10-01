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
  // Additional commitments across the new projects/people — exercises every allocationStatus bucket
  { id: 's11', personId: 'isabela-costa', projectId: 'nimbus-onboarding', hoursPerWeek: 18, startDate: '2026-09-01', openEnded: true },
  // Over-allocated: two concurrent commitments push this well past 100%
  { id: 's12', personId: 'kwame-mensah', projectId: 'pinecrest-crm', hoursPerWeek: 22, startDate: '2026-06-01', openEnded: true },
  { id: 's13', personId: 'kwame-mensah', projectId: 'vertex-data-lake', hoursPerWeek: 20, startDate: '2026-08-01', openEnded: true },
  // At capacity: exactly 40h/wk ≈ 176h/month
  { id: 's14', personId: 'nadia-rahman', projectId: 'orbit-analytics', hoursPerWeek: 40, startDate: '2026-07-20', openEnded: false, note: 'QA coverage through GA' },
  { id: 's15', personId: 'felix-huber', projectId: 'orbit-analytics', hoursPerWeek: 15, startDate: '2026-07-20', openEnded: true },
  { id: 's16', personId: 'felix-huber', projectId: 'talon-security-audit', hoursPerWeek: 10, startDate: '2026-09-20', openEnded: true },
  { id: 's17', personId: 'meera-pillai', projectId: 'orbit-analytics', hoursPerWeek: 12, startDate: '2026-07-20', openEnded: true },
  { id: 's18', personId: 'devon-marsh', projectId: 'pinecrest-crm', hoursPerWeek: 16, startDate: '2026-06-01', openEnded: true },
  { id: 's19', personId: 'grace-kim', projectId: 'summit-partnership', hoursPerWeek: 25, startDate: '2026-09-15', openEnded: true },
  { id: 's20', personId: 'fatima-al-sayed', projectId: 'union-hr-portal', hoursPerWeek: 30, startDate: '2026-05-15', openEnded: true },
  // At capacity: 38h/wk ≈ 95% of monthly capacity
  { id: 's21', personId: 'rohan-kapoor', projectId: 'union-hr-portal', hoursPerWeek: 38, startDate: '2026-05-15', openEnded: true },
  { id: 's22', personId: 'chloe-dubois', projectId: 'westgate-retainer', hoursPerWeek: 8, startDate: '2026-01-01', openEnded: true },
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

// A manager's per-project commitment for this person — e.g. "10h/wk on Atlas Launch" — as
// opposed to committedHoursFor's total across every project. Powers "assigned vs actual"
// views like the Timesheet's "By project" breakdown.
export function committedHoursForProject(assignments: Assignment[], personId: string, projectId: string, weeksMultiplier = 1): number {
  return assignments
    .filter((a) => a.personId === personId && a.projectId === projectId)
    .reduce((sum, a) => sum + a.hoursPerWeek * weeksMultiplier, 0)
}

export function allocationStatus(pct: number): { label: string; badgeClass: string } {
  if (pct === 0) return { label: 'UNASSIGNED', badgeClass: 'b-neutral' }
  if (pct > 100) return { label: 'OVER-ALLOCATED', badgeClass: 'b-danger' }
  if (pct >= 95) return { label: 'AT CAPACITY', badgeClass: 'b-pine' }
  return { label: 'PARTIALLY ALLOCATED', badgeClass: 'b-ember' }
}
