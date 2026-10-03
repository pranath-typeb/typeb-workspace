import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { showToast } from './toast'

export type ProjectStatus = 'Active' | 'On Track' | 'Completed'
export type BillingType = 'Fixed bid' | 'Time & materials' | 'Retainer'

export interface Project {
  id: string
  name: string
  client: string
  status: ProjectStatus
  billable: boolean
  staffing: boolean
  hoursLogged: number
  starts: string
  ends: string
  billing: BillingType
  managerId: string | null
  teamIds: string[]
  calendarKeywords?: string[]
  color: string
}

const STORAGE_KEY = 'typeb-hr.projects.v1'

// Rotating palette assigned to new projects in order, so each project reads as a
// distinct color on the Calendar without anyone having to pick one manually.
export const PROJECT_COLOR_PALETTE = [
  '#1f8a85',
  '#3b82f6',
  '#c084fc',
  '#eab308',
  '#ff6d33',
  '#3a8f8c',
  '#e11d48',
  '#0ea5e9',
  '#84cc16',
  '#a855f7',
]

export function projectColorForIndex(index: number): string {
  return PROJECT_COLOR_PALETTE[index % PROJECT_COLOR_PALETTE.length]
}

const seedProjectsBase: Omit<Project, 'color'>[] = [
  {
    id: 'atlas-launch',
    name: 'Atlas Launch',
    client: 'Riverstone Partners',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-08-01',
    ends: '2026-12-15',
    billing: 'Fixed bid',
    managerId: 'hashan-wijesinghe',
    teamIds: ['ajith-pathmanathan', 'ashkar-haris', 'charinda-dissanayake'],
  },
  {
    id: 'cobalt-launch',
    name: 'Cobalt Launch',
    client: 'Atlas Labs',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-09-01',
    ends: '2027-02-01',
    billing: 'Time & materials',
    managerId: 'faran-siddiqui',
    teamIds: ['charinda-dissanayake'],
  },
  {
    id: 'cobalt-pipeline',
    name: 'Cobalt Pipeline',
    client: 'Stonebridge Labs',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-07-15',
    ends: '2026-11-30',
    billing: 'Retainer',
    managerId: 'hashan-wijesinghe',
    teamIds: [],
  },
  {
    id: 'echo-initiative',
    name: 'Echo Initiative',
    client: 'Riverstone Partners',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-06-01',
    ends: '2026-10-01',
    billing: 'Fixed bid',
    managerId: 'chamika-wijeratne',
    teamIds: [],
  },
  {
    id: 'echo-integration',
    name: 'Echo Integration',
    client: 'Riverstone Partners',
    status: 'On Track',
    billable: true,
    staffing: true,
    hoursLogged: 0,
    starts: '2026-05-01',
    ends: '2026-09-30',
    billing: 'Time & materials',
    managerId: 'chamika-wijeratne',
    teamIds: ['ajith-pathmanathan', 'ashkar-haris'],
  },
  {
    id: 'echo-migration',
    name: 'Echo Migration',
    client: 'Cobalt Partners',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-04-01',
    ends: '2026-08-01',
    billing: 'Fixed bid',
    managerId: 'hashan-wijesinghe',
    teamIds: ['ajith-pathmanathan', 'ashkar-haris', 'charinda-dissanayake', 'batool-abdullah'],
  },
  {
    id: 'echo-program-keystone',
    name: 'Echo Program',
    client: 'Keystone Labs',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-03-01',
    ends: '2026-07-01',
    billing: 'Retainer',
    managerId: 'faran-siddiqui',
    teamIds: [],
  },
  {
    id: 'echo-program-stonebridge',
    name: 'Echo Program',
    client: 'Stonebridge Labs',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 0,
    starts: '2026-03-01',
    ends: '2026-07-01',
    billing: 'Retainer',
    managerId: 'faran-siddiqui',
    teamIds: [],
  },
  // Additional statuses, clients, and billing types for broader test coverage
  {
    id: 'falcon-launch',
    name: 'Falcon Launch',
    client: 'Beacon Studios',
    status: 'Active',
    billable: true,
    staffing: true,
    hoursLogged: 12,
    starts: '2026-09-07',
    ends: '2027-01-15',
    billing: 'Time & materials',
    managerId: 'faran-siddiqui',
    teamIds: ['priya-nair'],
  },
  {
    id: 'legacy-migration',
    name: 'Legacy Migration',
    client: 'Atlas Labs',
    status: 'Completed',
    billable: true,
    staffing: false,
    hoursLogged: 640,
    starts: '2025-11-01',
    ends: '2026-05-01',
    billing: 'Fixed bid',
    managerId: 'hashan-wijesinghe',
    teamIds: [],
  },
  {
    id: 'vantage-crm',
    name: 'Vantage CRM Rollout',
    client: 'Vantage Group',
    status: 'On Track',
    billable: true,
    staffing: true,
    hoursLogged: 88,
    starts: '2026-08-01',
    ends: '2027-03-01',
    billing: 'Retainer',
    managerId: 'faran-siddiqui',
    teamIds: ['yuki-tanaka'],
  },
  {
    id: 'aurora-redesign',
    name: 'Aurora Brand Redesign',
    client: 'Aurora Works',
    status: 'Completed',
    billable: false,
    staffing: false,
    hoursLogged: 210,
    starts: '2025-06-01',
    ends: '2025-12-01',
    billing: 'Fixed bid',
    managerId: 'chamika-wijeratne',
    teamIds: [],
  },
  {
    id: 'beacon-support',
    name: 'Beacon Ongoing Support',
    client: 'Beacon Industries',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 6,
    starts: '2026-01-01',
    ends: '2026-12-31',
    billing: 'Retainer',
    managerId: 'dinusha-randika',
    teamIds: ['dinusha-randika'],
  },
  // New clients / projects to give the Projects & Staffing pages more depth
  {
    id: 'nimbus-onboarding',
    name: 'Nimbus Onboarding',
    client: 'Nimbus Health',
    status: 'Active',
    billable: true,
    staffing: true,
    hoursLogged: 34,
    starts: '2026-09-01',
    ends: '2027-01-31',
    billing: 'Time & materials',
    managerId: 'devon-marsh',
    teamIds: ['isabela-costa', 'kwame-mensah'],
  },
  {
    id: 'orbit-analytics',
    name: 'Orbit Analytics Platform',
    client: 'Orbit Data',
    status: 'Active',
    billable: true,
    staffing: true,
    hoursLogged: 58,
    starts: '2026-07-20',
    ends: '2027-02-28',
    billing: 'Fixed bid',
    managerId: 'hashan-wijesinghe',
    teamIds: ['nadia-rahman', 'felix-huber', 'meera-pillai'],
  },
  {
    id: 'pinecrest-crm',
    name: 'Pinecrest CRM Migration',
    client: 'Vantage Group',
    status: 'On Track',
    billable: true,
    staffing: true,
    hoursLogged: 120,
    starts: '2026-06-01',
    ends: '2026-12-01',
    billing: 'Retainer',
    managerId: 'faran-siddiqui',
    teamIds: ['devon-marsh', 'kwame-mensah'],
  },
  {
    id: 'quartz-mobile',
    name: 'Quartz Mobile App',
    client: 'Beacon Studios',
    status: 'Active',
    billable: true,
    staffing: true,
    hoursLogged: 40,
    starts: '2026-08-15',
    ends: '2027-03-15',
    billing: 'Time & materials',
    managerId: 'hashan-wijesinghe',
    teamIds: ['yuki-tanaka', 'isabela-costa'],
  },
  {
    id: 'redwood-website',
    name: 'Redwood Marketing Site',
    client: 'Aurora Works',
    status: 'Completed',
    billable: false,
    staffing: false,
    hoursLogged: 96,
    starts: '2025-09-01',
    ends: '2026-01-15',
    billing: 'Fixed bid',
    managerId: 'batool-abdullah',
    teamIds: [],
  },
  {
    id: 'summit-partnership',
    name: 'Summit Partnership Program',
    client: 'Stonebridge Labs',
    status: 'Active',
    billable: true,
    staffing: true,
    hoursLogged: 22,
    starts: '2026-09-15',
    ends: '2027-06-01',
    billing: 'Retainer',
    managerId: 'diego-alvarez',
    teamIds: ['grace-kim', 'oliver-bennett'],
  },
  {
    id: 'talon-security-audit',
    name: 'Talon Security Audit',
    client: 'Keystone Labs',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 8,
    starts: '2026-09-20',
    ends: '2026-11-01',
    billing: 'Fixed bid',
    managerId: 'faran-siddiqui',
    teamIds: ['felix-huber'],
  },
  {
    id: 'union-hr-portal',
    name: 'Union HR Portal',
    client: 'Cobalt Partners',
    status: 'On Track',
    billable: true,
    staffing: true,
    hoursLogged: 64,
    starts: '2026-05-15',
    ends: '2026-11-15',
    billing: 'Time & materials',
    managerId: 'amina-diallo',
    teamIds: ['fatima-al-sayed', 'rohan-kapoor'],
  },
  {
    id: 'vertex-data-lake',
    name: 'Vertex Data Lake',
    client: 'Atlas Labs',
    status: 'Active',
    billable: true,
    staffing: true,
    hoursLogged: 30,
    starts: '2026-08-01',
    ends: '2027-04-01',
    billing: 'Fixed bid',
    managerId: 'hashan-wijesinghe',
    teamIds: ['kwame-mensah', 'meera-pillai'],
  },
  {
    id: 'westgate-retainer',
    name: 'Westgate Ongoing Retainer',
    client: 'Westgate Foods',
    status: 'Active',
    billable: true,
    staffing: false,
    hoursLogged: 4,
    starts: '2026-01-01',
    ends: '2026-12-31',
    billing: 'Retainer',
    managerId: 'dinusha-randika',
    teamIds: ['chloe-dubois'],
  },
]

const seedProjects: Project[] = seedProjectsBase.map((p, i) => ({ ...p, color: projectColorForIndex(i) }))

// Read-only Supabase mirror of this table (see src/lib/supabaseClient.ts and the same
// note in data/people.ts). The app has no login system, so this hydration only ever
// pulls the latest rows down — addProject/updateProject/deleteProject keep writing to
// localStorage only, so edits made in the app won't appear in Supabase until the row is
// updated there directly.
interface ProjectRow {
  id: string
  name: string
  client: string
  status: ProjectStatus
  billable: boolean
  staffing: boolean
  hours_logged: number
  starts: string
  ends: string
  billing: BillingType
  manager_id: string | null
  team_ids: string[]
  calendar_keywords: string[] | null
  color: string
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    status: row.status,
    billable: row.billable,
    staffing: row.staffing,
    hoursLogged: row.hours_logged,
    starts: row.starts,
    ends: row.ends,
    billing: row.billing,
    managerId: row.manager_id,
    teamIds: row.team_ids,
    calendarKeywords: row.calendar_keywords ?? undefined,
    color: row.color,
  }
}

function projectToRow(p: Project): ProjectRow {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status,
    billable: p.billable,
    staffing: p.staffing,
    hours_logged: p.hoursLogged,
    starts: p.starts,
    ends: p.ends,
    billing: p.billing,
    manager_id: p.managerId,
    team_ids: p.teamIds,
    calendar_keywords: p.calendarKeywords ?? null,
    color: p.color,
  }
}

async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('projects').select('*').order('name')
  if (error || !data) return
  setState(data.map((row) => projectFromRow(row as ProjectRow)))
}

function syncUpsert(project: Project) {
  supabase
    .from('projects')
    .upsert(projectToRow(project))
    .then(({ error }) => {
      if (error) showToast('Could not sync project to the server', 'danger')
    })
}

function syncDelete(id: string) {
  supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) showToast('Could not sync deletion to the server', 'danger')
    })
}

function load(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedProjects
    const parsed = JSON.parse(raw) as Project[]
    // Backfill colors for projects stored before the color field existed.
    return parsed.map((p, i) => (p.color ? p : { ...p, color: projectColorForIndex(i) }))
  } catch {
    return seedProjects
  }
}

function save(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(p: Project[]) => void> = []
let state: Project[] = load()

function setState(next: Project[]) {
  state = next
  save(state)
  listeners.forEach((l) => l(state))
}

hydrateFromSupabase()

export function addProject(input: Omit<Project, 'id' | 'hoursLogged' | 'color'> & { color?: string }) {
  const project: Project = {
    ...input,
    id: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    hoursLogged: 0,
    color: input.color ?? projectColorForIndex(state.length),
  }
  setState([project, ...state])
  syncUpsert(project)
  showToast(`"${project.name}" created`, 'success')
  return project
}

// The color CreateProjectModal shows by default before the user overrides it —
// keeps the "next color in rotation" logic in one place.
export function nextProjectColor(): string {
  return projectColorForIndex(state.length)
}

export function updateProject(id: string, patch: Partial<Project>) {
  setState(state.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const updated = state.find((p) => p.id === id)
  if (updated) syncUpsert(updated)
}

export function deleteProject(id: string) {
  const project = state.find((p) => p.id === id)
  setState(state.filter((p) => p.id !== id))
  syncDelete(id)
  if (project) showToast(`"${project.name}" deleted`, 'danger')
}

export function useProjects(): Project[] {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function projectById(id: string): Project | undefined {
  return state.find((p) => p.id === id)
}

// Color to use for a time entry's project accent — falls back to DEFAULT_PROJECT_COLOR
// when the entry has no project (callers that want the distinct "no project" flag
// color should check for a null/missing projectId themselves; see NO_PROJECT_COLOR
// in data/timeEntries.ts).
export const DEFAULT_PROJECT_COLOR = '#5f636c'

export function projectColor(projectId: string | null | undefined): string {
  if (!projectId) return DEFAULT_PROJECT_COLOR
  return projectById(projectId)?.color ?? DEFAULT_PROJECT_COLOR
}
