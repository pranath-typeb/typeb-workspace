import { useEffect, useState } from 'react'
import { showToast } from './toast'
import { supabase } from '../lib/supabaseClient'
import pranathAvatar from '../assets/pranath-avatar.png'

export type Department = 'Technology' | 'Growth' | 'Strategy' | 'Operations' | 'People'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'

export const deptBadgeClass: Record<Department, string> = {
  Technology: 'b-pine',
  Growth: 'b-ember',
  Strategy: 'b-neutral',
  Operations: 'b-neutral',
  People: 'b-pine',
}

export interface EmergencyContact {
  name: string
  relationship: string
  email: string
  phone: string
}

export interface Person {
  id: string
  name: string
  initials: string
  avatarUrl?: string
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
  employeeId?: string | null
  phone?: string | null
  birthday?: string | null
  city?: string | null
  personalEmail?: string | null
  emergencyContact?: EmergencyContact | null
  bankName?: string | null
  bankAccountNo?: string | null
}

const STORAGE_KEY = 'typeb-hr.people.v1'

export const CURRENT_USER_ID = 'pranath-b'

const seedPeople: Person[] = [
  {
    id: CURRENT_USER_ID,
    name: 'Pranath',
    initials: 'PB',
    avatarUrl: pranathAvatar,
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
    employeeId: 'DSG-0956',
    phone: '+1 (416) 555-0138',
    birthday: '1998-09-20',
    city: 'Vavuniya',
    personalEmail: 'thivyapranathb@gmail.com',
    emergencyContact: { name: 'Kalaivani', relationship: 'Mother', email: 'bkalaivani@email.com', phone: '+1 (416) 555-0138' },
    bankName: 'Hatton National Bank',
    bankAccountNo: '0110200681456',
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
    employeeId: 'DSG-1042',
    bankName: 'Commercial Bank',
    bankAccountNo: '8001452207',
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
  // New joiners (started within the last 30 days) — exercise the Insights "New joiners" card
  {
    id: 'priya-nair',
    name: 'Priya Nair',
    initials: 'PN',
    title: 'Software Engineer (Frontend)',
    department: 'Technology',
    email: 'priya@typeb.digital',
    timezone: 'Asia/Kolkata',
    managerId: 'hashan-wijesinghe',
    startDate: '2026-09-10',
    jurisdiction: 'India',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 3,
  },
  {
    id: 'marcus-chen',
    name: 'Marcus Chen',
    initials: 'MC',
    title: 'Growth Marketer',
    department: 'Growth',
    email: 'marcus@typeb.digital',
    timezone: 'America/New_York',
    managerId: 'batool-abdullah',
    startDate: '2026-09-18',
    jurisdiction: 'United States',
    employmentType: 'contract',
    payrollExcluded: false,
    syncedDaysAgo: 1,
  },
  // Upcoming work anniversaries (within the next 30 days of "today") — exercise the Insights anniversaries card
  {
    id: 'layla-haddad',
    name: 'Layla Haddad',
    initials: 'LH',
    title: 'Operations Manager',
    department: 'Operations',
    email: 'layla@typeb.digital',
    timezone: 'Europe/London',
    managerId: 'dinusha-randika',
    startDate: '2022-10-05',
    jurisdiction: 'United Kingdom',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'tomas-rivera',
    name: 'Tomás Rivera',
    initials: 'TR',
    title: 'Strategy Analyst',
    department: 'Strategy',
    email: 'tomas@typeb.digital',
    timezone: 'America/Mexico_City',
    managerId: 'chamika-wijeratne',
    startDate: '2024-10-22',
    jurisdiction: 'Mexico',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  // More department / timezone / jurisdiction diversity
  {
    id: 'yuki-tanaka',
    name: 'Yuki Tanaka',
    initials: 'YT',
    title: 'Software Engineer (Mobile)',
    department: 'Technology',
    email: 'yuki@typeb.digital',
    timezone: 'Asia/Tokyo',
    managerId: 'hashan-wijesinghe',
    startDate: '2024-02-14',
    jurisdiction: 'Japan',
    employmentType: 'contract',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'amina-diallo',
    name: 'Amina Diallo',
    initials: 'AD',
    title: 'People Ops Partner',
    department: 'People',
    email: 'amina@typeb.digital',
    timezone: 'Africa/Lagos',
    managerId: 'nabeel-syed',
    startDate: '2023-05-08',
    jurisdiction: 'Nigeria',
    employmentType: 'part_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'oliver-bennett',
    name: 'Oliver Bennett',
    initials: 'OB',
    title: 'Business Developer',
    department: 'Growth',
    email: 'oliver@typeb.digital',
    timezone: 'Australia/Sydney',
    managerId: 'batool-abdullah',
    startDate: '2025-01-20',
    jurisdiction: 'Australia',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'sara-kowalski',
    name: 'Sara Kowalski',
    initials: 'SK',
    title: 'Operations Coordinator',
    department: 'Operations',
    email: 'sara@typeb.digital',
    timezone: 'Europe/Warsaw',
    managerId: 'dinusha-randika',
    startDate: '2024-06-30',
    jurisdiction: 'Poland',
    employmentType: 'full_time',
    payrollExcluded: true,
    syncedDaysAgo: 45,
  },
  // Edge case: no title, no department, no jurisdiction — mirrors conor/eduardo
  {
    id: 'jordan-lee',
    name: 'Jordan Lee',
    initials: 'JL',
    title: '',
    department: null,
    email: 'jordan@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: null,
    startDate: '2025-05-01',
    jurisdiction: null,
    employmentType: null,
    payrollExcluded: true,
    syncedDaysAgo: 60,
  },
  // Deeper org chart — Engineering Manager with reports of their own
  {
    id: 'devon-marsh',
    name: 'Devon Marsh',
    initials: 'DM',
    title: 'Engineering Manager',
    department: 'Technology',
    email: 'devon@typeb.digital',
    timezone: 'America/Los_Angeles',
    managerId: 'faran-siddiqui',
    startDate: '2023-01-10',
    jurisdiction: 'United States',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
    employeeId: 'DSG-1108',
    phone: '+1 (415) 555-0122',
    birthday: '1990-03-11',
    city: 'San Francisco',
    personalEmail: 'devon.marsh@gmail.com',
    emergencyContact: { name: 'Rachel Marsh', relationship: 'Spouse', email: 'rachel.marsh@gmail.com', phone: '+1 (415) 555-0199' },
    bankName: 'Chase Bank',
    bankAccountNo: '4009331127',
  },
  {
    id: 'isabela-costa',
    name: 'Isabela Costa',
    initials: 'IC',
    title: 'Software Engineer (Frontend)',
    department: 'Technology',
    email: 'isabela@typeb.digital',
    timezone: 'America/Sao_Paulo',
    managerId: 'devon-marsh',
    startDate: '2024-05-01',
    jurisdiction: 'Brazil',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
    employeeId: 'DSG-1156',
    phone: '+55 11 5555-0143',
    birthday: '1996-07-22',
    city: 'São Paulo',
    personalEmail: 'isabela.costa@gmail.com',
    emergencyContact: { name: 'Marcos Costa', relationship: 'Father', email: 'marcos.costa@gmail.com', phone: '+55 11 5555-0177' },
    bankName: 'Banco do Brasil',
    bankAccountNo: '5512340098',
  },
  {
    id: 'kwame-mensah',
    name: 'Kwame Mensah',
    initials: 'KM',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    email: 'kwame@typeb.digital',
    timezone: 'Africa/Accra',
    managerId: 'devon-marsh',
    startDate: '2023-09-01',
    jurisdiction: 'Ghana',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
    employeeId: 'DSG-1120',
    bankName: 'GCB Bank',
    bankAccountNo: '2201456789',
  },
  {
    id: 'nadia-rahman',
    name: 'Nadia Rahman',
    initials: 'NR',
    title: 'QA Engineer',
    department: 'Technology',
    email: 'nadia@typeb.digital',
    timezone: 'Asia/Dhaka',
    managerId: 'hashan-wijesinghe',
    startDate: '2024-03-15',
    jurisdiction: 'Bangladesh',
    employmentType: 'contract',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'felix-huber',
    name: 'Felix Huber',
    initials: 'FH',
    title: 'DevOps Engineer',
    department: 'Technology',
    email: 'felix@typeb.digital',
    timezone: 'Europe/Berlin',
    managerId: 'hashan-wijesinghe',
    startDate: '2025-02-01',
    jurisdiction: 'Germany',
    employmentType: 'contract',
    payrollExcluded: false,
    syncedDaysAgo: 30,
  },
  {
    id: 'meera-pillai',
    name: 'Meera Pillai',
    initials: 'MP',
    title: 'Software Engineer (Backend)',
    department: 'Technology',
    email: 'meera@typeb.digital',
    timezone: 'Asia/Kolkata',
    managerId: 'devon-marsh',
    startDate: '2024-11-01',
    jurisdiction: 'India',
    employmentType: 'part_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  // Deeper org chart — new joiner reporting to another new person, who reports up to Batool
  {
    id: 'diego-alvarez',
    name: 'Diego Alvarez',
    initials: 'DA',
    title: 'Sales Development Rep',
    department: 'Growth',
    email: 'diego@typeb.digital',
    timezone: 'America/Bogota',
    managerId: 'batool-abdullah',
    startDate: '2022-06-01',
    jurisdiction: 'Colombia',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'grace-kim',
    name: 'Grace Kim',
    initials: 'GK',
    title: 'Business Developer',
    department: 'Growth',
    email: 'grace@typeb.digital',
    timezone: 'Asia/Seoul',
    managerId: 'batool-abdullah',
    startDate: '2024-08-15',
    jurisdiction: 'South Korea',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'henrik-larsen',
    name: 'Henrik Larsen',
    initials: 'HL',
    title: 'Strategy Analyst',
    department: 'Strategy',
    email: 'henrik@typeb.digital',
    timezone: 'Europe/Copenhagen',
    managerId: 'chamika-wijeratne',
    startDate: '2023-04-01',
    jurisdiction: 'Denmark',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'aaliyah-johnson',
    name: 'Aaliyah Johnson',
    initials: 'AJ',
    title: 'Product Manager',
    department: 'Strategy',
    email: 'aaliyah@typeb.digital',
    timezone: 'America/Chicago',
    managerId: 'nabeel-syed',
    startDate: '2022-11-01',
    jurisdiction: 'United States',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
    employeeId: 'DSG-1033',
    phone: '+1 (312) 555-0164',
    birthday: '1992-01-30',
    city: 'Chicago',
    personalEmail: 'aaliyah.johnson@gmail.com',
    emergencyContact: { name: 'Marcus Johnson', relationship: 'Spouse', email: 'marcus.johnson@gmail.com', phone: '+1 (312) 555-0188' },
    bankName: 'Wells Fargo',
    bankAccountNo: '3300778812',
  },
  {
    id: 'fatima-al-sayed',
    name: 'Fatima Al-Sayed',
    initials: 'FA',
    title: 'HR Coordinator',
    department: 'People',
    email: 'fatima@typeb.digital',
    timezone: 'Asia/Dubai',
    managerId: 'amina-diallo',
    startDate: '2023-07-01',
    jurisdiction: 'United Arab Emirates',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
    employeeId: 'DSG-1077',
    phone: '+971 4 555-0190',
    birthday: '1995-12-02',
    city: 'Dubai',
    personalEmail: 'fatima.alsayed@gmail.com',
    emergencyContact: { name: 'Layla Al-Sayed', relationship: 'Sister', email: 'layla.alsayed@gmail.com', phone: '+971 4 555-0191' },
    bankName: 'Emirates NBD',
    bankAccountNo: '1019887765',
  },
  // Deeper org chart — Operations Analyst reporting to Layla, with their own report below
  {
    id: 'viktor-petrov',
    name: 'Viktor Petrov',
    initials: 'VP',
    title: 'Operations Analyst',
    department: 'Operations',
    email: 'viktor@typeb.digital',
    timezone: 'Europe/Sofia',
    managerId: 'layla-haddad',
    startDate: '2022-09-01',
    jurisdiction: 'Bulgaria',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'chloe-dubois',
    name: 'Chloe Dubois',
    initials: 'CD',
    title: 'Operations Coordinator',
    department: 'Operations',
    email: 'chloe@typeb.digital',
    timezone: 'Europe/Paris',
    managerId: 'dinusha-randika',
    startDate: '2024-04-01',
    jurisdiction: 'France',
    employmentType: 'part_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
  {
    id: 'rohan-kapoor',
    name: 'Rohan Kapoor',
    initials: 'RK',
    title: 'Talent Acquisition Specialist',
    department: 'People',
    email: 'rohan@typeb.digital',
    timezone: 'Asia/Kolkata',
    managerId: 'amina-diallo',
    startDate: '2023-02-01',
    jurisdiction: 'India',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
    employeeId: 'DSG-1089',
    phone: '+91 98765 55012',
    birthday: '1994-06-18',
    city: 'Bengaluru',
    personalEmail: 'rohan.kapoor@gmail.com',
    emergencyContact: { name: 'Anjali Kapoor', relationship: 'Mother', email: 'anjali.kapoor@gmail.com', phone: '+91 98765 55099' },
    bankName: 'HDFC Bank',
    bankAccountNo: '6677889900',
  },
  // Edge case: blank title/department/jurisdiction, no manager — mirrors conor/eduardo/jordan
  {
    id: 'samuel-osei',
    name: 'Samuel Osei',
    initials: 'SO',
    title: '',
    department: null,
    email: 'samuel@typeb.digital',
    timezone: 'Asia/Colombo',
    managerId: null,
    startDate: '2025-05-01',
    jurisdiction: null,
    employmentType: null,
    payrollExcluded: true,
    syncedDaysAgo: 60,
  },
  // New joiner (started within the last 30 days) reporting to another new person — deepens the org chart
  {
    id: 'lucia-fernandez',
    name: 'Lucia Fernandez',
    initials: 'LF',
    title: 'Business Developer',
    department: 'Growth',
    email: 'lucia@typeb.digital',
    timezone: 'America/Santiago',
    managerId: 'diego-alvarez',
    startDate: '2026-09-22',
    jurisdiction: 'Chile',
    employmentType: 'contract',
    payrollExcluded: false,
    syncedDaysAgo: 2,
  },
  // Upcoming work anniversary (within the next 30 days) — exercises the Insights anniversaries card
  {
    id: 'ben-okafor',
    name: 'Ben Okafor',
    initials: 'BO',
    title: 'Operations Analyst',
    department: 'Operations',
    email: 'ben@typeb.digital',
    timezone: 'Africa/Lagos',
    managerId: 'viktor-petrov',
    startDate: '2021-10-12',
    jurisdiction: 'Nigeria',
    employmentType: 'full_time',
    payrollExcluded: false,
    syncedDaysAgo: 18,
  },
]

// Read-only Supabase mirror of this table (see src/lib/supabaseClient.ts). The app has no
// login system, so every browser shares the same public API key — there's no way for
// Postgres row-level security to tell "you" apart from anyone else holding that key. Until
// real auth exists, we only grant that key SELECT (see the RLS policy in the project), so
// hydration below is read-only: it can pull the latest rows down, but all edits
// (updatePerson etc.) keep writing to localStorage only, same as before this table existed.
interface PersonRow {
  id: string
  name: string
  initials: string
  avatar_url: string | null
  title: string
  department: Department | null
  email: string
  timezone: string
  manager_id: string | null
  start_date: string
  jurisdiction: string | null
  employment_type: EmploymentType | null
  payroll_excluded: boolean
  synced_days_ago: number
  employee_id: string | null
  phone: string | null
  birthday: string | null
  city: string | null
  personal_email: string | null
  emergency_contact: EmergencyContact | null
  bank_name: string | null
  bank_account_no: string | null
}

function personFromRow(row: PersonRow): Person {
  // Avatar photos live as bundled local assets, not DB blobs — fall back to the seed's
  // avatarUrl (if any) when the row itself has none.
  const seedAvatar = seedPeople.find((p) => p.id === row.id)?.avatarUrl
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    avatarUrl: row.avatar_url ?? seedAvatar,
    title: row.title,
    department: row.department,
    email: row.email,
    timezone: row.timezone,
    managerId: row.manager_id,
    startDate: row.start_date,
    jurisdiction: row.jurisdiction,
    employmentType: row.employment_type,
    payrollExcluded: row.payroll_excluded,
    syncedDaysAgo: row.synced_days_ago,
    employeeId: row.employee_id,
    phone: row.phone,
    birthday: row.birthday,
    city: row.city,
    personalEmail: row.personal_email,
    emergencyContact: row.emergency_contact,
    bankName: row.bank_name,
    bankAccountNo: row.bank_account_no,
  }
}

async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('people').select('*').order('name')
  if (error || !data) return
  setState(data.map((row) => personFromRow(row as PersonRow)))
}

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

// Kick off a one-time background refresh from Supabase — the UI already has the
// localStorage/seed data to render immediately, this just brings it up to date once
// the network round-trip resolves (or leaves it as-is if the fetch fails).
hydrateFromSupabase()

export function updatePerson(id: string, patch: Partial<Person>) {
  setState(people.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const person = people.find((p) => p.id === id)
  showToast(`${person?.name ?? 'Record'} updated`, 'success')
}

export function resyncPerson(id: string) {
  setState(people.map((p) => (p.id === id ? { ...p, syncedDaysAgo: 0 } : p)))
  const person = people.find((p) => p.id === id)
  showToast(`${person?.name ?? 'Record'} re-synced from Nucleus`, 'success')
}

export function resyncAllPeople() {
  setState(people.map((p) => ({ ...p, syncedDaysAgo: 0 })))
  showToast(`All ${people.length} records re-synced from Nucleus`, 'success')
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
