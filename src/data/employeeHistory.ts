import { useEffect, useState } from 'react'

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
]

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

export function historyFor(personId: string): HistoryEvent[] {
  return history.filter((h) => h.personId === personId).sort((a, b) => b.date.localeCompare(a.date))
}

export function addHistoryEvent(input: Omit<HistoryEvent, 'id'>) {
  const event: HistoryEvent = { ...input, id: `eh-${Date.now()}` }
  setState([...history, event])
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
