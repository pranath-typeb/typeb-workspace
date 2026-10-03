import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { showToast } from './toast'

export type HistoryEventType = 'Hire' | 'Promotion' | 'Title Change' | 'Salary Change' | 'Transfer'

export interface HistoryEvent {
  id: string
  personId: string
  date: string // YYYY-MM-DD
  type: HistoryEventType
  title: string // new role title at the time of this event, if applicable
  department?: string | null
  salary?: number // new monthly base salary, if this event changed pay
  previousSalary?: number
  note?: string
}

const STORAGE_KEY = 'typeb-hr.employee-history.v1'

const seedHistory: HistoryEvent[] = [
  {
    id: 'eh-pranath-1',
    personId: 'pranath-b',
    date: '2021-01-04',
    type: 'Hire',
    title: 'Founder',
    department: 'Strategy',
  },
  {
    id: 'eh-nabeel-1',
    personId: 'nabeel-syed',
    date: '2021-01-04',
    type: 'Hire',
    title: 'CEO',
    department: 'Strategy',
  },
  {
    id: 'eh-hashan-1',
    personId: 'hashan-wijesinghe',
    date: '2022-02-01',
    type: 'Hire',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    salary: 3200,
  },
  {
    id: 'eh-hashan-2',
    personId: 'hashan-wijesinghe',
    date: '2023-06-01',
    type: 'Promotion',
    title: 'Senior Software Engineer',
    department: 'Technology',
    salary: 3800,
    previousSalary: 3200,
    note: 'Promoted after leading the Vantage CRM rollout',
  },
  {
    id: 'eh-hashan-3',
    personId: 'hashan-wijesinghe',
    date: '2024-09-15',
    type: 'Promotion',
    title: 'Technical Lead',
    department: 'Technology',
    salary: 4500,
    previousSalary: 3800,
    note: 'Took over technical leadership for the Technology team',
  },
  {
    id: 'eh-hashan-4',
    personId: 'hashan-wijesinghe',
    date: '2025-09-15',
    type: 'Salary Change',
    title: 'Technical Lead',
    department: 'Technology',
    salary: 4800,
    previousSalary: 4500,
    note: 'Annual compensation review',
  },
  {
    id: 'eh-ajith-1',
    personId: 'ajith-pathmanathan',
    date: '2025-08-03',
    type: 'Hire',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    salary: 2800,
  },
  {
    id: 'eh-charinda-1',
    personId: 'charinda-dissanayake',
    date: '2023-06-19',
    type: 'Hire',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    salary: 3000,
  },
  {
    id: 'eh-charinda-2',
    personId: 'charinda-dissanayake',
    date: '2024-11-01',
    type: 'Promotion',
    title: 'Sr. Software Engineer',
    department: 'Technology',
    salary: 3600,
    previousSalary: 3000,
    note: 'Promoted for consistently shipping ahead of schedule',
  },
  {
    id: 'eh-batool-1',
    personId: 'batool-abdullah',
    date: '2024-01-22',
    type: 'Hire',
    title: 'Business Developer',
    department: 'Growth',
    salary: 2400,
  },
  {
    id: 'eh-batool-2',
    personId: 'batool-abdullah',
    date: '2025-06-01',
    type: 'Salary Change',
    title: 'Business Developer',
    department: 'Growth',
    salary: 2650,
    previousSalary: 2400,
    note: 'Annual compensation review',
  },
  {
    id: 'eh-faran-1',
    personId: 'faran-siddiqui',
    date: '2021-03-15',
    type: 'Hire',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    salary: 3400,
  },
  {
    id: 'eh-faran-2',
    personId: 'faran-siddiqui',
    date: '2022-08-01',
    type: 'Promotion',
    title: 'Technical Lead',
    department: 'Technology',
    salary: 4200,
    previousSalary: 3400,
  },
  {
    id: 'eh-faran-3',
    personId: 'faran-siddiqui',
    date: '2024-04-01',
    type: 'Promotion',
    title: 'Head of Technology',
    department: 'Technology',
    salary: 5400,
    previousSalary: 4200,
    note: 'Promoted to lead the Technology department',
  },
  // Sparse-history existing employees — backfilling hire (and a couple of later) events
  {
    id: 'eh-dinusha-1',
    personId: 'dinusha-randika',
    date: '2023-10-10',
    type: 'Hire',
    title: 'Operations Coordinator',
    department: 'Operations',
    salary: 1900,
  },
  {
    id: 'eh-layla-1',
    personId: 'layla-haddad',
    date: '2022-10-05',
    type: 'Hire',
    title: 'Operations Coordinator',
    department: 'Operations',
    salary: 2100,
  },
  {
    id: 'eh-layla-2',
    personId: 'layla-haddad',
    date: '2024-03-01',
    type: 'Promotion',
    title: 'Operations Manager',
    department: 'Operations',
    salary: 2900,
    previousSalary: 2100,
    note: 'Promoted to manage the Operations team',
  },
  {
    id: 'eh-tomas-1',
    personId: 'tomas-rivera',
    date: '2024-10-22',
    type: 'Hire',
    title: 'Strategy Analyst',
    department: 'Strategy',
    salary: 2300,
  },
  {
    id: 'eh-yuki-1',
    personId: 'yuki-tanaka',
    date: '2024-02-14',
    type: 'Hire',
    title: 'Software Engineer (Mobile)',
    department: 'Technology',
    salary: 3100,
  },
  {
    id: 'eh-amina-1',
    personId: 'amina-diallo',
    date: '2023-05-08',
    type: 'Hire',
    title: 'People Ops Coordinator',
    department: 'People',
    salary: 2000,
  },
  {
    id: 'eh-amina-2',
    personId: 'amina-diallo',
    date: '2024-09-01',
    type: 'Title Change',
    title: 'People Ops Partner',
    department: 'People',
    note: 'Title updated to reflect expanded remit',
  },
  {
    id: 'eh-oliver-1',
    personId: 'oliver-bennett',
    date: '2025-01-20',
    type: 'Hire',
    title: 'Business Developer',
    department: 'Growth',
    salary: 2200,
  },
  {
    id: 'eh-priya-1',
    personId: 'priya-nair',
    date: '2026-09-10',
    type: 'Hire',
    title: 'Software Engineer (Frontend)',
    department: 'Technology',
    salary: 2800,
  },
  {
    id: 'eh-marcus-1',
    personId: 'marcus-chen',
    date: '2026-09-18',
    type: 'Hire',
    title: 'Growth Marketer',
    department: 'Growth',
    salary: 2500,
  },
  // New employees — hire events
  {
    id: 'eh-devon-1',
    personId: 'devon-marsh',
    date: '2023-01-10',
    type: 'Hire',
    title: 'Engineering Manager',
    department: 'Technology',
    salary: 5000,
  },
  {
    id: 'eh-isabela-1',
    personId: 'isabela-costa',
    date: '2024-05-01',
    type: 'Hire',
    title: 'Software Engineer (Frontend)',
    department: 'Technology',
    salary: 3000,
  },
  {
    id: 'eh-kwame-1',
    personId: 'kwame-mensah',
    date: '2023-09-01',
    type: 'Hire',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    salary: 2900,
  },
  {
    id: 'eh-nadia-1',
    personId: 'nadia-rahman',
    date: '2024-03-15',
    type: 'Hire',
    title: 'QA Engineer',
    department: 'Technology',
    salary: 2600,
  },
  {
    id: 'eh-felix-1',
    personId: 'felix-huber',
    date: '2025-02-01',
    type: 'Hire',
    title: 'DevOps Engineer',
    department: 'Technology',
    salary: 3400,
  },
  {
    id: 'eh-meera-1',
    personId: 'meera-pillai',
    date: '2024-11-01',
    type: 'Hire',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    salary: 1800,
  },
  {
    id: 'eh-diego-1',
    personId: 'diego-alvarez',
    date: '2022-06-01',
    type: 'Hire',
    title: 'Sales Development Rep',
    department: 'Growth',
    salary: 2100,
  },
  {
    id: 'eh-grace-1',
    personId: 'grace-kim',
    date: '2024-08-15',
    type: 'Hire',
    title: 'Business Developer',
    department: 'Growth',
    salary: 2350,
  },
  {
    id: 'eh-henrik-1',
    personId: 'henrik-larsen',
    date: '2023-04-01',
    type: 'Hire',
    title: 'Strategy Analyst',
    department: 'Strategy',
    salary: 2400,
  },
  {
    id: 'eh-aaliyah-1',
    personId: 'aaliyah-johnson',
    date: '2022-11-01',
    type: 'Hire',
    title: 'Product Manager',
    department: 'Strategy',
    salary: 4000,
  },
  {
    id: 'eh-fatima-1',
    personId: 'fatima-al-sayed',
    date: '2023-07-01',
    type: 'Hire',
    title: 'HR Coordinator',
    department: 'People',
    salary: 2200,
  },
  {
    id: 'eh-viktor-1',
    personId: 'viktor-petrov',
    date: '2022-09-01',
    type: 'Hire',
    title: 'Operations Analyst',
    department: 'Operations',
    salary: 2000,
  },
  {
    id: 'eh-chloe-1',
    personId: 'chloe-dubois',
    date: '2024-04-01',
    type: 'Hire',
    title: 'Operations Coordinator',
    department: 'Operations',
    salary: 1600,
  },
  {
    id: 'eh-rohan-1',
    personId: 'rohan-kapoor',
    date: '2023-02-01',
    type: 'Hire',
    title: 'Talent Acquisition Specialist',
    department: 'People',
    salary: 2300,
  },
  {
    id: 'eh-samuel-1',
    personId: 'samuel-osei',
    date: '2025-05-01',
    type: 'Hire',
    title: '',
    department: null,
  },
  {
    id: 'eh-lucia-1',
    personId: 'lucia-fernandez',
    date: '2026-09-22',
    type: 'Hire',
    title: 'Business Developer',
    department: 'Growth',
    salary: 1900,
  },
  {
    id: 'eh-ben-1',
    personId: 'ben-okafor',
    date: '2021-10-12',
    type: 'Hire',
    title: 'Operations Analyst',
    department: 'Operations',
    salary: 1950,
  },
]

interface HistoryEventRow {
  id: string
  person_id: string
  date: string
  type: HistoryEventType
  title: string
  department: string | null
  salary: number | null
  previous_salary: number | null
  note: string | null
}

function historyEventFromRow(row: HistoryEventRow): HistoryEvent {
  return {
    id: row.id,
    personId: row.person_id,
    date: row.date,
    type: row.type,
    title: row.title,
    department: row.department,
    salary: row.salary ?? undefined,
    previousSalary: row.previous_salary ?? undefined,
    note: row.note ?? undefined,
  }
}

function historyEventToRow(h: HistoryEvent): HistoryEventRow {
  return {
    id: h.id,
    person_id: h.personId,
    date: h.date,
    type: h.type,
    title: h.title,
    department: h.department ?? null,
    salary: h.salary ?? null,
    previous_salary: h.previousSalary ?? null,
    note: h.note ?? null,
  }
}

async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('employment_history').select('*').order('date')
  if (error || !data) return
  setState(data.map((row) => historyEventFromRow(row as HistoryEventRow)))
}

function syncUpsert(event: HistoryEvent) {
  supabase
    .from('employment_history')
    .upsert(historyEventToRow(event))
    .then(({ error }) => {
      if (error) showToast('Could not sync the history event to the server', 'danger')
    })
}

function load(): HistoryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as HistoryEvent[]) : seedHistory
  } catch {
    return seedHistory
  }
}

function save(next: HistoryEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(v: HistoryEvent[]) => void> = []
let history: HistoryEvent[] = load()

function setState(next: HistoryEvent[]) {
  history = next
  save(history)
  listeners.forEach((l) => l(history))
}

hydrateFromSupabase()

export function historyFor(personId: string): HistoryEvent[] {
  return history.filter((h) => h.personId === personId).sort((a, b) => b.date.localeCompare(a.date))
}

export function addHistoryEvent(input: Omit<HistoryEvent, 'id'>) {
  const event: HistoryEvent = { ...input, id: `eh-${Date.now()}` }
  setState([...history, event])
  syncUpsert(event)
  return event
}

export function useHistoryFor(personId: string | undefined): HistoryEvent[] {
  const [value, setValue] = useState(history)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  if (!personId) return []
  return value.filter((h) => h.personId === personId).sort((a, b) => b.date.localeCompare(a.date))
}

export function typeBadgeClass(type: HistoryEventType): string {
  if (type === 'Promotion') return 'b-pine'
  if (type === 'Salary Change') return 'b-ember'
  if (type === 'Transfer') return 'b-neutral'
  if (type === 'Title Change') return 'b-neutral'
  return 'b-neutral'
}
