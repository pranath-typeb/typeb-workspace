export type Department = 'Technology' | 'Growth' | 'Strategy' | 'Operations' | 'People'

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
}

export const people: Person[] = [
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
  },
]

export const CURRENT_USER_ID = 'pranath-b'

people.unshift({
  id: CURRENT_USER_ID,
  name: 'Pranath',
  initials: 'PB',
  title: 'Founder',
  department: 'Strategy',
  email: 'pranath@typeb.digital',
  timezone: 'Asia/Colombo',
  managerId: null,
  startDate: '2021-01-04',
})

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
