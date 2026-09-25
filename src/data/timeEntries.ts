import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, personById } from './people'
import { projectById } from './projects'
import { showToast } from './toast'

export interface TimeEntry {
  id: string
  personId: string
  date: string // YYYY-MM-DD
  description: string
  projectId: string | null
  category: string
  minutes: number
}

export type SubmissionStatus = 'Not Submitted' | 'Pending' | 'Approved' | 'Rejected'

export interface WeekSubmission {
  id: string
  personId: string
  weekStart: string // YYYY-MM-DD, Monday
  status: SubmissionStatus
}

const ENTRIES_KEY = 'typeb-hr.time-entries.v1'
const SUBMISSIONS_KEY = 'typeb-hr.time-submissions.v1'

export const WEEKLY_TARGET_MINUTES = 40 * 60

// Formats a Date using its LOCAL calendar fields — never use toISOString() for
// this, since it converts to UTC first and silently shifts the date by a day
// in any timezone ahead of or behind UTC.
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLocal(): string {
  return toLocalDateStr(new Date())
}

export function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return toLocalDateStr(d)
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toLocalDateStr(d)
}

export function formatMinutes(mins: number): string {
  const sign = mins < 0 ? '-' : ''
  const abs = Math.abs(mins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

const today = todayLocal()
const thisWeekStart = weekStartFor(today)
const lastWeekStart = addDays(thisWeekStart, -7)
const twoWeeksAgoStart = addDays(thisWeekStart, -14)

const seedEntries: TimeEntry[] = [
  { id: 'te1', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 0), description: 'Daily standup', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 30 },
  { id: 'te2', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 0), description: 'Roadmap planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 60 },
  { id: 'te3', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 1), description: 'Investor update deck', projectId: null, category: 'Admin', minutes: 90 },
  { id: 'te4', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 1), description: 'Client feedback walkthrough', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 45 },
  { id: 'te5', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 2), description: 'Hiring pipeline review', projectId: null, category: 'Admin', minutes: 60 },
  { id: 'te6', personId: CURRENT_USER_ID, date: addDays(lastWeekStart, 0), description: 'Board prep', projectId: null, category: 'Admin', minutes: 120 },
  { id: 'te7', personId: CURRENT_USER_ID, date: addDays(lastWeekStart, 2), description: 'Vantage CRM kickoff', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 60 },
  { id: 'te8', personId: 'ajith-pathmanathan', date: addDays(thisWeekStart, 0), description: 'API integration', projectId: 'atlas-launch', category: 'Development', minutes: 240 },
  { id: 'te9', personId: 'ajith-pathmanathan', date: addDays(thisWeekStart, 1), description: 'Code review', projectId: 'atlas-launch', category: 'Code Review', minutes: 90 },
  { id: 'te10', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 0), description: 'Sprint planning', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 60 },
]

const seedSubmissions: WeekSubmission[] = [
  { id: 'ws1', personId: 'ajith-pathmanathan', weekStart: thisWeekStart, status: 'Pending' },
  { id: 'ws2', personId: 'hashan-wijesinghe', weekStart: twoWeeksAgoStart, status: 'Pending' },
]

function loadEntries(): TimeEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    return raw ? (JSON.parse(raw) as TimeEntry[]) : seedEntries
  } catch {
    return seedEntries
  }
}

function loadSubmissions(): WeekSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY)
    return raw ? (JSON.parse(raw) as WeekSubmission[]) : seedSubmissions
  } catch {
    return seedSubmissions
  }
}

function saveEntries(v: TimeEntry[]) {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(v))
  } catch {
    // ignore
  }
}

function saveSubmissions(v: WeekSubmission[]) {
  try {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(v))
  } catch {
    // ignore
  }
}

let entryListeners: Array<(v: TimeEntry[]) => void> = []
let entries: TimeEntry[] = loadEntries()

let subListeners: Array<(v: WeekSubmission[]) => void> = []
let submissions: WeekSubmission[] = loadSubmissions()

function setEntries(next: TimeEntry[]) {
  entries = next
  saveEntries(entries)
  entryListeners.forEach((l) => l(entries))
}

function setSubmissions(next: WeekSubmission[]) {
  submissions = next
  saveSubmissions(submissions)
  subListeners.forEach((l) => l(submissions))
}

export function addEntry(input: Omit<TimeEntry, 'id'>) {
  const entry: TimeEntry = { ...input, id: `te${Date.now()}` }
  setEntries([entry, ...entries])
  showToast(`Logged ${formatMinutes(entry.minutes)} — ${entry.description || 'Untitled entry'}`, 'success')
  return entry
}

export function deleteEntry(id: string) {
  setEntries(entries.filter((e) => e.id !== id))
}

export function useTimeEntries(): TimeEntry[] {
  const [value, setValue] = useState(entries)
  useEffect(() => {
    entryListeners.push(setValue)
    return () => {
      entryListeners = entryListeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function useSubmissions(): WeekSubmission[] {
  const [value, setValue] = useState(submissions)
  useEffect(() => {
    subListeners.push(setValue)
    return () => {
      subListeners = subListeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function submissionFor(personId: string, weekStart: string): WeekSubmission | undefined {
  return submissions.find((s) => s.personId === personId && s.weekStart === weekStart)
}

export function submitWeek(personId: string, weekStart: string) {
  const existing = submissionFor(personId, weekStart)
  if (existing) {
    setSubmissions(submissions.map((s) => (s.id === existing.id ? { ...s, status: 'Pending' } : s)))
  } else {
    setSubmissions([...submissions, { id: `ws${Date.now()}`, personId, weekStart, status: 'Pending' }])
  }
  showToast(`Week of ${formatWeekRange(weekStart)} submitted for review`, 'success')
}

export function reviewSubmission(id: string, status: 'Approved' | 'Rejected') {
  const sub = submissions.find((s) => s.id === id)
  setSubmissions(submissions.map((s) => (s.id === id ? { ...s, status } : s)))
  const person = sub ? personById(sub.personId) : undefined
  showToast(`${person?.name ?? 'Timesheet'}'s week ${status.toLowerCase()}`, status === 'Approved' ? 'success' : 'danger')
}

export function minutesForPersonDate(list: TimeEntry[], personId: string, date: string): number {
  return list.filter((e) => e.personId === personId && e.date === date).reduce((sum, e) => sum + e.minutes, 0)
}

export function minutesForPersonWeek(list: TimeEntry[], personId: string, weekStart: string): number {
  const end = addDays(weekStart, 6)
  return list.filter((e) => e.personId === personId && e.date >= weekStart && e.date <= end).reduce((sum, e) => sum + e.minutes, 0)
}

export function projectLabel(projectId: string | null): string {
  if (!projectId) return 'No project'
  return projectById(projectId)?.name ?? 'Unknown project'
}

// Counts past weeks (excluding the current week) with logged time that are
// still Not Submitted / Rejected — drives the Timesheets sidebar badge.
export function overdueWeekCount(list: TimeEntry[], subs: WeekSubmission[], personId: string): number {
  const currentWeek = weekStartFor(todayLocal())
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(currentWeek, -7 * (i + 1)))
  return weeks.filter((w) => {
    const minutes = minutesForPersonWeek(list, personId, w)
    if (minutes === 0) return false
    const sub = subs.find((s) => s.personId === personId && s.weekStart === w)
    return !sub || sub.status === 'Rejected'
  }).length
}
