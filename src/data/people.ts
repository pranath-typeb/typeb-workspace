import { useEffect, useState } from 'react'
import { showToast } from './toast'

export type Department = 'Technology' | 'Growth' | 'Strategy' | 'Operations' | 'People'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'

export const deptBadgeClass: Record<Department, string> = {
  Technology: 'b-pine',
  Growth: 'b-ember',
  Strategy: 'b-neutral',
  Operations: 'b-neutral',
  People: 'b-pine',
}

export interface Person {
  id: string
  name: string
  initials: string
  title: string
  department: Department | null
  email: string
  timezone: string
  managerId: string | null
  startDate: string
  jurisdiction: string | null
  employmentType: EmploymentType | null
  payrollExcluded: boolean
  syncedDaysAgo: number
}

const STORAGE_KEY = 'typeb-hr.people.v1'

export const CURRENT_USER_ID = 'pranath-b'

const seedPeople: Person[] = [
  {
    id: CURRENT_USER_ID,
    name: 'Pranath',
    initials: 'PB',
    title: 'Founder',
    department: 'Strategy',
    email: 'pranath@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: null,
    startDate: '2021-01-04',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'nabeel-syed',
    name: 'Nabeel Syed',
    initials: 'NS',
    title: 'CEO',
    department: 'Strategy',
    email: 'nabeel@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: null,
    startDate: '2021-01-04',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'faran-siddiqui',
    name: 'Faran Siddiqui',
    initials: 'FS',
    title: 'Head of Technology',
    department: 'Technology',
    email: 'faran@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'nabeel-syed',
    startDate: '2021-03-15',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'hashan-wijesinghe',
    name: 'Hashan Wijesinghe',
    initials: 'HW',
    title: 'Technical Lead',
    department: 'Technology',
    email: 'hashan@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'faran-siddiqui',
    startDate: '2022-02-01',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'ajith-pathmanathan',
    name: 'Ajith Pathmanathan',
    initials: 'AP',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    email: 'ajith@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'hashan-wijesinghe',
    startDate: '2025-08-03',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'ashkar-haris',
    name: 'Ashkar Haris',
    initials: 'AH',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    email: 'ashkar@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'hashan-wijesinghe',
    startDate: '2024-11-11',
    jurisdiction: 'Sri Lanka',
    employmentType: 'contract',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'charinda-dissanayake',
    name: 'Charinda Dissanayake',
    initials: 'CD',
    title: 'Sr. Software Engineer',
    department: 'Technology',
    email: 'charinda@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'hashan-wijesinghe',
    startDate: '2023-06-19',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'batool-abdullah',
    name: 'Batool Abdullah',
    initials: 'BA',
    title: 'Business Developer',
    department: 'Growth',
    email: 'batool@typeb.digital',
    timezone: 'Asia/Gaza',
    managerId: 'nabeel-syed',
    startDate: '2024-01-22',
    jurisdiction: 'Palestine',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'chamika-wijeratne',
    name: 'Chamika Wijeratne',
    initials: 'CW',
    title: 'Associate Product/Project Manager',
    department: 'Strategy',
    email: 'chamika@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'nabeel-syed',
    startDate: '2024-09-02',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'dinusha-randika',
    name: 'Dinusha Randika',
    initials: 'DR',
    title: 'Operations Coordinator',
    department: 'Operations',
    email: 'dinusha@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: 'nabeel-syed',
    startDate: '2023-10-10',
    jurisdiction: 'Sri Lanka',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'conor-burke-gaffney',
    name: 'Conor Burke-Gaffney',
    initials: 'CB',
    title: '',
    department: null,
    email: 'conor@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: null,
    startDate: '2025-05-01',
    jurisdiction: null,
    employmentType: null,
    payrollExcluded: true,
    syncedDaysAgo: 18,
  },
  {
    id: 'eduardo-tovar',
    name: 'Eduardo Tovar',
    initials: 'ET',
    title: '',
    department: null,
    email: 'eduardo@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: null,
    startDate: '2025-05-01',
    jurisdiction: null,
    employmentType: null,
    payrollExcluded: true,
    syncedDaysAgo: 18,
  },
]

function load(): Person[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedPeople
    const parsed = JSON.parse(raw) as Person[]
    // heal records saved before newer fields (jurisdiction, etc.) existed
    return parsed.map((p) => {
      const seed = seedPeople.find((s) => s.id === p.id)
      return { ...seed, ...p } as Person
    })
  } catch {
    return seedPeople
  }
}

function save(next: Person[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(p: Person[]) => void> = []
export let people: Person[] = load()

function setState(next: Person[]) {
  people = next
  save(people)
  listeners.forEach((l) => l(people))
}

export function updatePerson(id: string, patch: Partial<Person>) {
  setState(people.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const person = people.find((p) => p.id === id)
  showToast(`${person?.name ?? 'Record'} updated`, 'success')
}

export function usePeople(): Person[] {
  const [value, setValue] = useState(people)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function personById(id: string): Person | undefined {
  return people.find((p) => p.id === id)
}

export function localTimeFor(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date())
  } catch {
    return '—'
  }
}
