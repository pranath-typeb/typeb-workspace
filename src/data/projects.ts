import { useEffect, useState } from 'react'
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
}

const STORAGE_KEY = 'typeb-hr.projects.v1'

const seedProjects: Project[] = [
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
]

function load(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedProjects
    return JSON.parse(raw) as Project[]
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

export function addProject(input: Omit<Project, 'id' | 'hoursLogged'>) {
  const project: Project = {
    ...input,
    id: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    hoursLogged: 0,
  }
  setState([project, ...state])
  showToast(`"${project.name}" created`, 'success')
  return project
}

export function updateProject(id: string, patch: Partial<Project>) {
  setState(state.map((p) => (p.id === id ? { ...p, ...patch } : p)))
}

export function deleteProject(id: string) {
  const project = state.find((p) => p.id === id)
  setState(state.filter((p) => p.id !== id))
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
