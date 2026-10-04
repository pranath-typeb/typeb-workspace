import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, personById } from './people'
import { projectById } from './projects'
import { showToast } from './toast'
import { supabase } from '../lib/supabaseClient'

export interface TimeEntry {
  id: string
  personId: string
  date: string // YYYY-MM-DD
  description: string
  projectId: string | null
  category: string
  minutes: number
  startMinutes?: number // minutes since local midnight — powers the week-grid Calendar view
  billable?: boolean
}

export type SubmissionStatus = 'Not Submitted' | 'Pending' | 'Approved' | 'Rejected'

// A submission needs sign-off from both the employee's Line Manager and HR before it's
// fully 'Approved' — either stage rejecting rejects the whole submission.
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'
export type ReviewStage = 'lm' | 'hr'

export interface SubmissionHistoryEntry {
  label: string
  at: string // ISO timestamp
  // Tags the entries that drive the recall-request state machine below — the
  // *last* history entry of this kind tells you whether a recall is currently
  // pending, so no separate field (and no schema change) is needed.
  kind?: 'recall-requested' | 'recall-approved' | 'recall-denied'
  reason?: string
}

export interface WeekSubmission {
  id: string
  personId: string
  weekStart: string // YYYY-MM-DD, Monday
  status: SubmissionStatus // aggregate of lmStatus + hrStatus
  comment?: string // most recent rejection note, set when status is 'Rejected'
  lmStatus: ApprovalStatus
  lmBy?: string // reviewer name
  lmAt?: string // ISO timestamp
  hrStatus: ApprovalStatus
  hrBy?: string
  hrAt?: string
  history: SubmissionHistoryEntry[]
}

const ENTRIES_KEY = 'typeb-hr.time-entries.v1'
const SUBMISSIONS_KEY = 'typeb-hr.time-submissions.v1'

export const WEEKLY_TARGET_MINUTES = 40 * 60

export const CATEGORIES = ['Development', 'Code Review', 'Meetings & Calls', 'Admin', 'Manual', 'Design', 'Research']

// Shared category → color mapping, used by both the Calendar week-grid (entry block accents)
// and Reporting (category bars/legend) so the same category always reads as the same color.
export const CATEGORY_COLORS: Record<string, string> = {
  Development: '#1f8a85',
  'Code Review': '#3a8f8c',
  'Meetings & Calls': '#3b82f6',
  Admin: '#ff6d33',
  Manual: '#94a3b8',
  Design: '#c084fc',
  Research: '#eab308',
}
export const DEFAULT_CATEGORY_COLOR = '#5f636c'

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR
}

// Color used to flag time logged with no project attached — distinct from the category
// palette since "no project" is a data-hygiene concern, not a category.
export const NO_PROJECT_COLOR = '#cc3a00'

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

export function formatTimeOfDay(startMinutes: number): string {
  const h24 = Math.floor(startMinutes / 60) % 24
  const m = startMinutes % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function formatTimeRange(startMinutes: number, minutes: number): string {
  return `${formatTimeOfDay(startMinutes)} – ${formatTimeOfDay(startMinutes + minutes)}`
}

// Pay cycle runs the 25th through the 24th of the following month (matches payroll.ts's
// "Aug 25 – Sep 24" style cycles) — used to group the Timesheets month carousel.
export function payCycleRangeFor(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  const y = d.getFullYear()
  const m = d.getMonth()
  const startMonth = day >= 25 ? m : m - 1
  return { start: toLocalDateStr(new Date(y, startMonth, 25)), end: toLocalDateStr(new Date(y, startMonth + 1, 24)) }
}

// Every Monday-aligned week start whose week overlaps the given inclusive date range.
export function weeksOverlapping(rangeStart: string, rangeEnd: string): string[] {
  const weeks: string[] = []
  let w = weekStartFor(rangeStart)
  while (w <= rangeEnd) {
    weeks.push(w)
    w = addDays(w, 7)
  }
  return weeks
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
const threeWeeksAgoStart = addDays(thisWeekStart, -21)
const fourWeeksAgoStart = addDays(thisWeekStart, -28)
const fiveWeeksAgoStart = addDays(thisWeekStart, -35)
const sixWeeksAgoStart = addDays(thisWeekStart, -42)
const sevenWeeksAgoStart = addDays(thisWeekStart, -49)

const seedEntries: TimeEntry[] = [
  { id: 'te1', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 0), description: 'Daily standup', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 30, startMinutes: 9 * 60 },
  { id: 'te2', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 0), description: 'Roadmap planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 60, startMinutes: 10 * 60 },
  { id: 'te3', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 1), description: 'Investor update deck', projectId: null, category: 'Admin', minutes: 90, startMinutes: 9 * 60 + 30 },
  { id: 'te4', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 1), description: 'Client feedback walkthrough', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 45, startMinutes: 13 * 60 },
  { id: 'te5', personId: CURRENT_USER_ID, date: addDays(thisWeekStart, 2), description: 'Hiring pipeline review', projectId: null, category: 'Admin', minutes: 60, startMinutes: 11 * 60 },
  { id: 'te6', personId: CURRENT_USER_ID, date: addDays(lastWeekStart, 0), description: 'Board prep', projectId: null, category: 'Admin', minutes: 120, startMinutes: 9 * 60 },
  { id: 'te7', personId: CURRENT_USER_ID, date: addDays(lastWeekStart, 2), description: 'Vantage CRM kickoff', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 60, startMinutes: 14 * 60 },
  { id: 'te8', personId: 'ajith-pathmanathan', date: addDays(thisWeekStart, 0), description: 'API integration', projectId: 'atlas-launch', category: 'Development', minutes: 240, startMinutes: 9 * 60 },
  { id: 'te9', personId: 'ajith-pathmanathan', date: addDays(thisWeekStart, 1), description: 'Code review', projectId: 'atlas-launch', category: 'Code Review', minutes: 90, startMinutes: 14 * 60 },
  { id: 'te10', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 0), description: 'Sprint planning', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 60, startMinutes: 9 * 60 },
  { id: 'te11', personId: 'ajith-pathmanathan', date: addDays(lastWeekStart, 0), description: 'API integration', projectId: 'atlas-launch', category: 'Development', minutes: 280, startMinutes: 540, billable: true },
  { id: 'te12', personId: 'ajith-pathmanathan', date: addDays(lastWeekStart, 1), description: 'Bug fixes', projectId: 'atlas-launch', category: 'Development', minutes: 465, startMinutes: 540, billable: true },
  { id: 'te13', personId: 'ajith-pathmanathan', date: addDays(lastWeekStart, 1), description: 'Daily standup', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 140, startMinutes: 1005, billable: false },
  { id: 'te14', personId: 'ajith-pathmanathan', date: addDays(lastWeekStart, 2), description: 'Reviewing teammate PRs', projectId: 'echo-migration', category: 'Code Review', minutes: 295, startMinutes: 540, billable: true },
  { id: 'te15', personId: 'ajith-pathmanathan', date: addDays(lastWeekStart, 3), description: 'Refactoring service layer', projectId: 'echo-integration', category: 'Development', minutes: 165, startMinutes: 540, billable: true },
  { id: 'te16', personId: 'ajith-pathmanathan', date: addDays(lastWeekStart, 4), description: 'PR review', projectId: 'atlas-launch', category: 'Code Review', minutes: 480, startMinutes: 540, billable: true },
  { id: 'te17', personId: 'ajith-pathmanathan', date: addDays(twoWeeksAgoStart, 0), description: 'Sprint planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 280, startMinutes: 540, billable: true },
  { id: 'te18', personId: 'ajith-pathmanathan', date: addDays(twoWeeksAgoStart, 1), description: 'PR review', projectId: 'echo-migration', category: 'Code Review', minutes: 490, startMinutes: 540, billable: true },
  { id: 'te19', personId: 'ajith-pathmanathan', date: addDays(twoWeeksAgoStart, 2), description: 'PR review', projectId: 'echo-migration', category: 'Code Review', minutes: 175, startMinutes: 540, billable: true },
  { id: 'te20', personId: 'ajith-pathmanathan', date: addDays(twoWeeksAgoStart, 3), description: 'Client sync call', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 495, startMinutes: 540 },
  { id: 'te21', personId: 'ajith-pathmanathan', date: addDays(threeWeeksAgoStart, 1), description: 'Feature implementation', projectId: 'echo-integration', category: 'Development', minutes: 540, startMinutes: 540, billable: true },
  { id: 'te22', personId: 'ajith-pathmanathan', date: addDays(threeWeeksAgoStart, 1), description: 'Building UI components', projectId: 'echo-migration', category: 'Development', minutes: 55, startMinutes: 1095, billable: true },
  { id: 'te23', personId: 'ajith-pathmanathan', date: addDays(threeWeeksAgoStart, 2), description: 'Bug fixes', projectId: 'atlas-launch', category: 'Development', minutes: 150, startMinutes: 540, billable: true },
  { id: 'te24', personId: 'ajith-pathmanathan', date: addDays(threeWeeksAgoStart, 2), description: 'Performance tuning', projectId: 'echo-migration', category: 'Development', minutes: 320, startMinutes: 690, billable: true },
  { id: 'te25', personId: 'ajith-pathmanathan', date: addDays(threeWeeksAgoStart, 4), description: 'Code review', projectId: 'echo-migration', category: 'Code Review', minutes: 295, startMinutes: 540 },
  { id: 'te26', personId: 'ajith-pathmanathan', date: addDays(fourWeeksAgoStart, 0), description: 'Daily standup', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 275, startMinutes: 540, billable: true },
  { id: 'te27', personId: 'ajith-pathmanathan', date: addDays(fourWeeksAgoStart, 2), description: 'Bug fixes', projectId: 'echo-integration', category: 'Development', minutes: 295, startMinutes: 540, billable: true },
  { id: 'te28', personId: 'ajith-pathmanathan', date: addDays(fourWeeksAgoStart, 3), description: 'PR review', projectId: 'echo-migration', category: 'Code Review', minutes: 355, startMinutes: 540, billable: true },
  { id: 'te29', personId: 'ajith-pathmanathan', date: addDays(fourWeeksAgoStart, 3), description: 'Performance tuning', projectId: 'echo-integration', category: 'Development', minutes: 85, startMinutes: 895, billable: true },
  { id: 'te30', personId: 'ajith-pathmanathan', date: addDays(fiveWeeksAgoStart, 1), description: 'Writing unit tests', projectId: 'echo-migration', category: 'Development', minutes: 440, startMinutes: 540 },
  { id: 'te31', personId: 'ajith-pathmanathan', date: addDays(fiveWeeksAgoStart, 2), description: 'Reviewing teammate PRs', projectId: 'atlas-launch', category: 'Code Review', minutes: 85, startMinutes: 540, billable: true },
  { id: 'te32', personId: 'ajith-pathmanathan', date: addDays(fiveWeeksAgoStart, 2), description: 'Building UI components', projectId: 'echo-migration', category: 'Development', minutes: 155, startMinutes: 625, billable: true },
  { id: 'te33', personId: 'ajith-pathmanathan', date: addDays(fiveWeeksAgoStart, 3), description: 'Writing unit tests', projectId: 'echo-integration', category: 'Development', minutes: 155, startMinutes: 540, billable: true },
  { id: 'te34', personId: 'ajith-pathmanathan', date: addDays(fiveWeeksAgoStart, 4), description: 'Refactoring service layer', projectId: 'atlas-launch', category: 'Development', minutes: 125, startMinutes: 540, billable: true },
  { id: 'te35', personId: 'ajith-pathmanathan', date: addDays(fiveWeeksAgoStart, 4), description: 'Code review', projectId: 'echo-integration', category: 'Code Review', minutes: 115, startMinutes: 665, billable: true },
  { id: 'te36', personId: 'ajith-pathmanathan', date: addDays(sixWeeksAgoStart, 0), description: 'Building UI components', projectId: 'echo-migration', category: 'Development', minutes: 275, startMinutes: 540, billable: true },
  { id: 'te37', personId: 'ajith-pathmanathan', date: addDays(sixWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 170, startMinutes: 845 },
  { id: 'te38', personId: 'ajith-pathmanathan', date: addDays(sixWeeksAgoStart, 4), description: 'Roadmap planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 345, startMinutes: 540, billable: false },
  { id: 'te39', personId: 'ajith-pathmanathan', date: addDays(sixWeeksAgoStart, 4), description: 'Bug fixes', projectId: 'echo-migration', category: 'Development', minutes: 95, startMinutes: 885, billable: true },
  { id: 'te40', personId: 'ajith-pathmanathan', date: addDays(sevenWeeksAgoStart, 0), description: 'PR review', projectId: 'echo-migration', category: 'Code Review', minutes: 300, startMinutes: 540, billable: true },
  { id: 'te41', personId: 'ajith-pathmanathan', date: addDays(sevenWeeksAgoStart, 2), description: 'Stakeholder update', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 330, startMinutes: 540, billable: true },
  { id: 'te42', personId: 'ajith-pathmanathan', date: addDays(sevenWeeksAgoStart, 2), description: 'Stakeholder update', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 175, startMinutes: 870 },
  { id: 'te43', personId: 'ajith-pathmanathan', date: addDays(sevenWeeksAgoStart, 4), description: 'Database migration script', projectId: 'echo-migration', category: 'Development', minutes: 290, startMinutes: 540, billable: true },
  { id: 'te44', personId: 'ashkar-haris', date: addDays(lastWeekStart, 0), description: 'Bug fixes', projectId: 'echo-migration', category: 'Development', minutes: 490, startMinutes: 540, billable: true },
  { id: 'te45', personId: 'ashkar-haris', date: addDays(lastWeekStart, 1), description: 'Sprint retro', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 490, startMinutes: 540 },
  { id: 'te46', personId: 'ashkar-haris', date: addDays(lastWeekStart, 2), description: 'Building UI components', projectId: 'echo-integration', category: 'Development', minutes: 260, startMinutes: 540, billable: true },
  { id: 'te47', personId: 'ashkar-haris', date: addDays(lastWeekStart, 2), description: 'Refactoring service layer', projectId: 'echo-migration', category: 'Development', minutes: 185, startMinutes: 815, billable: true },
  { id: 'te48', personId: 'ashkar-haris', date: addDays(lastWeekStart, 3), description: 'Code review', projectId: 'echo-migration', category: 'Code Review', minutes: 395, startMinutes: 540 },
  { id: 'te49', personId: 'ashkar-haris', date: addDays(lastWeekStart, 3), description: 'Building UI components', projectId: 'echo-migration', category: 'Development', minutes: 45, startMinutes: 935, billable: true },
  { id: 'te50', personId: 'ashkar-haris', date: addDays(twoWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 490, startMinutes: 540 },
  { id: 'te51', personId: 'ashkar-haris', date: addDays(twoWeeksAgoStart, 1), description: 'Bug fixes', projectId: 'echo-migration', category: 'Development', minutes: 210, startMinutes: 540, billable: true },
  { id: 'te52', personId: 'ashkar-haris', date: addDays(twoWeeksAgoStart, 2), description: 'PR review', projectId: 'echo-integration', category: 'Code Review', minutes: 460, startMinutes: 540, billable: true },
  { id: 'te53', personId: 'ashkar-haris', date: addDays(twoWeeksAgoStart, 2), description: 'Code review', projectId: 'echo-migration', category: 'Code Review', minutes: 115, startMinutes: 1030, billable: true },
  { id: 'te54', personId: 'ashkar-haris', date: addDays(twoWeeksAgoStart, 3), description: 'Writing unit tests', projectId: 'echo-integration', category: 'Development', minutes: 155, startMinutes: 540, billable: true },
  { id: 'te55', personId: 'ashkar-haris', date: addDays(threeWeeksAgoStart, 0), description: 'Bug fixes', projectId: 'echo-integration', category: 'Development', minutes: 75, startMinutes: 540, billable: true },
  { id: 'te56', personId: 'ashkar-haris', date: addDays(threeWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'echo-migration', category: 'Development', minutes: 505, startMinutes: 615, billable: true },
  { id: 'te57', personId: 'ashkar-haris', date: addDays(threeWeeksAgoStart, 1), description: 'PR review', projectId: 'echo-integration', category: 'Code Review', minutes: 195, startMinutes: 540, billable: true },
  { id: 'te58', personId: 'ashkar-haris', date: addDays(threeWeeksAgoStart, 2), description: 'Building UI components', projectId: 'echo-migration', category: 'Development', minutes: 265, startMinutes: 540, billable: true },
  { id: 'te59', personId: 'ashkar-haris', date: addDays(threeWeeksAgoStart, 3), description: 'Database migration script', projectId: 'echo-integration', category: 'Development', minutes: 445, startMinutes: 540, billable: true },
  { id: 'te60', personId: 'ashkar-haris', date: addDays(threeWeeksAgoStart, 4), description: 'API integration', projectId: 'echo-integration', category: 'Development', minutes: 165, startMinutes: 540, billable: true },
  { id: 'te61', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 0), description: 'Performance tuning', projectId: 'echo-integration', category: 'Development', minutes: 180, startMinutes: 540, billable: true },
  { id: 'te62', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'echo-migration', category: 'Development', minutes: 330, startMinutes: 750 },
  { id: 'te63', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 1), description: 'Database migration script', projectId: 'echo-integration', category: 'Development', minutes: 345, startMinutes: 540, billable: true },
  { id: 'te64', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 1), description: 'Performance tuning', projectId: 'echo-migration', category: 'Development', minutes: 280, startMinutes: 915, billable: true },
  { id: 'te65', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 2), description: 'Writing unit tests', projectId: 'echo-integration', category: 'Development', minutes: 35, startMinutes: 540, billable: true },
  { id: 'te66', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 2), description: 'Daily standup', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 585, startMinutes: 575 },
  { id: 'te67', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 4), description: 'Stakeholder update', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 365, startMinutes: 540 },
  { id: 'te68', personId: 'ashkar-haris', date: addDays(fourWeeksAgoStart, 4), description: 'Writing unit tests', projectId: 'echo-integration', category: 'Development', minutes: 75, startMinutes: 935, billable: true },
  { id: 'te69', personId: 'charinda-dissanayake', date: addDays(lastWeekStart, 0), description: 'Bug fixes', projectId: 'echo-migration', category: 'Development', minutes: 330, startMinutes: 540, billable: true },
  { id: 'te70', personId: 'charinda-dissanayake', date: addDays(lastWeekStart, 0), description: 'Building UI components', projectId: 'cobalt-launch', category: 'Development', minutes: 180, startMinutes: 885, billable: true },
  { id: 'te71', personId: 'charinda-dissanayake', date: addDays(lastWeekStart, 1), description: 'Performance tuning', projectId: 'echo-migration', category: 'Development', minutes: 165, startMinutes: 540, billable: true },
  { id: 'te72', personId: 'charinda-dissanayake', date: addDays(lastWeekStart, 1), description: 'Performance tuning', projectId: 'cobalt-launch', category: 'Development', minutes: 315, startMinutes: 705, billable: true },
  { id: 'te73', personId: 'charinda-dissanayake', date: addDays(lastWeekStart, 2), description: 'Performance tuning', projectId: 'cobalt-launch', category: 'Development', minutes: 240, startMinutes: 540, billable: true },
  { id: 'te74', personId: 'charinda-dissanayake', date: addDays(lastWeekStart, 2), description: 'Roadmap planning', projectId: 'cobalt-launch', category: 'Meetings & Calls', minutes: 380, startMinutes: 780 },
  { id: 'te75', personId: 'charinda-dissanayake', date: addDays(twoWeeksAgoStart, 1), description: 'Performance tuning', projectId: 'cobalt-launch', category: 'Development', minutes: 130, startMinutes: 540, billable: true },
  { id: 'te76', personId: 'charinda-dissanayake', date: addDays(twoWeeksAgoStart, 1), description: '1:1 with manager', projectId: 'cobalt-launch', category: 'Meetings & Calls', minutes: 480, startMinutes: 685 },
  { id: 'te77', personId: 'charinda-dissanayake', date: addDays(twoWeeksAgoStart, 2), description: 'Writing unit tests', projectId: 'cobalt-launch', category: 'Development', minutes: 270, startMinutes: 540, billable: true },
  { id: 'te78', personId: 'charinda-dissanayake', date: addDays(twoWeeksAgoStart, 3), description: 'Bug fixes', projectId: 'echo-migration', category: 'Development', minutes: 445, startMinutes: 540, billable: true },
  { id: 'te79', personId: 'charinda-dissanayake', date: addDays(threeWeeksAgoStart, 0), description: 'Daily standup', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 480, startMinutes: 540, billable: true },
  { id: 'te80', personId: 'charinda-dissanayake', date: addDays(threeWeeksAgoStart, 1), description: 'PR review', projectId: 'cobalt-launch', category: 'Code Review', minutes: 255, startMinutes: 540, billable: true },
  { id: 'te81', personId: 'charinda-dissanayake', date: addDays(threeWeeksAgoStart, 3), description: 'Writing unit tests', projectId: 'cobalt-launch', category: 'Development', minutes: 130, startMinutes: 540, billable: true },
  { id: 'te82', personId: 'charinda-dissanayake', date: addDays(threeWeeksAgoStart, 3), description: 'Stakeholder update', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 305, startMinutes: 700, billable: false },
  { id: 'te83', personId: 'charinda-dissanayake', date: addDays(threeWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'echo-migration', category: 'Code Review', minutes: 425, startMinutes: 540, billable: true },
  { id: 'te84', personId: 'charinda-dissanayake', date: addDays(fourWeeksAgoStart, 1), description: 'Bug fixes', projectId: 'echo-migration', category: 'Development', minutes: 490, startMinutes: 540 },
  { id: 'te85', personId: 'charinda-dissanayake', date: addDays(fourWeeksAgoStart, 2), description: 'Feature implementation', projectId: 'cobalt-launch', category: 'Development', minutes: 425, startMinutes: 540, billable: true },
  { id: 'te86', personId: 'charinda-dissanayake', date: addDays(fourWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 215, startMinutes: 540 },
  { id: 'te87', personId: 'charinda-dissanayake', date: addDays(fiveWeeksAgoStart, 0), description: 'Sprint planning', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 265, startMinutes: 540, billable: true },
  { id: 'te88', personId: 'charinda-dissanayake', date: addDays(fiveWeeksAgoStart, 1), description: 'Reviewing teammate PRs', projectId: 'echo-migration', category: 'Code Review', minutes: 245, startMinutes: 540 },
  { id: 'te89', personId: 'charinda-dissanayake', date: addDays(fiveWeeksAgoStart, 2), description: 'Client sync call', projectId: 'cobalt-launch', category: 'Meetings & Calls', minutes: 205, startMinutes: 540 },
  { id: 'te90', personId: 'charinda-dissanayake', date: addDays(fiveWeeksAgoStart, 3), description: 'Bug fixes', projectId: 'cobalt-launch', category: 'Development', minutes: 160, startMinutes: 540 },
  { id: 'te91', personId: 'charinda-dissanayake', date: addDays(fiveWeeksAgoStart, 3), description: 'Client sync call', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 435, startMinutes: 730, billable: true },
  { id: 'te92', personId: 'charinda-dissanayake', date: addDays(fiveWeeksAgoStart, 4), description: 'Stakeholder update', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 430, startMinutes: 540 },
  { id: 'te93', personId: 'charinda-dissanayake', date: addDays(sixWeeksAgoStart, 0), description: 'Daily standup', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 465, startMinutes: 540 },
  { id: 'te94', personId: 'charinda-dissanayake', date: addDays(sixWeeksAgoStart, 0), description: 'Refactoring service layer', projectId: 'atlas-launch', category: 'Development', minutes: 40, startMinutes: 1005 },
  { id: 'te95', personId: 'charinda-dissanayake', date: addDays(sixWeeksAgoStart, 1), description: 'Roadmap planning', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 355, startMinutes: 540, billable: true },
  { id: 'te96', personId: 'charinda-dissanayake', date: addDays(sixWeeksAgoStart, 1), description: 'Client sync call', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 130, startMinutes: 895 },
  { id: 'te97', personId: 'charinda-dissanayake', date: addDays(sixWeeksAgoStart, 3), description: 'Performance tuning', projectId: 'atlas-launch', category: 'Development', minutes: 230, startMinutes: 540, billable: true },
  { id: 'te98', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 0), description: 'Client sync call', projectId: 'echo-migration', category: 'Meetings & Calls', minutes: 450, startMinutes: 540 },
  { id: 'te99', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 1), description: 'API integration', projectId: 'cobalt-launch', category: 'Development', minutes: 470, startMinutes: 540, billable: true },
  { id: 'te100', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 2), description: 'Refactoring service layer', projectId: 'cobalt-launch', category: 'Development', minutes: 350, startMinutes: 540, billable: true },
  { id: 'te101', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 2), description: 'Performance tuning', projectId: 'atlas-launch', category: 'Development', minutes: 235, startMinutes: 905, billable: true },
  { id: 'te102', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 3), description: 'Building UI components', projectId: 'echo-migration', category: 'Development', minutes: 105, startMinutes: 540, billable: true },
  { id: 'te103', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 3), description: 'Daily standup', projectId: 'atlas-launch', category: 'Meetings & Calls', minutes: 60, startMinutes: 645, billable: true },
  { id: 'te104', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 4), description: 'Feature implementation', projectId: 'atlas-launch', category: 'Development', minutes: 200, startMinutes: 540 },
  { id: 'te105', personId: 'charinda-dissanayake', date: addDays(sevenWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'atlas-launch', category: 'Code Review', minutes: 245, startMinutes: 740, billable: true },
  { id: 'te106', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 0), description: '1:1 with manager', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 225, startMinutes: 540 },
  { id: 'te107', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 0), description: 'Admin tasks', projectId: 'legacy-migration', category: 'Admin', minutes: 70, startMinutes: 780, billable: false },
  { id: 'te108', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 1), description: 'Reviewing teammate PRs', projectId: 'orbit-analytics', category: 'Code Review', minutes: 110, startMinutes: 540, billable: true },
  { id: 'te109', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 1), description: 'Stakeholder update', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 85, startMinutes: 680, billable: true },
  { id: 'te110', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 2), description: 'Database migration script', projectId: 'orbit-analytics', category: 'Development', minutes: 445, startMinutes: 540, billable: true },
  { id: 'te111', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 3), description: 'PR review', projectId: 'legacy-migration', category: 'Code Review', minutes: 355, startMinutes: 540, billable: true },
  { id: 'te112', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 3), description: 'Refactoring service layer', projectId: 'legacy-migration', category: 'Development', minutes: 260, startMinutes: 895, billable: true },
  { id: 'te113', personId: 'hashan-wijesinghe', date: addDays(lastWeekStart, 4), description: 'Documentation updates', projectId: 'legacy-migration', category: 'Admin', minutes: 450, startMinutes: 540, billable: false },
  { id: 'te114', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 170, startMinutes: 540, billable: true },
  { id: 'te115', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 1), description: 'Admin tasks', projectId: 'legacy-migration', category: 'Admin', minutes: 190, startMinutes: 540, billable: false },
  { id: 'te116', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 2), description: 'Expense reports', projectId: 'legacy-migration', category: 'Admin', minutes: 540, startMinutes: 540, billable: false },
  { id: 'te117', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 2), description: 'Roadmap planning', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 55, startMinutes: 1110 },
  { id: 'te118', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 3), description: 'Reviewing teammate PRs', projectId: 'orbit-analytics', category: 'Code Review', minutes: 245, startMinutes: 540, billable: true },
  { id: 'te119', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'legacy-migration', category: 'Code Review', minutes: 185, startMinutes: 540, billable: true },
  { id: 'te120', personId: 'hashan-wijesinghe', date: addDays(twoWeeksAgoStart, 4), description: 'Code review', projectId: 'legacy-migration', category: 'Code Review', minutes: 400, startMinutes: 755, billable: true },
  { id: 'te121', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 0), description: 'Daily standup', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 180, startMinutes: 540, billable: false },
  { id: 'te122', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 0), description: 'Database migration script', projectId: 'legacy-migration', category: 'Development', minutes: 245, startMinutes: 720, billable: true },
  { id: 'te123', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 1), description: 'Code review', projectId: 'legacy-migration', category: 'Code Review', minutes: 85, startMinutes: 540, billable: true },
  { id: 'te124', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 1), description: 'Refactoring service layer', projectId: 'orbit-analytics', category: 'Development', minutes: 335, startMinutes: 625, billable: true },
  { id: 'te125', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 2), description: 'Code review', projectId: 'orbit-analytics', category: 'Code Review', minutes: 375, startMinutes: 540, billable: true },
  { id: 'te126', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 2), description: 'Onboarding paperwork', projectId: 'orbit-analytics', category: 'Admin', minutes: 95, startMinutes: 915, billable: false },
  { id: 'te127', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 3), description: 'Feature implementation', projectId: 'orbit-analytics', category: 'Development', minutes: 355, startMinutes: 540, billable: true },
  { id: 'te128', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 3), description: 'Reviewing teammate PRs', projectId: 'orbit-analytics', category: 'Code Review', minutes: 80, startMinutes: 925, billable: true },
  { id: 'te129', personId: 'hashan-wijesinghe', date: addDays(threeWeeksAgoStart, 4), description: 'Documentation updates', projectId: 'legacy-migration', category: 'Admin', minutes: 240, startMinutes: 540 },
  { id: 'te130', personId: 'hashan-wijesinghe', date: addDays(fourWeeksAgoStart, 3), description: 'Daily standup', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 190, startMinutes: 540 },
  { id: 'te131', personId: 'hashan-wijesinghe', date: addDays(fiveWeeksAgoStart, 0), description: 'Expense reports', projectId: 'orbit-analytics', category: 'Admin', minutes: 80, startMinutes: 540, billable: false },
  { id: 'te132', personId: 'hashan-wijesinghe', date: addDays(fiveWeeksAgoStart, 0), description: 'Email triage', projectId: 'legacy-migration', category: 'Admin', minutes: 100, startMinutes: 620, billable: false },
  { id: 'te133', personId: 'hashan-wijesinghe', date: addDays(fiveWeeksAgoStart, 2), description: 'Sprint retro', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 355, startMinutes: 540 },
  { id: 'te134', personId: 'hashan-wijesinghe', date: addDays(fiveWeeksAgoStart, 2), description: 'Expense reports', projectId: 'legacy-migration', category: 'Admin', minutes: 85, startMinutes: 895, billable: false },
  { id: 'te135', personId: 'hashan-wijesinghe', date: addDays(fiveWeeksAgoStart, 3), description: 'Daily standup', projectId: 'legacy-migration', category: 'Meetings & Calls', minutes: 215, startMinutes: 540 },
  { id: 'te136', personId: 'hashan-wijesinghe', date: addDays(sixWeeksAgoStart, 0), description: 'Onboarding paperwork', projectId: 'orbit-analytics', category: 'Admin', minutes: 245, startMinutes: 540, billable: false },
  { id: 'te137', personId: 'hashan-wijesinghe', date: addDays(sixWeeksAgoStart, 1), description: 'Onboarding paperwork', projectId: 'orbit-analytics', category: 'Admin', minutes: 210, startMinutes: 540, billable: false },
  { id: 'te138', personId: 'hashan-wijesinghe', date: addDays(sixWeeksAgoStart, 2), description: 'Email triage', projectId: 'legacy-migration', category: 'Admin', minutes: 240, startMinutes: 540, billable: false },
  { id: 'te139', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 0), description: 'Bug fixes', projectId: 'legacy-migration', category: 'Development', minutes: 45, startMinutes: 540, billable: true },
  { id: 'te140', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 0), description: 'Code review', projectId: 'legacy-migration', category: 'Code Review', minutes: 395, startMinutes: 615, billable: true },
  { id: 'te141', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 1), description: 'PR review', projectId: 'legacy-migration', category: 'Code Review', minutes: 230, startMinutes: 540, billable: true },
  { id: 'te142', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 2), description: 'Client sync call', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 550, startMinutes: 540, billable: true },
  { id: 'te143', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 2), description: 'Reviewing teammate PRs', projectId: 'orbit-analytics', category: 'Code Review', minutes: 40, startMinutes: 1090, billable: false },
  { id: 'te144', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 3), description: 'Onboarding paperwork', projectId: 'legacy-migration', category: 'Admin', minutes: 465, startMinutes: 540, billable: false },
  { id: 'te145', personId: 'hashan-wijesinghe', date: addDays(sevenWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'legacy-migration', category: 'Code Review', minutes: 470, startMinutes: 540, billable: true },
  { id: 'te146', personId: 'faran-siddiqui', date: addDays(lastWeekStart, 0), description: 'Roadmap planning', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 350, startMinutes: 540, billable: true },
  { id: 'te147', personId: 'faran-siddiqui', date: addDays(lastWeekStart, 0), description: 'Reviewing teammate PRs', projectId: 'vantage-crm', category: 'Code Review', minutes: 260, startMinutes: 920, billable: true },
  { id: 'te148', personId: 'faran-siddiqui', date: addDays(lastWeekStart, 4), description: 'Building UI components', projectId: 'talon-security-audit', category: 'Development', minutes: 240, startMinutes: 540, billable: true },
  { id: 'te149', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 0), description: 'Daily standup', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 490, startMinutes: 540, billable: false },
  { id: 'te150', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 0), description: 'PR review', projectId: 'falcon-launch', category: 'Code Review', minutes: 90, startMinutes: 1045, billable: true },
  { id: 'te151', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 1), description: 'Code review', projectId: 'falcon-launch', category: 'Code Review', minutes: 280, startMinutes: 540, billable: false },
  { id: 'te152', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 2), description: 'Daily standup', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 90, startMinutes: 540 },
  { id: 'te153', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 2), description: 'Building UI components', projectId: 'falcon-launch', category: 'Development', minutes: 490, startMinutes: 630, billable: true },
  { id: 'te154', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 3), description: 'Client sync call', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 460, startMinutes: 540, billable: false },
  { id: 'te155', personId: 'faran-siddiqui', date: addDays(twoWeeksAgoStart, 4), description: 'Code review', projectId: 'talon-security-audit', category: 'Code Review', minutes: 475, startMinutes: 540, billable: true },
  { id: 'te156', personId: 'faran-siddiqui', date: addDays(threeWeeksAgoStart, 0), description: 'Client sync call', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 395, startMinutes: 540 },
  { id: 'te157', personId: 'faran-siddiqui', date: addDays(threeWeeksAgoStart, 0), description: 'Email triage', projectId: 'talon-security-audit', category: 'Admin', minutes: 60, startMinutes: 965 },
  { id: 'te158', personId: 'faran-siddiqui', date: addDays(threeWeeksAgoStart, 1), description: 'Refactoring service layer', projectId: 'falcon-launch', category: 'Development', minutes: 455, startMinutes: 540, billable: true },
  { id: 'te159', personId: 'faran-siddiqui', date: addDays(threeWeeksAgoStart, 2), description: 'Building UI components', projectId: 'talon-security-audit', category: 'Development', minutes: 365, startMinutes: 540 },
  { id: 'te160', personId: 'faran-siddiqui', date: addDays(threeWeeksAgoStart, 2), description: 'Reviewing teammate PRs', projectId: 'talon-security-audit', category: 'Code Review', minutes: 230, startMinutes: 935, billable: true },
  { id: 'te161', personId: 'faran-siddiqui', date: addDays(threeWeeksAgoStart, 4), description: 'Expense reports', projectId: 'vantage-crm', category: 'Admin', minutes: 295, startMinutes: 540, billable: false },
  { id: 'te162', personId: 'faran-siddiqui', date: addDays(fourWeeksAgoStart, 1), description: 'API integration', projectId: 'talon-security-audit', category: 'Development', minutes: 50, startMinutes: 540, billable: true },
  { id: 'te163', personId: 'faran-siddiqui', date: addDays(fourWeeksAgoStart, 1), description: 'Stakeholder update', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 370, startMinutes: 590 },
  { id: 'te164', personId: 'faran-siddiqui', date: addDays(fourWeeksAgoStart, 3), description: 'Code review', projectId: 'falcon-launch', category: 'Code Review', minutes: 65, startMinutes: 540, billable: true },
  { id: 'te165', personId: 'faran-siddiqui', date: addDays(fourWeeksAgoStart, 3), description: 'Daily standup', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 440, startMinutes: 605, billable: false },
  { id: 'te166', personId: 'faran-siddiqui', date: addDays(fourWeeksAgoStart, 4), description: 'Email triage', projectId: 'vantage-crm', category: 'Admin', minutes: 200, startMinutes: 540, billable: false },
  { id: 'te167', personId: 'batool-abdullah', date: addDays(lastWeekStart, 0), description: 'Admin tasks', projectId: null, category: 'Admin', minutes: 175, startMinutes: 540, billable: false },
  { id: 'te168', personId: 'batool-abdullah', date: addDays(lastWeekStart, 0), description: 'Competitor analysis', projectId: 'redwood-website', category: 'Research', minutes: 305, startMinutes: 715 },
  { id: 'te169', personId: 'batool-abdullah', date: addDays(lastWeekStart, 1), description: 'Market research', projectId: null, category: 'Research', minutes: 450, startMinutes: 540, billable: true },
  { id: 'te170', personId: 'batool-abdullah', date: addDays(lastWeekStart, 1), description: 'Client sync call', projectId: null, category: 'Meetings & Calls', minutes: 45, startMinutes: 990, billable: false },
  { id: 'te171', personId: 'batool-abdullah', date: addDays(lastWeekStart, 3), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 165, startMinutes: 540, billable: false },
  { id: 'te172', personId: 'batool-abdullah', date: addDays(lastWeekStart, 3), description: 'Market research', projectId: 'redwood-website', category: 'Research', minutes: 320, startMinutes: 705 },
  { id: 'te173', personId: 'batool-abdullah', date: addDays(lastWeekStart, 4), description: 'Roadmap planning', projectId: null, category: 'Meetings & Calls', minutes: 230, startMinutes: 540 },
  { id: 'te174', personId: 'batool-abdullah', date: addDays(lastWeekStart, 4), description: 'Technical spike', projectId: 'redwood-website', category: 'Research', minutes: 60, startMinutes: 800 },
  { id: 'te175', personId: 'batool-abdullah', date: addDays(twoWeeksAgoStart, 0), description: 'Onboarding paperwork', projectId: 'redwood-website', category: 'Admin', minutes: 95, startMinutes: 540, billable: false },
  { id: 'te176', personId: 'batool-abdullah', date: addDays(twoWeeksAgoStart, 0), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 385, startMinutes: 650, billable: false },
  { id: 'te177', personId: 'batool-abdullah', date: addDays(twoWeeksAgoStart, 2), description: 'Sprint planning', projectId: null, category: 'Meetings & Calls', minutes: 300, startMinutes: 540 },
  { id: 'te178', personId: 'batool-abdullah', date: addDays(twoWeeksAgoStart, 3), description: 'Expense reports', projectId: 'redwood-website', category: 'Admin', minutes: 190, startMinutes: 540, billable: false },
  { id: 'te179', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 0), description: 'Sprint planning', projectId: null, category: 'Meetings & Calls', minutes: 470, startMinutes: 540 },
  { id: 'te180', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 1), description: 'Market research', projectId: null, category: 'Research', minutes: 140, startMinutes: 540 },
  { id: 'te181', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 1), description: 'Competitor analysis', projectId: 'redwood-website', category: 'Research', minutes: 435, startMinutes: 680 },
  { id: 'te182', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 2), description: 'Roadmap planning', projectId: 'redwood-website', category: 'Meetings & Calls', minutes: 255, startMinutes: 540 },
  { id: 'te183', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'redwood-website', category: 'Meetings & Calls', minutes: 245, startMinutes: 540 },
  { id: 'te184', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 3), description: 'Competitor analysis', projectId: null, category: 'Research', minutes: 255, startMinutes: 785, billable: false },
  { id: 'te185', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 4), description: 'Competitor analysis', projectId: null, category: 'Research', minutes: 190, startMinutes: 540 },
  { id: 'te186', personId: 'batool-abdullah', date: addDays(threeWeeksAgoStart, 4), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 405, startMinutes: 760, billable: false },
  { id: 'te187', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 0), description: 'Market research', projectId: null, category: 'Research', minutes: 295, startMinutes: 540 },
  { id: 'te188', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 0), description: 'Admin tasks', projectId: null, category: 'Admin', minutes: 150, startMinutes: 865, billable: false },
  { id: 'te189', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 1), description: '1:1 with manager', projectId: 'redwood-website', category: 'Meetings & Calls', minutes: 505, startMinutes: 540 },
  { id: 'te190', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 2), description: 'Market research', projectId: 'redwood-website', category: 'Research', minutes: 470, startMinutes: 540, billable: false },
  { id: 'te191', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 3), description: 'Documentation updates', projectId: 'redwood-website', category: 'Admin', minutes: 225, startMinutes: 540 },
  { id: 'te192', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 4), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 100, startMinutes: 540, billable: false },
  { id: 'te193', personId: 'batool-abdullah', date: addDays(fourWeeksAgoStart, 4), description: 'Client sync call', projectId: null, category: 'Meetings & Calls', minutes: 480, startMinutes: 640 },
  { id: 'te194', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 0), description: 'Competitor analysis', projectId: 'echo-integration', category: 'Research', minutes: 415, startMinutes: 540 },
  { id: 'te195', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 0), description: 'Stakeholder update', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 200, startMinutes: 985 },
  { id: 'te196', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 1), description: 'Documentation updates', projectId: 'echo-integration', category: 'Admin', minutes: 360, startMinutes: 540, billable: false },
  { id: 'te197', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 1), description: 'Competitor analysis', projectId: 'echo-initiative', category: 'Research', minutes: 230, startMinutes: 900 },
  { id: 'te198', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 3), description: 'Onboarding paperwork', projectId: 'echo-initiative', category: 'Admin', minutes: 300, startMinutes: 540, billable: false },
  { id: 'te199', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 3), description: 'Roadmap planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 135, startMinutes: 840, billable: true },
  { id: 'te200', personId: 'chamika-wijeratne', date: addDays(lastWeekStart, 4), description: 'Expense reports', projectId: 'echo-initiative', category: 'Admin', minutes: 475, startMinutes: 540 },
  { id: 'te201', personId: 'chamika-wijeratne', date: addDays(twoWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 225, startMinutes: 540, billable: true },
  { id: 'te202', personId: 'chamika-wijeratne', date: addDays(twoWeeksAgoStart, 1), description: 'Documentation updates', projectId: 'echo-initiative', category: 'Admin', minutes: 435, startMinutes: 540, billable: false },
  { id: 'te203', personId: 'chamika-wijeratne', date: addDays(twoWeeksAgoStart, 2), description: 'Roadmap planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 270, startMinutes: 540, billable: true },
  { id: 'te204', personId: 'chamika-wijeratne', date: addDays(twoWeeksAgoStart, 4), description: 'Competitor analysis', projectId: 'echo-integration', category: 'Research', minutes: 275, startMinutes: 540 },
  { id: 'te205', personId: 'chamika-wijeratne', date: addDays(threeWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'echo-initiative', category: 'Admin', minutes: 290, startMinutes: 540, billable: false },
  { id: 'te206', personId: 'chamika-wijeratne', date: addDays(threeWeeksAgoStart, 2), description: 'Market research', projectId: 'echo-integration', category: 'Research', minutes: 140, startMinutes: 860, billable: false },
  { id: 'te207', personId: 'chamika-wijeratne', date: addDays(threeWeeksAgoStart, 3), description: 'Documentation updates', projectId: 'echo-integration', category: 'Admin', minutes: 205, startMinutes: 540, billable: false },
  { id: 'te208', personId: 'chamika-wijeratne', date: addDays(threeWeeksAgoStart, 4), description: 'Email triage', projectId: 'aurora-redesign', category: 'Admin', minutes: 485, startMinutes: 540 },
  { id: 'te209', personId: 'chamika-wijeratne', date: addDays(fourWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 170, startMinutes: 540 },
  { id: 'te210', personId: 'chamika-wijeratne', date: addDays(fourWeeksAgoStart, 1), description: 'Daily standup', projectId: 'echo-initiative', category: 'Meetings & Calls', minutes: 225, startMinutes: 540, billable: false },
  { id: 'te211', personId: 'chamika-wijeratne', date: addDays(fourWeeksAgoStart, 2), description: 'Market research', projectId: 'aurora-redesign', category: 'Research', minutes: 220, startMinutes: 540 },
  { id: 'te212', personId: 'chamika-wijeratne', date: addDays(fourWeeksAgoStart, 2), description: 'Daily standup', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 275, startMinutes: 760 },
  { id: 'te213', personId: 'chamika-wijeratne', date: addDays(fourWeeksAgoStart, 4), description: 'Roadmap planning', projectId: 'echo-initiative', category: 'Meetings & Calls', minutes: 460, startMinutes: 540 },
  { id: 'te214', personId: 'chamika-wijeratne', date: addDays(fourWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: 'aurora-redesign', category: 'Admin', minutes: 110, startMinutes: 1000, billable: false },
  { id: 'te215', personId: 'dinusha-randika', date: addDays(lastWeekStart, 0), description: 'Admin tasks', projectId: 'westgate-retainer', category: 'Admin', minutes: 485, startMinutes: 540, billable: false },
  { id: 'te216', personId: 'dinusha-randika', date: addDays(lastWeekStart, 3), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 250, startMinutes: 540 },
  { id: 'te217', personId: 'dinusha-randika', date: addDays(lastWeekStart, 4), description: 'Expense reports', projectId: 'beacon-support', category: 'Admin', minutes: 270, startMinutes: 540, billable: false },
  { id: 'te218', personId: 'dinusha-randika', date: addDays(twoWeeksAgoStart, 2), description: 'Email triage', projectId: 'beacon-support', category: 'Admin', minutes: 445, startMinutes: 540, billable: false },
  { id: 'te219', personId: 'dinusha-randika', date: addDays(twoWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 275, startMinutes: 540 },
  { id: 'te220', personId: 'dinusha-randika', date: addDays(twoWeeksAgoStart, 4), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 420, startMinutes: 540 },
  { id: 'te221', personId: 'dinusha-randika', date: addDays(threeWeeksAgoStart, 0), description: 'Roadmap planning', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 260, startMinutes: 540, billable: false },
  { id: 'te222', personId: 'dinusha-randika', date: addDays(threeWeeksAgoStart, 1), description: '1:1 with manager', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 475, startMinutes: 540 },
  { id: 'te223', personId: 'dinusha-randika', date: addDays(threeWeeksAgoStart, 2), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 235, startMinutes: 540 },
  { id: 'te224', personId: 'dinusha-randika', date: addDays(threeWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 125, startMinutes: 540 },
  { id: 'te225', personId: 'dinusha-randika', date: addDays(threeWeeksAgoStart, 3), description: 'Client sync call', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 85, startMinutes: 665 },
  { id: 'te226', personId: 'dinusha-randika', date: addDays(threeWeeksAgoStart, 4), description: 'Stakeholder update', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 160, startMinutes: 540 },
  { id: 'te227', personId: 'dinusha-randika', date: addDays(fourWeeksAgoStart, 0), description: 'Stakeholder update', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 290, startMinutes: 540, billable: false },
  { id: 'te228', personId: 'dinusha-randika', date: addDays(fourWeeksAgoStart, 1), description: 'Roadmap planning', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 250, startMinutes: 540 },
  { id: 'te229', personId: 'dinusha-randika', date: addDays(fourWeeksAgoStart, 2), description: 'Data entry', projectId: 'beacon-support', category: 'Manual', minutes: 430, startMinutes: 540, billable: false },
  { id: 'te230', personId: 'dinusha-randika', date: addDays(fourWeeksAgoStart, 3), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 480, startMinutes: 540, billable: true },
  { id: 'te231', personId: 'dinusha-randika', date: addDays(fourWeeksAgoStart, 4), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 495, startMinutes: 540 },
  { id: 'te232', personId: 'priya-nair', date: addDays(lastWeekStart, 0), description: 'Daily standup', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 230, startMinutes: 540, billable: false },
  { id: 'te233', personId: 'priya-nair', date: addDays(lastWeekStart, 2), description: 'Sprint planning', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 330, startMinutes: 540 },
  { id: 'te234', personId: 'priya-nair', date: addDays(lastWeekStart, 2), description: 'Code review', projectId: 'falcon-launch', category: 'Code Review', minutes: 150, startMinutes: 885, billable: true },
  { id: 'te235', personId: 'priya-nair', date: addDays(lastWeekStart, 3), description: 'Feature implementation', projectId: 'falcon-launch', category: 'Development', minutes: 375, startMinutes: 540, billable: true },
  { id: 'te236', personId: 'priya-nair', date: addDays(lastWeekStart, 3), description: 'Database migration script', projectId: 'falcon-launch', category: 'Development', minutes: 195, startMinutes: 915, billable: true },
  { id: 'te237', personId: 'priya-nair', date: addDays(lastWeekStart, 4), description: 'Writing unit tests', projectId: 'falcon-launch', category: 'Development', minutes: 390, startMinutes: 540, billable: true },
  { id: 'te238', personId: 'priya-nair', date: addDays(lastWeekStart, 4), description: 'Sprint retro', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 45, startMinutes: 930, billable: false },
  { id: 'te239', personId: 'priya-nair', date: addDays(twoWeeksAgoStart, 0), description: 'Reviewing teammate PRs', projectId: 'falcon-launch', category: 'Code Review', minutes: 35, startMinutes: 540, billable: true },
  { id: 'te240', personId: 'priya-nair', date: addDays(twoWeeksAgoStart, 0), description: 'Code review', projectId: 'atlas-launch', category: 'Code Review', minutes: 120, startMinutes: 575, billable: true },
  { id: 'te241', personId: 'priya-nair', date: addDays(twoWeeksAgoStart, 1), description: 'PR review', projectId: 'falcon-launch', category: 'Code Review', minutes: 175, startMinutes: 540, billable: true },
  { id: 'te242', personId: 'priya-nair', date: addDays(twoWeeksAgoStart, 2), description: 'Feature implementation', projectId: 'atlas-launch', category: 'Development', minutes: 260, startMinutes: 540, billable: true },
  { id: 'te243', personId: 'priya-nair', date: addDays(twoWeeksAgoStart, 4), description: 'Database migration script', projectId: 'atlas-launch', category: 'Development', minutes: 450, startMinutes: 540, billable: true },
  { id: 'te244', personId: 'marcus-chen', date: addDays(lastWeekStart, 0), description: 'Email triage', projectId: null, category: 'Admin', minutes: 180, startMinutes: 540, billable: false },
  { id: 'te245', personId: 'marcus-chen', date: addDays(lastWeekStart, 1), description: 'Market research', projectId: 'redwood-website', category: 'Research', minutes: 180, startMinutes: 540 },
  { id: 'te246', personId: 'marcus-chen', date: addDays(lastWeekStart, 1), description: 'Daily standup', projectId: 'redwood-website', category: 'Meetings & Calls', minutes: 420, startMinutes: 720 },
  { id: 'te247', personId: 'marcus-chen', date: addDays(lastWeekStart, 3), description: 'Client sync call', projectId: 'redwood-website', category: 'Meetings & Calls', minutes: 275, startMinutes: 540 },
  { id: 'te248', personId: 'layla-haddad', date: addDays(lastWeekStart, 0), description: '1:1 with manager', projectId: null, category: 'Meetings & Calls', minutes: 445, startMinutes: 540 },
  { id: 'te249', personId: 'layla-haddad', date: addDays(lastWeekStart, 2), description: 'Sprint planning', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 120, startMinutes: 540 },
  { id: 'te250', personId: 'layla-haddad', date: addDays(lastWeekStart, 2), description: 'Manual QA pass', projectId: null, category: 'Manual', minutes: 40, startMinutes: 675, billable: false },
  { id: 'te251', personId: 'layla-haddad', date: addDays(lastWeekStart, 3), description: 'Sprint planning', projectId: null, category: 'Meetings & Calls', minutes: 70, startMinutes: 540 },
  { id: 'te252', personId: 'layla-haddad', date: addDays(lastWeekStart, 3), description: 'Onboarding paperwork', projectId: 'beacon-support', category: 'Admin', minutes: 525, startMinutes: 610, billable: false },
  { id: 'te253', personId: 'layla-haddad', date: addDays(lastWeekStart, 4), description: 'Sprint planning', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 225, startMinutes: 540, billable: false },
  { id: 'te254', personId: 'layla-haddad', date: addDays(lastWeekStart, 4), description: 'Data entry', projectId: 'beacon-support', category: 'Manual', minutes: 50, startMinutes: 765, billable: false },
  { id: 'te255', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 0), description: 'Stakeholder update', projectId: null, category: 'Meetings & Calls', minutes: 35, startMinutes: 540, billable: false },
  { id: 'te256', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 0), description: 'Onboarding paperwork', projectId: null, category: 'Admin', minutes: 395, startMinutes: 575, billable: false },
  { id: 'te257', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 1), description: 'Sprint retro', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 165, startMinutes: 540, billable: false },
  { id: 'te258', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 1), description: 'Data entry', projectId: 'beacon-support', category: 'Manual', minutes: 80, startMinutes: 720, billable: true },
  { id: 'te259', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 2), description: 'Admin tasks', projectId: 'beacon-support', category: 'Admin', minutes: 285, startMinutes: 540, billable: true },
  { id: 'te260', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 3), description: 'Admin tasks', projectId: 'beacon-support', category: 'Admin', minutes: 155, startMinutes: 540, billable: false },
  { id: 'te261', personId: 'layla-haddad', date: addDays(twoWeeksAgoStart, 4), description: 'Stakeholder update', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 175, startMinutes: 540 },
  { id: 'te262', personId: 'layla-haddad', date: addDays(threeWeeksAgoStart, 1), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 450, startMinutes: 540, billable: false },
  { id: 'te263', personId: 'layla-haddad', date: addDays(threeWeeksAgoStart, 2), description: 'Roadmap planning', projectId: null, category: 'Meetings & Calls', minutes: 500, startMinutes: 540 },
  { id: 'te264', personId: 'layla-haddad', date: addDays(threeWeeksAgoStart, 3), description: 'Sprint planning', projectId: null, category: 'Meetings & Calls', minutes: 115, startMinutes: 540 },
  { id: 'te265', personId: 'layla-haddad', date: addDays(threeWeeksAgoStart, 3), description: 'Stakeholder update', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 125, startMinutes: 670 },
  { id: 'te266', personId: 'layla-haddad', date: addDays(threeWeeksAgoStart, 4), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 245, startMinutes: 540 },
  { id: 'te267', personId: 'layla-haddad', date: addDays(threeWeeksAgoStart, 4), description: 'Email triage', projectId: null, category: 'Admin', minutes: 205, startMinutes: 785, billable: false },
  { id: 'te268', personId: 'layla-haddad', date: addDays(fourWeeksAgoStart, 1), description: 'Manual regression testing', projectId: null, category: 'Manual', minutes: 45, startMinutes: 540 },
  { id: 'te269', personId: 'layla-haddad', date: addDays(fourWeeksAgoStart, 1), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 380, startMinutes: 600 },
  { id: 'te270', personId: 'layla-haddad', date: addDays(fourWeeksAgoStart, 4), description: 'Email triage', projectId: null, category: 'Admin', minutes: 325, startMinutes: 540, billable: false },
  { id: 'te271', personId: 'layla-haddad', date: addDays(fourWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: null, category: 'Admin', minutes: 250, startMinutes: 865, billable: false },
  { id: 'te272', personId: 'tomas-rivera', date: addDays(lastWeekStart, 0), description: 'Onboarding paperwork', projectId: 'aurora-redesign', category: 'Admin', minutes: 120, startMinutes: 540, billable: false },
  { id: 'te273', personId: 'tomas-rivera', date: addDays(lastWeekStart, 0), description: 'Documentation updates', projectId: 'echo-initiative', category: 'Admin', minutes: 500, startMinutes: 660, billable: false },
  { id: 'te274', personId: 'tomas-rivera', date: addDays(lastWeekStart, 1), description: 'Competitor analysis', projectId: 'echo-initiative', category: 'Research', minutes: 270, startMinutes: 540, billable: true },
  { id: 'te275', personId: 'tomas-rivera', date: addDays(lastWeekStart, 2), description: 'Stakeholder update', projectId: 'echo-initiative', category: 'Meetings & Calls', minutes: 465, startMinutes: 540 },
  { id: 'te276', personId: 'tomas-rivera', date: addDays(lastWeekStart, 3), description: 'Market research', projectId: 'echo-initiative', category: 'Research', minutes: 205, startMinutes: 540, billable: true },
  { id: 'te277', personId: 'tomas-rivera', date: addDays(lastWeekStart, 4), description: 'Competitor analysis', projectId: 'echo-initiative', category: 'Research', minutes: 250, startMinutes: 540 },
  { id: 'te278', personId: 'tomas-rivera', date: addDays(twoWeeksAgoStart, 0), description: 'Roadmap planning', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 560, startMinutes: 540, billable: false },
  { id: 'te279', personId: 'tomas-rivera', date: addDays(twoWeeksAgoStart, 0), description: 'Market research', projectId: 'echo-initiative', category: 'Research', minutes: 65, startMinutes: 1100 },
  { id: 'te280', personId: 'tomas-rivera', date: addDays(twoWeeksAgoStart, 1), description: 'Competitor analysis', projectId: 'echo-initiative', category: 'Research', minutes: 70, startMinutes: 540 },
  { id: 'te281', personId: 'tomas-rivera', date: addDays(twoWeeksAgoStart, 1), description: 'Documentation updates', projectId: 'aurora-redesign', category: 'Admin', minutes: 230, startMinutes: 640, billable: false },
  { id: 'te282', personId: 'tomas-rivera', date: addDays(twoWeeksAgoStart, 2), description: 'Email triage', projectId: 'echo-initiative', category: 'Admin', minutes: 250, startMinutes: 540, billable: false },
  { id: 'te283', personId: 'tomas-rivera', date: addDays(twoWeeksAgoStart, 3), description: 'Market research', projectId: 'aurora-redesign', category: 'Research', minutes: 285, startMinutes: 540 },
  { id: 'te284', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 0), description: 'Daily standup', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 40, startMinutes: 540 },
  { id: 'te285', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 0), description: 'Technical spike', projectId: 'aurora-redesign', category: 'Research', minutes: 555, startMinutes: 610 },
  { id: 'te286', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 1), description: 'Competitor analysis', projectId: 'aurora-redesign', category: 'Research', minutes: 260, startMinutes: 540, billable: false },
  { id: 'te287', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 2), description: '1:1 with manager', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 145, startMinutes: 540 },
  { id: 'te288', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 2), description: '1:1 with manager', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 340, startMinutes: 685 },
  { id: 'te289', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 3), description: 'Competitor analysis', projectId: 'aurora-redesign', category: 'Research', minutes: 115, startMinutes: 540 },
  { id: 'te290', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 3), description: 'Expense reports', projectId: 'echo-initiative', category: 'Admin', minutes: 315, startMinutes: 670, billable: false },
  { id: 'te291', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 4), description: 'Expense reports', projectId: 'aurora-redesign', category: 'Admin', minutes: 245, startMinutes: 540, billable: false },
  { id: 'te292', personId: 'tomas-rivera', date: addDays(threeWeeksAgoStart, 4), description: 'Expense reports', projectId: 'aurora-redesign', category: 'Admin', minutes: 240, startMinutes: 785, billable: false },
  { id: 'te293', personId: 'tomas-rivera', date: addDays(fourWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'aurora-redesign', category: 'Admin', minutes: 510, startMinutes: 540, billable: false },
  { id: 'te294', personId: 'tomas-rivera', date: addDays(fourWeeksAgoStart, 1), description: '1:1 with manager', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 200, startMinutes: 540 },
  { id: 'te295', personId: 'tomas-rivera', date: addDays(fourWeeksAgoStart, 2), description: 'Sprint planning', projectId: 'echo-initiative', category: 'Meetings & Calls', minutes: 180, startMinutes: 540, billable: true },
  { id: 'te296', personId: 'tomas-rivera', date: addDays(fourWeeksAgoStart, 4), description: 'Roadmap planning', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 360, startMinutes: 540, billable: true },
  { id: 'te297', personId: 'tomas-rivera', date: addDays(fourWeeksAgoStart, 4), description: 'Daily standup', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 65, startMinutes: 915 },
  { id: 'te298', personId: 'yuki-tanaka', date: addDays(lastWeekStart, 0), description: 'Sprint planning', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 45, startMinutes: 540, billable: true },
  { id: 'te299', personId: 'yuki-tanaka', date: addDays(lastWeekStart, 0), description: 'Code review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 220, startMinutes: 585, billable: true },
  { id: 'te300', personId: 'yuki-tanaka', date: addDays(lastWeekStart, 1), description: 'Building UI components', projectId: 'vantage-crm', category: 'Development', minutes: 430, startMinutes: 540, billable: true },
  { id: 'te301', personId: 'yuki-tanaka', date: addDays(lastWeekStart, 2), description: 'Feature implementation', projectId: 'vantage-crm', category: 'Development', minutes: 450, startMinutes: 540, billable: true },
  { id: 'te302', personId: 'yuki-tanaka', date: addDays(lastWeekStart, 4), description: 'Database migration script', projectId: 'quartz-mobile', category: 'Development', minutes: 465, startMinutes: 540, billable: true },
  { id: 'te303', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'vantage-crm', category: 'Development', minutes: 260, startMinutes: 540, billable: true },
  { id: 'te304', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 1), description: 'Writing unit tests', projectId: 'vantage-crm', category: 'Development', minutes: 125, startMinutes: 540, billable: true },
  { id: 'te305', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 1), description: 'Feature implementation', projectId: 'quartz-mobile', category: 'Development', minutes: 455, startMinutes: 695, billable: true },
  { id: 'te306', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 2), description: 'Reviewing teammate PRs', projectId: 'vantage-crm', category: 'Code Review', minutes: 105, startMinutes: 540, billable: true },
  { id: 'te307', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 2), description: 'Sprint planning', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 95, startMinutes: 675 },
  { id: 'te308', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 3), description: 'Reviewing teammate PRs', projectId: 'vantage-crm', category: 'Code Review', minutes: 215, startMinutes: 540, billable: true },
  { id: 'te309', personId: 'yuki-tanaka', date: addDays(twoWeeksAgoStart, 4), description: 'Stakeholder update', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 455, startMinutes: 540, billable: false },
  { id: 'te310', personId: 'yuki-tanaka', date: addDays(threeWeeksAgoStart, 0), description: 'Database migration script', projectId: 'quartz-mobile', category: 'Development', minutes: 175, startMinutes: 540, billable: true },
  { id: 'te311', personId: 'yuki-tanaka', date: addDays(threeWeeksAgoStart, 2), description: 'PR review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 100, startMinutes: 540, billable: true },
  { id: 'te312', personId: 'yuki-tanaka', date: addDays(threeWeeksAgoStart, 2), description: 'Code review', projectId: 'vantage-crm', category: 'Code Review', minutes: 150, startMinutes: 640, billable: true },
  { id: 'te313', personId: 'yuki-tanaka', date: addDays(threeWeeksAgoStart, 3), description: '1:1 with manager', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 510, startMinutes: 540 },
  { id: 'te314', personId: 'yuki-tanaka', date: addDays(threeWeeksAgoStart, 4), description: 'Code review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 195, startMinutes: 540 },
  { id: 'te315', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 0), description: 'Refactoring service layer', projectId: 'quartz-mobile', category: 'Development', minutes: 355, startMinutes: 540, billable: true },
  { id: 'te316', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 0), description: 'Reviewing teammate PRs', projectId: 'quartz-mobile', category: 'Code Review', minutes: 145, startMinutes: 910, billable: false },
  { id: 'te317', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 1), description: 'Daily standup', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 340, startMinutes: 540 },
  { id: 'te318', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 1), description: 'Code review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 155, startMinutes: 880, billable: true },
  { id: 'te319', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 2), description: 'Reviewing teammate PRs', projectId: 'vantage-crm', category: 'Code Review', minutes: 205, startMinutes: 540, billable: true },
  { id: 'te320', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 280, startMinutes: 540 },
  { id: 'te321', personId: 'yuki-tanaka', date: addDays(fourWeeksAgoStart, 4), description: 'Code review', projectId: 'vantage-crm', category: 'Code Review', minutes: 180, startMinutes: 540 },
  { id: 'te322', personId: 'yuki-tanaka', date: addDays(fiveWeeksAgoStart, 0), description: 'Code review', projectId: 'vantage-crm', category: 'Code Review', minutes: 465, startMinutes: 540, billable: true },
  { id: 'te323', personId: 'yuki-tanaka', date: addDays(fiveWeeksAgoStart, 2), description: 'API integration', projectId: 'quartz-mobile', category: 'Development', minutes: 390, startMinutes: 540, billable: true },
  { id: 'te324', personId: 'yuki-tanaka', date: addDays(fiveWeeksAgoStart, 2), description: 'Client sync call', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 60, startMinutes: 945 },
  { id: 'te325', personId: 'yuki-tanaka', date: addDays(fiveWeeksAgoStart, 3), description: '1:1 with manager', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 180, startMinutes: 540 },
  { id: 'te326', personId: 'yuki-tanaka', date: addDays(fiveWeeksAgoStart, 4), description: 'Bug fixes', projectId: 'quartz-mobile', category: 'Development', minutes: 255, startMinutes: 540, billable: true },
  { id: 'te327', personId: 'yuki-tanaka', date: addDays(sixWeeksAgoStart, 0), description: 'PR review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 235, startMinutes: 540, billable: true },
  { id: 'te328', personId: 'yuki-tanaka', date: addDays(sixWeeksAgoStart, 2), description: 'Roadmap planning', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 50, startMinutes: 540 },
  { id: 'te329', personId: 'yuki-tanaka', date: addDays(sixWeeksAgoStart, 2), description: 'Performance tuning', projectId: 'quartz-mobile', category: 'Development', minutes: 225, startMinutes: 605, billable: true },
  { id: 'te330', personId: 'yuki-tanaka', date: addDays(sixWeeksAgoStart, 4), description: 'Roadmap planning', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 345, startMinutes: 540 },
  { id: 'te331', personId: 'yuki-tanaka', date: addDays(sixWeeksAgoStart, 4), description: 'API integration', projectId: 'vantage-crm', category: 'Development', minutes: 155, startMinutes: 885, billable: true },
  { id: 'te332', personId: 'yuki-tanaka', date: addDays(sevenWeeksAgoStart, 1), description: 'Code review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 195, startMinutes: 540, billable: true },
  { id: 'te333', personId: 'yuki-tanaka', date: addDays(sevenWeeksAgoStart, 1), description: 'Database migration script', projectId: 'quartz-mobile', category: 'Development', minutes: 300, startMinutes: 750, billable: true },
  { id: 'te334', personId: 'yuki-tanaka', date: addDays(sevenWeeksAgoStart, 3), description: 'Refactoring service layer', projectId: 'quartz-mobile', category: 'Development', minutes: 235, startMinutes: 540, billable: true },
  { id: 'te335', personId: 'yuki-tanaka', date: addDays(sevenWeeksAgoStart, 3), description: 'Reviewing teammate PRs', projectId: 'vantage-crm', category: 'Code Review', minutes: 275, startMinutes: 775, billable: true },
  { id: 'te336', personId: 'amina-diallo', date: addDays(lastWeekStart, 0), description: 'Admin tasks', projectId: null, category: 'Admin', minutes: 410, startMinutes: 540, billable: false },
  { id: 'te337', personId: 'amina-diallo', date: addDays(lastWeekStart, 0), description: 'Onboarding paperwork', projectId: null, category: 'Admin', minutes: 205, startMinutes: 950, billable: true },
  { id: 'te338', personId: 'amina-diallo', date: addDays(lastWeekStart, 1), description: 'Documentation updates', projectId: null, category: 'Admin', minutes: 455, startMinutes: 540, billable: false },
  { id: 'te339', personId: 'amina-diallo', date: addDays(lastWeekStart, 4), description: 'Documentation updates', projectId: 'union-hr-portal', category: 'Admin', minutes: 285, startMinutes: 540, billable: false },
  { id: 'te340', personId: 'amina-diallo', date: addDays(twoWeeksAgoStart, 0), description: 'Stakeholder update', projectId: null, category: 'Meetings & Calls', minutes: 185, startMinutes: 540 },
  { id: 'te341', personId: 'amina-diallo', date: addDays(twoWeeksAgoStart, 1), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 475, startMinutes: 540, billable: false },
  { id: 'te342', personId: 'amina-diallo', date: addDays(twoWeeksAgoStart, 2), description: 'Client sync call', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 260, startMinutes: 540, billable: false },
  { id: 'te343', personId: 'amina-diallo', date: addDays(twoWeeksAgoStart, 3), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 215, startMinutes: 540, billable: false },
  { id: 'te344', personId: 'amina-diallo', date: addDays(twoWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 295, startMinutes: 540 },
  { id: 'te345', personId: 'amina-diallo', date: addDays(threeWeeksAgoStart, 0), description: 'Stakeholder update', projectId: null, category: 'Meetings & Calls', minutes: 80, startMinutes: 540 },
  { id: 'te346', personId: 'amina-diallo', date: addDays(threeWeeksAgoStart, 0), description: 'Stakeholder update', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 405, startMinutes: 620, billable: false },
  { id: 'te347', personId: 'amina-diallo', date: addDays(threeWeeksAgoStart, 1), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 160, startMinutes: 540, billable: false },
  { id: 'te348', personId: 'amina-diallo', date: addDays(threeWeeksAgoStart, 2), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 430, startMinutes: 540 },
  { id: 'te349', personId: 'amina-diallo', date: addDays(threeWeeksAgoStart, 3), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 60, startMinutes: 540, billable: false },
  { id: 'te350', personId: 'amina-diallo', date: addDays(threeWeeksAgoStart, 3), description: 'Daily standup', projectId: null, category: 'Meetings & Calls', minutes: 90, startMinutes: 615, billable: false },
  { id: 'te351', personId: 'amina-diallo', date: addDays(fourWeeksAgoStart, 0), description: 'Daily standup', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 420, startMinutes: 540 },
  { id: 'te352', personId: 'amina-diallo', date: addDays(fourWeeksAgoStart, 2), description: 'Onboarding paperwork', projectId: null, category: 'Admin', minutes: 225, startMinutes: 540, billable: false },
  { id: 'te353', personId: 'amina-diallo', date: addDays(fourWeeksAgoStart, 2), description: 'Daily standup', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 280, startMinutes: 780 },
  { id: 'te354', personId: 'amina-diallo', date: addDays(fourWeeksAgoStart, 3), description: 'Admin tasks', projectId: 'union-hr-portal', category: 'Admin', minutes: 160, startMinutes: 540, billable: false },
  { id: 'te355', personId: 'oliver-bennett', date: addDays(lastWeekStart, 0), description: 'Technical spike', projectId: 'summit-partnership', category: 'Research', minutes: 465, startMinutes: 540 },
  { id: 'te356', personId: 'oliver-bennett', date: addDays(lastWeekStart, 1), description: 'Technical spike', projectId: 'falcon-launch', category: 'Research', minutes: 195, startMinutes: 540 },
  { id: 'te357', personId: 'oliver-bennett', date: addDays(lastWeekStart, 2), description: 'Technical spike', projectId: 'falcon-launch', category: 'Research', minutes: 150, startMinutes: 540 },
  { id: 'te358', personId: 'oliver-bennett', date: addDays(lastWeekStart, 3), description: 'Expense reports', projectId: 'summit-partnership', category: 'Admin', minutes: 75, startMinutes: 540, billable: false },
  { id: 'te359', personId: 'oliver-bennett', date: addDays(lastWeekStart, 3), description: 'Sprint retro', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 550, startMinutes: 630 },
  { id: 'te360', personId: 'oliver-bennett', date: addDays(lastWeekStart, 4), description: 'Stakeholder update', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 490, startMinutes: 540 },
  { id: 'te361', personId: 'oliver-bennett', date: addDays(twoWeeksAgoStart, 0), description: 'Email triage', projectId: 'summit-partnership', category: 'Admin', minutes: 465, startMinutes: 540, billable: false },
  { id: 'te362', personId: 'oliver-bennett', date: addDays(twoWeeksAgoStart, 1), description: 'Technical spike', projectId: 'falcon-launch', category: 'Research', minutes: 230, startMinutes: 540 },
  { id: 'te363', personId: 'oliver-bennett', date: addDays(twoWeeksAgoStart, 2), description: 'Stakeholder update', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 445, startMinutes: 540 },
  { id: 'te364', personId: 'oliver-bennett', date: addDays(twoWeeksAgoStart, 3), description: 'Admin tasks', projectId: 'summit-partnership', category: 'Admin', minutes: 195, startMinutes: 540, billable: false },
  { id: 'te365', personId: 'oliver-bennett', date: addDays(twoWeeksAgoStart, 4), description: 'Sprint planning', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 380, startMinutes: 540 },
  { id: 'te366', personId: 'oliver-bennett', date: addDays(twoWeeksAgoStart, 4), description: 'Email triage', projectId: 'falcon-launch', category: 'Admin', minutes: 230, startMinutes: 935, billable: false },
  { id: 'te367', personId: 'oliver-bennett', date: addDays(threeWeeksAgoStart, 0), description: 'Email triage', projectId: 'summit-partnership', category: 'Admin', minutes: 440, startMinutes: 540, billable: false },
  { id: 'te368', personId: 'oliver-bennett', date: addDays(threeWeeksAgoStart, 2), description: 'Admin tasks', projectId: 'summit-partnership', category: 'Admin', minutes: 160, startMinutes: 540, billable: false },
  { id: 'te369', personId: 'oliver-bennett', date: addDays(threeWeeksAgoStart, 2), description: 'Sprint retro', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 65, startMinutes: 700, billable: false },
  { id: 'te370', personId: 'oliver-bennett', date: addDays(threeWeeksAgoStart, 3), description: 'Admin tasks', projectId: 'falcon-launch', category: 'Admin', minutes: 455, startMinutes: 540, billable: true },
  { id: 'te371', personId: 'oliver-bennett', date: addDays(threeWeeksAgoStart, 4), description: 'Market research', projectId: 'summit-partnership', category: 'Research', minutes: 505, startMinutes: 540 },
  { id: 'te372', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 0), description: 'Email triage', projectId: 'summit-partnership', category: 'Admin', minutes: 190, startMinutes: 540, billable: false },
  { id: 'te373', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 0), description: 'Daily standup', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 230, startMinutes: 745, billable: true },
  { id: 'te374', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 1), description: 'Onboarding paperwork', projectId: 'summit-partnership', category: 'Admin', minutes: 240, startMinutes: 540, billable: false },
  { id: 'te375', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'summit-partnership', category: 'Admin', minutes: 295, startMinutes: 540, billable: false },
  { id: 'te376', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 2), description: 'Onboarding paperwork', projectId: 'falcon-launch', category: 'Admin', minutes: 315, startMinutes: 850, billable: false },
  { id: 'te377', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 3), description: 'Sprint retro', projectId: 'falcon-launch', category: 'Meetings & Calls', minutes: 60, startMinutes: 540, billable: false },
  { id: 'te378', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 120, startMinutes: 615 },
  { id: 'te379', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: 'summit-partnership', category: 'Admin', minutes: 60, startMinutes: 540, billable: false },
  { id: 'te380', personId: 'oliver-bennett', date: addDays(fourWeeksAgoStart, 4), description: 'Technical spike', projectId: 'falcon-launch', category: 'Research', minutes: 375, startMinutes: 600 },
  { id: 'te381', personId: 'sara-kowalski', date: addDays(lastWeekStart, 0), description: 'Email triage', projectId: 'westgate-retainer', category: 'Admin', minutes: 485, startMinutes: 540, billable: false },
  { id: 'te382', personId: 'sara-kowalski', date: addDays(lastWeekStart, 1), description: 'Daily standup', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 505, startMinutes: 540 },
  { id: 'te383', personId: 'sara-kowalski', date: addDays(lastWeekStart, 2), description: '1:1 with manager', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 450, startMinutes: 540 },
  { id: 'te384', personId: 'sara-kowalski', date: addDays(lastWeekStart, 3), description: 'Manual QA pass', projectId: 'westgate-retainer', category: 'Manual', minutes: 45, startMinutes: 540 },
  { id: 'te385', personId: 'sara-kowalski', date: addDays(lastWeekStart, 3), description: 'Email triage', projectId: 'beacon-support', category: 'Admin', minutes: 405, startMinutes: 585, billable: false },
  { id: 'te386', personId: 'sara-kowalski', date: addDays(lastWeekStart, 4), description: 'Onboarding paperwork', projectId: 'beacon-support', category: 'Admin', minutes: 485, startMinutes: 540, billable: false },
  { id: 'te387', personId: 'sara-kowalski', date: addDays(twoWeeksAgoStart, 0), description: 'Sprint retro', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 460, startMinutes: 540, billable: true },
  { id: 'te388', personId: 'sara-kowalski', date: addDays(twoWeeksAgoStart, 1), description: 'Documentation updates', projectId: 'beacon-support', category: 'Admin', minutes: 255, startMinutes: 540, billable: true },
  { id: 'te389', personId: 'sara-kowalski', date: addDays(twoWeeksAgoStart, 1), description: 'Admin tasks', projectId: 'beacon-support', category: 'Admin', minutes: 170, startMinutes: 795, billable: false },
  { id: 'te390', personId: 'sara-kowalski', date: addDays(twoWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'westgate-retainer', category: 'Admin', minutes: 470, startMinutes: 540, billable: false },
  { id: 'te391', personId: 'sara-kowalski', date: addDays(twoWeeksAgoStart, 3), description: 'Expense reports', projectId: 'beacon-support', category: 'Admin', minutes: 330, startMinutes: 540, billable: false },
  { id: 'te392', personId: 'sara-kowalski', date: addDays(twoWeeksAgoStart, 3), description: '1:1 with manager', projectId: 'beacon-support', category: 'Meetings & Calls', minutes: 95, startMinutes: 870 },
  { id: 'te393', personId: 'sara-kowalski', date: addDays(threeWeeksAgoStart, 1), description: 'Onboarding paperwork', projectId: 'beacon-support', category: 'Admin', minutes: 290, startMinutes: 540, billable: false },
  { id: 'te394', personId: 'sara-kowalski', date: addDays(threeWeeksAgoStart, 2), description: 'Admin tasks', projectId: 'westgate-retainer', category: 'Admin', minutes: 445, startMinutes: 540, billable: false },
  { id: 'te395', personId: 'sara-kowalski', date: addDays(threeWeeksAgoStart, 3), description: 'Onboarding paperwork', projectId: 'beacon-support', category: 'Admin', minutes: 75, startMinutes: 540, billable: false },
  { id: 'te396', personId: 'sara-kowalski', date: addDays(threeWeeksAgoStart, 3), description: 'Manual QA pass', projectId: 'westgate-retainer', category: 'Manual', minutes: 500, startMinutes: 630 },
  { id: 'te397', personId: 'sara-kowalski', date: addDays(threeWeeksAgoStart, 4), description: 'Roadmap planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 255, startMinutes: 540 },
  { id: 'te398', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 0), description: 'Onboarding paperwork', projectId: 'westgate-retainer', category: 'Admin', minutes: 30, startMinutes: 540, billable: false },
  { id: 'te399', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 0), description: 'Expense reports', projectId: 'beacon-support', category: 'Admin', minutes: 470, startMinutes: 600, billable: false },
  { id: 'te400', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 1), description: 'Client sync call', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 510, startMinutes: 540 },
  { id: 'te401', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 2), description: 'Roadmap planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 270, startMinutes: 540 },
  { id: 'te402', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 3), description: 'Manual regression testing', projectId: 'beacon-support', category: 'Manual', minutes: 415, startMinutes: 540 },
  { id: 'te403', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 195, startMinutes: 970, billable: false },
  { id: 'te404', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 4), description: 'Client sync call', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 270, startMinutes: 540 },
  { id: 'te405', personId: 'sara-kowalski', date: addDays(fourWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: 'westgate-retainer', category: 'Admin', minutes: 180, startMinutes: 810, billable: false },
  { id: 'te406', personId: 'devon-marsh', date: addDays(lastWeekStart, 0), description: 'Documentation updates', projectId: 'pinecrest-crm', category: 'Admin', minutes: 50, startMinutes: 540, billable: false },
  { id: 'te407', personId: 'devon-marsh', date: addDays(lastWeekStart, 0), description: '1:1 with manager', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 450, startMinutes: 620 },
  { id: 'te408', personId: 'devon-marsh', date: addDays(lastWeekStart, 2), description: 'Reviewing teammate PRs', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 105, startMinutes: 540, billable: true },
  { id: 'te409', personId: 'devon-marsh', date: addDays(lastWeekStart, 2), description: 'Reviewing teammate PRs', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 175, startMinutes: 660, billable: true },
  { id: 'te410', personId: 'devon-marsh', date: addDays(lastWeekStart, 3), description: 'API integration', projectId: 'nimbus-onboarding', category: 'Development', minutes: 485, startMinutes: 540, billable: true },
  { id: 'te411', personId: 'devon-marsh', date: addDays(lastWeekStart, 4), description: 'Admin tasks', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 470, startMinutes: 540, billable: false },
  { id: 'te412', personId: 'devon-marsh', date: addDays(twoWeeksAgoStart, 0), description: 'Sprint retro', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 480, startMinutes: 540 },
  { id: 'te413', personId: 'devon-marsh', date: addDays(twoWeeksAgoStart, 0), description: 'Building UI components', projectId: 'pinecrest-crm', category: 'Development', minutes: 145, startMinutes: 1020, billable: true },
  { id: 'te414', personId: 'devon-marsh', date: addDays(twoWeeksAgoStart, 1), description: 'Roadmap planning', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 215, startMinutes: 540 },
  { id: 'te415', personId: 'devon-marsh', date: addDays(twoWeeksAgoStart, 1), description: 'Email triage', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 250, startMinutes: 785, billable: false },
  { id: 'te416', personId: 'devon-marsh', date: addDays(twoWeeksAgoStart, 2), description: 'Admin tasks', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 495, startMinutes: 540, billable: false },
  { id: 'te417', personId: 'devon-marsh', date: addDays(twoWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 255, startMinutes: 540, billable: true },
  { id: 'te418', personId: 'devon-marsh', date: addDays(threeWeeksAgoStart, 1), description: 'Refactoring service layer', projectId: 'pinecrest-crm', category: 'Development', minutes: 150, startMinutes: 540, billable: true },
  { id: 'te419', personId: 'devon-marsh', date: addDays(threeWeeksAgoStart, 2), description: 'Daily standup', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 265, startMinutes: 540 },
  { id: 'te420', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 0), description: 'Building UI components', projectId: 'nimbus-onboarding', category: 'Development', minutes: 255, startMinutes: 540, billable: true },
  { id: 'te421', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 1), description: 'Admin tasks', projectId: 'pinecrest-crm', category: 'Admin', minutes: 310, startMinutes: 540, billable: false },
  { id: 'te422', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 1), description: 'Reviewing teammate PRs', projectId: 'pinecrest-crm', category: 'Code Review', minutes: 295, startMinutes: 865, billable: true },
  { id: 'te423', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 2), description: 'Email triage', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 170, startMinutes: 540, billable: false },
  { id: 'te424', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'pinecrest-crm', category: 'Admin', minutes: 95, startMinutes: 710, billable: false },
  { id: 'te425', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 145, startMinutes: 540, billable: true },
  { id: 'te426', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 3), description: 'Client sync call', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 55, startMinutes: 700 },
  { id: 'te427', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'pinecrest-crm', category: 'Code Review', minutes: 495, startMinutes: 540, billable: true },
  { id: 'te428', personId: 'devon-marsh', date: addDays(fourWeeksAgoStart, 4), description: 'Sprint planning', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 90, startMinutes: 1035 },
  { id: 'te429', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 1), description: 'Writing unit tests', projectId: 'nimbus-onboarding', category: 'Development', minutes: 285, startMinutes: 540, billable: true },
  { id: 'te430', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 1), description: 'Refactoring service layer', projectId: 'nimbus-onboarding', category: 'Development', minutes: 155, startMinutes: 825, billable: true },
  { id: 'te431', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'pinecrest-crm', category: 'Admin', minutes: 145, startMinutes: 540, billable: false },
  { id: 'te432', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 2), description: 'API integration', projectId: 'nimbus-onboarding', category: 'Development', minutes: 330, startMinutes: 685, billable: true },
  { id: 'te433', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 3), description: 'Writing unit tests', projectId: 'pinecrest-crm', category: 'Development', minutes: 390, startMinutes: 540, billable: true },
  { id: 'te434', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 3), description: 'Refactoring service layer', projectId: 'pinecrest-crm', category: 'Development', minutes: 70, startMinutes: 930 },
  { id: 'te435', personId: 'devon-marsh', date: addDays(fiveWeeksAgoStart, 4), description: 'Sprint planning', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 490, startMinutes: 540, billable: true },
  { id: 'te436', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 0), description: 'Documentation updates', projectId: 'pinecrest-crm', category: 'Admin', minutes: 65, startMinutes: 540, billable: false },
  { id: 'te437', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 0), description: 'Sprint planning', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 420, startMinutes: 635, billable: true },
  { id: 'te438', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 1), description: 'Writing unit tests', projectId: 'nimbus-onboarding', category: 'Development', minutes: 305, startMinutes: 540, billable: true },
  { id: 'te439', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 1), description: 'Client sync call', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 295, startMinutes: 845 },
  { id: 'te440', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 3), description: 'Email triage', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 215, startMinutes: 540, billable: false },
  { id: 'te441', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 4), description: 'Stakeholder update', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 80, startMinutes: 540 },
  { id: 'te442', personId: 'devon-marsh', date: addDays(sixWeeksAgoStart, 4), description: 'Daily standup', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 400, startMinutes: 650 },
  { id: 'te443', personId: 'devon-marsh', date: addDays(sevenWeeksAgoStart, 0), description: 'Client sync call', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 115, startMinutes: 540 },
  { id: 'te444', personId: 'devon-marsh', date: addDays(sevenWeeksAgoStart, 0), description: 'Expense reports', projectId: 'pinecrest-crm', category: 'Admin', minutes: 350, startMinutes: 685, billable: false },
  { id: 'te445', personId: 'devon-marsh', date: addDays(sevenWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 180, startMinutes: 540, billable: false },
  { id: 'te446', personId: 'devon-marsh', date: addDays(sevenWeeksAgoStart, 3), description: 'Documentation updates', projectId: 'nimbus-onboarding', category: 'Admin', minutes: 200, startMinutes: 540 },
  { id: 'te447', personId: 'devon-marsh', date: addDays(sevenWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 425, startMinutes: 540, billable: true },
  { id: 'te448', personId: 'isabela-costa', date: addDays(lastWeekStart, 0), description: 'Bug fixes', projectId: 'nimbus-onboarding', category: 'Development', minutes: 490, startMinutes: 540, billable: true },
  { id: 'te449', personId: 'isabela-costa', date: addDays(lastWeekStart, 1), description: 'API integration', projectId: 'nimbus-onboarding', category: 'Development', minutes: 465, startMinutes: 540, billable: true },
  { id: 'te450', personId: 'isabela-costa', date: addDays(lastWeekStart, 2), description: 'Sprint planning', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 480, startMinutes: 540 },
  { id: 'te451', personId: 'isabela-costa', date: addDays(lastWeekStart, 3), description: 'Feature implementation', projectId: 'nimbus-onboarding', category: 'Development', minutes: 450, startMinutes: 540, billable: true },
  { id: 'te452', personId: 'isabela-costa', date: addDays(lastWeekStart, 4), description: 'Client sync call', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 255, startMinutes: 540 },
  { id: 'te453', personId: 'isabela-costa', date: addDays(lastWeekStart, 4), description: 'Performance tuning', projectId: 'quartz-mobile', category: 'Development', minutes: 375, startMinutes: 825 },
  { id: 'te454', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 0), description: 'Reviewing teammate PRs', projectId: 'quartz-mobile', category: 'Code Review', minutes: 440, startMinutes: 540, billable: true },
  { id: 'te455', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 1), description: 'Building UI components', projectId: 'quartz-mobile', category: 'Development', minutes: 330, startMinutes: 540, billable: true },
  { id: 'te456', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 1), description: 'Sprint retro', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 175, startMinutes: 885, billable: false },
  { id: 'te457', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 2), description: '1:1 with manager', projectId: 'nimbus-onboarding', category: 'Meetings & Calls', minutes: 130, startMinutes: 540 },
  { id: 'te458', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 2), description: 'Reviewing teammate PRs', projectId: 'quartz-mobile', category: 'Code Review', minutes: 320, startMinutes: 670, billable: true },
  { id: 'te459', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 3), description: 'Database migration script', projectId: 'quartz-mobile', category: 'Development', minutes: 430, startMinutes: 540, billable: true },
  { id: 'te460', personId: 'isabela-costa', date: addDays(twoWeeksAgoStart, 4), description: 'PR review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 180, startMinutes: 540, billable: true },
  { id: 'te461', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 1), description: 'Reviewing teammate PRs', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 145, startMinutes: 540, billable: true },
  { id: 'te462', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 1), description: 'Code review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 55, startMinutes: 685, billable: true },
  { id: 'te463', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 2), description: 'PR review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 250, startMinutes: 540 },
  { id: 'te464', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 3), description: 'API integration', projectId: 'nimbus-onboarding', category: 'Development', minutes: 300, startMinutes: 540, billable: true },
  { id: 'te465', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 3), description: 'Reviewing teammate PRs', projectId: 'quartz-mobile', category: 'Code Review', minutes: 170, startMinutes: 840, billable: true },
  { id: 'te466', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 4), description: 'Code review', projectId: 'quartz-mobile', category: 'Code Review', minutes: 370, startMinutes: 540, billable: true },
  { id: 'te467', personId: 'isabela-costa', date: addDays(threeWeeksAgoStart, 4), description: 'Sprint retro', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 115, startMinutes: 910 },
  { id: 'te468', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 0), description: 'Reviewing teammate PRs', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 280, startMinutes: 540, billable: true },
  { id: 'te469', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'quartz-mobile', category: 'Meetings & Calls', minutes: 200, startMinutes: 820 },
  { id: 'te470', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 1), description: 'Code review', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 195, startMinutes: 540 },
  { id: 'te471', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 1), description: 'API integration', projectId: 'quartz-mobile', category: 'Development', minutes: 230, startMinutes: 735, billable: true },
  { id: 'te472', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 2), description: 'Building UI components', projectId: 'quartz-mobile', category: 'Development', minutes: 490, startMinutes: 540, billable: true },
  { id: 'te473', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 3), description: 'PR review', projectId: 'nimbus-onboarding', category: 'Code Review', minutes: 205, startMinutes: 540, billable: true },
  { id: 'te474', personId: 'isabela-costa', date: addDays(fourWeeksAgoStart, 3), description: 'Database migration script', projectId: 'nimbus-onboarding', category: 'Development', minutes: 35, startMinutes: 775, billable: true },
  { id: 'te475', personId: 'kwame-mensah', date: addDays(lastWeekStart, 0), description: 'PR review', projectId: 'pinecrest-crm', category: 'Code Review', minutes: 100, startMinutes: 540, billable: true },
  { id: 'te476', personId: 'kwame-mensah', date: addDays(lastWeekStart, 0), description: 'Code review', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 100, startMinutes: 670, billable: true },
  { id: 'te477', personId: 'kwame-mensah', date: addDays(lastWeekStart, 1), description: 'Performance tuning', projectId: 'vertex-data-lake', category: 'Development', minutes: 60, startMinutes: 540, billable: true },
  { id: 'te478', personId: 'kwame-mensah', date: addDays(lastWeekStart, 1), description: 'Feature implementation', projectId: 'vertex-data-lake', category: 'Development', minutes: 160, startMinutes: 615, billable: true },
  { id: 'te479', personId: 'kwame-mensah', date: addDays(lastWeekStart, 2), description: 'Writing unit tests', projectId: 'vertex-data-lake', category: 'Development', minutes: 415, startMinutes: 540, billable: true },
  { id: 'te480', personId: 'kwame-mensah', date: addDays(lastWeekStart, 2), description: 'Stakeholder update', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 55, startMinutes: 985 },
  { id: 'te481', personId: 'kwame-mensah', date: addDays(lastWeekStart, 3), description: 'Writing unit tests', projectId: 'vertex-data-lake', category: 'Development', minutes: 40, startMinutes: 540, billable: true },
  { id: 'te482', personId: 'kwame-mensah', date: addDays(lastWeekStart, 3), description: 'Code review', projectId: 'pinecrest-crm', category: 'Code Review', minutes: 575, startMinutes: 595, billable: false },
  { id: 'te483', personId: 'kwame-mensah', date: addDays(lastWeekStart, 4), description: 'Sprint planning', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 115, startMinutes: 540 },
  { id: 'te484', personId: 'kwame-mensah', date: addDays(lastWeekStart, 4), description: 'Stakeholder update', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 345, startMinutes: 685 },
  { id: 'te485', personId: 'kwame-mensah', date: addDays(twoWeeksAgoStart, 0), description: 'Refactoring service layer', projectId: 'vertex-data-lake', category: 'Development', minutes: 225, startMinutes: 540, billable: true },
  { id: 'te486', personId: 'kwame-mensah', date: addDays(twoWeeksAgoStart, 3), description: 'Code review', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 260, startMinutes: 540, billable: true },
  { id: 'te487', personId: 'kwame-mensah', date: addDays(threeWeeksAgoStart, 0), description: 'Code review', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 225, startMinutes: 540, billable: true },
  { id: 'te488', personId: 'kwame-mensah', date: addDays(threeWeeksAgoStart, 0), description: 'Daily standup', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 280, startMinutes: 780 },
  { id: 'te489', personId: 'kwame-mensah', date: addDays(threeWeeksAgoStart, 1), description: 'Database migration script', projectId: 'pinecrest-crm', category: 'Development', minutes: 295, startMinutes: 540, billable: true },
  { id: 'te490', personId: 'kwame-mensah', date: addDays(threeWeeksAgoStart, 3), description: 'Stakeholder update', projectId: 'pinecrest-crm', category: 'Meetings & Calls', minutes: 480, startMinutes: 540 },
  { id: 'te491', personId: 'kwame-mensah', date: addDays(threeWeeksAgoStart, 4), description: 'API integration', projectId: 'vertex-data-lake', category: 'Development', minutes: 445, startMinutes: 540, billable: true },
  { id: 'te492', personId: 'kwame-mensah', date: addDays(threeWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 55, startMinutes: 985 },
  { id: 'te493', personId: 'kwame-mensah', date: addDays(fourWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'vertex-data-lake', category: 'Development', minutes: 195, startMinutes: 540, billable: true },
  { id: 'te494', personId: 'kwame-mensah', date: addDays(fourWeeksAgoStart, 1), description: 'Sprint retro', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 230, startMinutes: 540, billable: false },
  { id: 'te495', personId: 'kwame-mensah', date: addDays(fourWeeksAgoStart, 1), description: 'Reviewing teammate PRs', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 240, startMinutes: 770, billable: true },
  { id: 'te496', personId: 'kwame-mensah', date: addDays(fourWeeksAgoStart, 3), description: 'Roadmap planning', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 265, startMinutes: 540, billable: false },
  { id: 'te497', personId: 'kwame-mensah', date: addDays(fourWeeksAgoStart, 4), description: 'API integration', projectId: 'vertex-data-lake', category: 'Development', minutes: 200, startMinutes: 540, billable: true },
  { id: 'te498', personId: 'nadia-rahman', date: addDays(lastWeekStart, 0), description: 'Daily standup', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 500, startMinutes: 540 },
  { id: 'te499', personId: 'nadia-rahman', date: addDays(lastWeekStart, 2), description: 'Database migration script', projectId: 'orbit-analytics', category: 'Development', minutes: 305, startMinutes: 540, billable: true },
  { id: 'te500', personId: 'nadia-rahman', date: addDays(lastWeekStart, 2), description: 'Writing unit tests', projectId: 'orbit-analytics', category: 'Development', minutes: 195, startMinutes: 860, billable: true },
  { id: 'te501', personId: 'nadia-rahman', date: addDays(lastWeekStart, 3), description: '1:1 with manager', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 425, startMinutes: 540 },
  { id: 'te502', personId: 'nadia-rahman', date: addDays(lastWeekStart, 4), description: 'Database migration script', projectId: 'orbit-analytics', category: 'Development', minutes: 50, startMinutes: 540 },
  { id: 'te503', personId: 'nadia-rahman', date: addDays(lastWeekStart, 4), description: 'Sprint retro', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 225, startMinutes: 590 },
  { id: 'te504', personId: 'nadia-rahman', date: addDays(twoWeeksAgoStart, 0), description: 'Data entry', projectId: 'orbit-analytics', category: 'Manual', minutes: 470, startMinutes: 540, billable: true },
  { id: 'te505', personId: 'nadia-rahman', date: addDays(twoWeeksAgoStart, 2), description: 'Manual QA pass', projectId: 'orbit-analytics', category: 'Manual', minutes: 265, startMinutes: 540 },
  { id: 'te506', personId: 'nadia-rahman', date: addDays(twoWeeksAgoStart, 2), description: 'Sprint retro', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 165, startMinutes: 820 },
  { id: 'te507', personId: 'nadia-rahman', date: addDays(twoWeeksAgoStart, 4), description: 'Manual QA pass', projectId: 'orbit-analytics', category: 'Manual', minutes: 420, startMinutes: 540 },
  { id: 'te508', personId: 'nadia-rahman', date: addDays(twoWeeksAgoStart, 4), description: 'Performance tuning', projectId: 'orbit-analytics', category: 'Development', minutes: 170, startMinutes: 990, billable: true },
  { id: 'te509', personId: 'nadia-rahman', date: addDays(threeWeeksAgoStart, 0), description: 'Sprint planning', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 480, startMinutes: 540 },
  { id: 'te510', personId: 'nadia-rahman', date: addDays(threeWeeksAgoStart, 2), description: 'Data entry', projectId: 'orbit-analytics', category: 'Manual', minutes: 265, startMinutes: 540 },
  { id: 'te511', personId: 'nadia-rahman', date: addDays(threeWeeksAgoStart, 2), description: 'Manual QA pass', projectId: 'orbit-analytics', category: 'Manual', minutes: 360, startMinutes: 805 },
  { id: 'te512', personId: 'nadia-rahman', date: addDays(threeWeeksAgoStart, 3), description: 'Daily standup', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 205, startMinutes: 540, billable: true },
  { id: 'te513', personId: 'nadia-rahman', date: addDays(threeWeeksAgoStart, 4), description: 'Manual regression testing', projectId: 'orbit-analytics', category: 'Manual', minutes: 55, startMinutes: 540 },
  { id: 'te514', personId: 'nadia-rahman', date: addDays(threeWeeksAgoStart, 4), description: 'Manual regression testing', projectId: 'orbit-analytics', category: 'Manual', minutes: 120, startMinutes: 610 },
  { id: 'te515', personId: 'nadia-rahman', date: addDays(fourWeeksAgoStart, 0), description: 'Manual regression testing', projectId: 'orbit-analytics', category: 'Manual', minutes: 285, startMinutes: 540 },
  { id: 'te516', personId: 'nadia-rahman', date: addDays(fourWeeksAgoStart, 2), description: 'Sprint planning', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 295, startMinutes: 540, billable: false },
  { id: 'te517', personId: 'nadia-rahman', date: addDays(fourWeeksAgoStart, 3), description: '1:1 with manager', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 240, startMinutes: 540 },
  { id: 'te518', personId: 'nadia-rahman', date: addDays(fourWeeksAgoStart, 3), description: 'Sprint retro', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 375, startMinutes: 780 },
  { id: 'te519', personId: 'nadia-rahman', date: addDays(fourWeeksAgoStart, 4), description: 'Writing unit tests', projectId: 'orbit-analytics', category: 'Development', minutes: 75, startMinutes: 540, billable: true },
  { id: 'te520', personId: 'nadia-rahman', date: addDays(fourWeeksAgoStart, 4), description: 'Data entry', projectId: 'orbit-analytics', category: 'Manual', minutes: 355, startMinutes: 630 },
  { id: 'te521', personId: 'felix-huber', date: addDays(lastWeekStart, 0), description: 'Bug fixes', projectId: 'orbit-analytics', category: 'Development', minutes: 195, startMinutes: 540, billable: true },
  { id: 'te522', personId: 'felix-huber', date: addDays(lastWeekStart, 0), description: 'Roadmap planning', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 100, startMinutes: 735 },
  { id: 'te523', personId: 'felix-huber', date: addDays(lastWeekStart, 2), description: 'Documentation updates', projectId: 'talon-security-audit', category: 'Admin', minutes: 500, startMinutes: 540, billable: false },
  { id: 'te524', personId: 'felix-huber', date: addDays(lastWeekStart, 3), description: 'Admin tasks', projectId: 'orbit-analytics', category: 'Admin', minutes: 195, startMinutes: 540, billable: false },
  { id: 'te525', personId: 'felix-huber', date: addDays(lastWeekStart, 3), description: 'Stakeholder update', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 225, startMinutes: 765, billable: true },
  { id: 'te526', personId: 'felix-huber', date: addDays(lastWeekStart, 4), description: 'Email triage', projectId: 'orbit-analytics', category: 'Admin', minutes: 290, startMinutes: 540, billable: false },
  { id: 'te527', personId: 'felix-huber', date: addDays(twoWeeksAgoStart, 0), description: 'Bug fixes', projectId: 'talon-security-audit', category: 'Development', minutes: 245, startMinutes: 540, billable: true },
  { id: 'te528', personId: 'felix-huber', date: addDays(twoWeeksAgoStart, 1), description: 'Roadmap planning', projectId: 'orbit-analytics', category: 'Meetings & Calls', minutes: 470, startMinutes: 540 },
  { id: 'te529', personId: 'felix-huber', date: addDays(twoWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'orbit-analytics', category: 'Admin', minutes: 120, startMinutes: 540, billable: true },
  { id: 'te530', personId: 'felix-huber', date: addDays(twoWeeksAgoStart, 2), description: 'Roadmap planning', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 30, startMinutes: 660 },
  { id: 'te531', personId: 'felix-huber', date: addDays(twoWeeksAgoStart, 3), description: 'Writing unit tests', projectId: 'orbit-analytics', category: 'Development', minutes: 120, startMinutes: 540, billable: true },
  { id: 'te532', personId: 'felix-huber', date: addDays(twoWeeksAgoStart, 3), description: '1:1 with manager', projectId: 'talon-security-audit', category: 'Meetings & Calls', minutes: 55, startMinutes: 660, billable: false },
  { id: 'te533', personId: 'felix-huber', date: addDays(threeWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'talon-security-audit', category: 'Development', minutes: 120, startMinutes: 540, billable: true },
  { id: 'te534', personId: 'felix-huber', date: addDays(threeWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'talon-security-audit', category: 'Admin', minutes: 355, startMinutes: 660, billable: false },
  { id: 'te535', personId: 'felix-huber', date: addDays(threeWeeksAgoStart, 2), description: 'Email triage', projectId: 'talon-security-audit', category: 'Admin', minutes: 445, startMinutes: 540, billable: false },
  { id: 'te536', personId: 'felix-huber', date: addDays(fourWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'orbit-analytics', category: 'Admin', minutes: 80, startMinutes: 540, billable: false },
  { id: 'te537', personId: 'felix-huber', date: addDays(fourWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'orbit-analytics', category: 'Development', minutes: 85, startMinutes: 635 },
  { id: 'te538', personId: 'felix-huber', date: addDays(fourWeeksAgoStart, 2), description: 'Bug fixes', projectId: 'orbit-analytics', category: 'Development', minutes: 465, startMinutes: 540, billable: false },
  { id: 'te539', personId: 'felix-huber', date: addDays(fourWeeksAgoStart, 3), description: 'Email triage', projectId: 'orbit-analytics', category: 'Admin', minutes: 255, startMinutes: 540, billable: false },
  { id: 'te540', personId: 'felix-huber', date: addDays(fourWeeksAgoStart, 3), description: 'Admin tasks', projectId: 'orbit-analytics', category: 'Admin', minutes: 330, startMinutes: 825, billable: false },
  { id: 'te541', personId: 'meera-pillai', date: addDays(lastWeekStart, 0), description: 'Code review', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 175, startMinutes: 540, billable: true },
  { id: 'te542', personId: 'meera-pillai', date: addDays(lastWeekStart, 1), description: 'Refactoring service layer', projectId: 'orbit-analytics', category: 'Development', minutes: 425, startMinutes: 540, billable: true },
  { id: 'te543', personId: 'meera-pillai', date: addDays(lastWeekStart, 3), description: 'Refactoring service layer', projectId: 'vertex-data-lake', category: 'Development', minutes: 45, startMinutes: 540, billable: true },
  { id: 'te544', personId: 'meera-pillai', date: addDays(lastWeekStart, 3), description: 'API integration', projectId: 'vertex-data-lake', category: 'Development', minutes: 250, startMinutes: 615, billable: true },
  { id: 'te545', personId: 'meera-pillai', date: addDays(lastWeekStart, 4), description: 'Bug fixes', projectId: 'orbit-analytics', category: 'Development', minutes: 230, startMinutes: 540, billable: true },
  { id: 'te546', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 0), description: 'Bug fixes', projectId: 'vertex-data-lake', category: 'Development', minutes: 240, startMinutes: 540, billable: true },
  { id: 'te547', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 1), description: 'Performance tuning', projectId: 'orbit-analytics', category: 'Development', minutes: 280, startMinutes: 540, billable: true },
  { id: 'te548', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 2), description: 'Code review', projectId: 'vertex-data-lake', category: 'Code Review', minutes: 365, startMinutes: 540, billable: true },
  { id: 'te549', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 2), description: 'Daily standup', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 75, startMinutes: 920 },
  { id: 'te550', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 3), description: 'Daily standup', projectId: 'vertex-data-lake', category: 'Meetings & Calls', minutes: 480, startMinutes: 540, billable: true },
  { id: 'te551', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 4), description: 'Reviewing teammate PRs', projectId: 'orbit-analytics', category: 'Code Review', minutes: 415, startMinutes: 540 },
  { id: 'te552', personId: 'meera-pillai', date: addDays(twoWeeksAgoStart, 4), description: 'Database migration script', projectId: 'vertex-data-lake', category: 'Development', minutes: 45, startMinutes: 955, billable: true },
  { id: 'te553', personId: 'meera-pillai', date: addDays(threeWeeksAgoStart, 0), description: 'Writing unit tests', projectId: 'vertex-data-lake', category: 'Development', minutes: 480, startMinutes: 540, billable: true },
  { id: 'te554', personId: 'meera-pillai', date: addDays(threeWeeksAgoStart, 3), description: 'Code review', projectId: 'orbit-analytics', category: 'Code Review', minutes: 295, startMinutes: 540, billable: true },
  { id: 'te555', personId: 'diego-alvarez', date: addDays(lastWeekStart, 0), description: 'Competitor analysis', projectId: 'summit-partnership', category: 'Research', minutes: 155, startMinutes: 540 },
  { id: 'te556', personId: 'diego-alvarez', date: addDays(lastWeekStart, 0), description: 'Email triage', projectId: 'summit-partnership', category: 'Admin', minutes: 450, startMinutes: 695, billable: false },
  { id: 'te557', personId: 'diego-alvarez', date: addDays(lastWeekStart, 2), description: 'Technical spike', projectId: 'summit-partnership', category: 'Research', minutes: 255, startMinutes: 540 },
  { id: 'te558', personId: 'diego-alvarez', date: addDays(lastWeekStart, 3), description: 'Market research', projectId: 'summit-partnership', category: 'Research', minutes: 55, startMinutes: 540 },
  { id: 'te559', personId: 'diego-alvarez', date: addDays(lastWeekStart, 3), description: 'Market research', projectId: 'summit-partnership', category: 'Research', minutes: 375, startMinutes: 595 },
  { id: 'te560', personId: 'diego-alvarez', date: addDays(lastWeekStart, 4), description: 'Onboarding paperwork', projectId: 'summit-partnership', category: 'Admin', minutes: 390, startMinutes: 540, billable: false },
  { id: 'te561', personId: 'diego-alvarez', date: addDays(lastWeekStart, 4), description: 'Onboarding paperwork', projectId: null, category: 'Admin', minutes: 110, startMinutes: 960 },
  { id: 'te562', personId: 'diego-alvarez', date: addDays(twoWeeksAgoStart, 0), description: 'Email triage', projectId: 'summit-partnership', category: 'Admin', minutes: 215, startMinutes: 540, billable: false },
  { id: 'te563', personId: 'diego-alvarez', date: addDays(twoWeeksAgoStart, 0), description: 'Documentation updates', projectId: 'summit-partnership', category: 'Admin', minutes: 255, startMinutes: 755, billable: false },
  { id: 'te564', personId: 'diego-alvarez', date: addDays(twoWeeksAgoStart, 1), description: 'Competitor analysis', projectId: 'summit-partnership', category: 'Research', minutes: 195, startMinutes: 540 },
  { id: 'te565', personId: 'diego-alvarez', date: addDays(twoWeeksAgoStart, 2), description: 'Market research', projectId: 'summit-partnership', category: 'Research', minutes: 470, startMinutes: 540 },
  { id: 'te566', personId: 'diego-alvarez', date: addDays(twoWeeksAgoStart, 3), description: 'Sprint planning', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 245, startMinutes: 540 },
  { id: 'te567', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 0), description: 'Documentation updates', projectId: null, category: 'Admin', minutes: 205, startMinutes: 540, billable: false },
  { id: 'te568', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'summit-partnership', category: 'Admin', minutes: 260, startMinutes: 775, billable: false },
  { id: 'te569', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 1), description: 'Roadmap planning', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 360, startMinutes: 540 },
  { id: 'te570', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 1), description: 'Competitor analysis', projectId: null, category: 'Research', minutes: 130, startMinutes: 900, billable: true },
  { id: 'te571', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 2), description: 'Daily standup', projectId: null, category: 'Meetings & Calls', minutes: 55, startMinutes: 540 },
  { id: 'te572', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 2), description: 'Daily standup', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 440, startMinutes: 610 },
  { id: 'te573', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 3), description: 'Client sync call', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 450, startMinutes: 540, billable: true },
  { id: 'te574', personId: 'diego-alvarez', date: addDays(threeWeeksAgoStart, 4), description: 'Sprint retro', projectId: null, category: 'Meetings & Calls', minutes: 460, startMinutes: 540 },
  { id: 'te575', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 0), description: 'Email triage', projectId: 'summit-partnership', category: 'Admin', minutes: 85, startMinutes: 540, billable: false },
  { id: 'te576', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 0), description: 'Technical spike', projectId: null, category: 'Research', minutes: 490, startMinutes: 640, billable: false },
  { id: 'te577', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 1), description: 'Technical spike', projectId: 'summit-partnership', category: 'Research', minutes: 225, startMinutes: 540, billable: false },
  { id: 'te578', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 1), description: 'Daily standup', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 245, startMinutes: 795, billable: false },
  { id: 'te579', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 2), description: 'Documentation updates', projectId: null, category: 'Admin', minutes: 430, startMinutes: 540, billable: false },
  { id: 'te580', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 3), description: 'Market research', projectId: null, category: 'Research', minutes: 500, startMinutes: 540 },
  { id: 'te581', personId: 'diego-alvarez', date: addDays(fourWeeksAgoStart, 4), description: 'Sprint retro', projectId: null, category: 'Meetings & Calls', minutes: 425, startMinutes: 540, billable: false },
  { id: 'te582', personId: 'grace-kim', date: addDays(lastWeekStart, 0), description: '1:1 with manager', projectId: null, category: 'Meetings & Calls', minutes: 95, startMinutes: 540 },
  { id: 'te583', personId: 'grace-kim', date: addDays(lastWeekStart, 0), description: 'Competitor analysis', projectId: null, category: 'Research', minutes: 485, startMinutes: 650, billable: false },
  { id: 'te584', personId: 'grace-kim', date: addDays(lastWeekStart, 1), description: 'Sprint planning', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 210, startMinutes: 540 },
  { id: 'te585', personId: 'grace-kim', date: addDays(lastWeekStart, 2), description: 'Technical spike', projectId: null, category: 'Research', minutes: 285, startMinutes: 540 },
  { id: 'te586', personId: 'grace-kim', date: addDays(twoWeeksAgoStart, 0), description: 'Email triage', projectId: null, category: 'Admin', minutes: 255, startMinutes: 540, billable: false },
  { id: 'te587', personId: 'grace-kim', date: addDays(twoWeeksAgoStart, 1), description: 'Roadmap planning', projectId: null, category: 'Meetings & Calls', minutes: 265, startMinutes: 540, billable: false },
  { id: 'te588', personId: 'grace-kim', date: addDays(twoWeeksAgoStart, 3), description: 'Stakeholder update', projectId: null, category: 'Meetings & Calls', minutes: 505, startMinutes: 540 },
  { id: 'te589', personId: 'grace-kim', date: addDays(threeWeeksAgoStart, 0), description: 'Client sync call', projectId: 'summit-partnership', category: 'Meetings & Calls', minutes: 510, startMinutes: 540 },
  { id: 'te590', personId: 'grace-kim', date: addDays(threeWeeksAgoStart, 4), description: 'Market research', projectId: 'summit-partnership', category: 'Research', minutes: 465, startMinutes: 540 },
  { id: 'te591', personId: 'henrik-larsen', date: addDays(lastWeekStart, 0), description: 'Competitor analysis', projectId: 'echo-initiative', category: 'Research', minutes: 325, startMinutes: 540 },
  { id: 'te592', personId: 'henrik-larsen', date: addDays(lastWeekStart, 0), description: 'Expense reports', projectId: 'aurora-redesign', category: 'Admin', minutes: 255, startMinutes: 865, billable: false },
  { id: 'te593', personId: 'henrik-larsen', date: addDays(lastWeekStart, 1), description: 'Technical spike', projectId: 'echo-initiative', category: 'Research', minutes: 485, startMinutes: 540 },
  { id: 'te594', personId: 'henrik-larsen', date: addDays(lastWeekStart, 2), description: 'Expense reports', projectId: 'aurora-redesign', category: 'Admin', minutes: 235, startMinutes: 540, billable: false },
  { id: 'te595', personId: 'henrik-larsen', date: addDays(lastWeekStart, 3), description: 'Admin tasks', projectId: 'echo-initiative', category: 'Admin', minutes: 160, startMinutes: 540 },
  { id: 'te596', personId: 'henrik-larsen', date: addDays(lastWeekStart, 3), description: 'Competitor analysis', projectId: 'aurora-redesign', category: 'Research', minutes: 260, startMinutes: 715 },
  { id: 'te597', personId: 'henrik-larsen', date: addDays(lastWeekStart, 4), description: 'Roadmap planning', projectId: 'aurora-redesign', category: 'Meetings & Calls', minutes: 210, startMinutes: 540 },
  { id: 'te598', personId: 'henrik-larsen', date: addDays(twoWeeksAgoStart, 1), description: 'Competitor analysis', projectId: 'aurora-redesign', category: 'Research', minutes: 235, startMinutes: 540, billable: false },
  { id: 'te599', personId: 'henrik-larsen', date: addDays(twoWeeksAgoStart, 2), description: 'Market research', projectId: 'echo-initiative', category: 'Research', minutes: 440, startMinutes: 540 },
  { id: 'te600', personId: 'henrik-larsen', date: addDays(twoWeeksAgoStart, 3), description: 'Expense reports', projectId: 'aurora-redesign', category: 'Admin', minutes: 480, startMinutes: 540, billable: false },
  { id: 'te601', personId: 'henrik-larsen', date: addDays(threeWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'aurora-redesign', category: 'Admin', minutes: 480, startMinutes: 540, billable: false },
  { id: 'te602', personId: 'henrik-larsen', date: addDays(threeWeeksAgoStart, 3), description: 'Competitor analysis', projectId: 'aurora-redesign', category: 'Research', minutes: 295, startMinutes: 540 },
  { id: 'te603', personId: 'henrik-larsen', date: addDays(threeWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: 'echo-initiative', category: 'Admin', minutes: 435, startMinutes: 540, billable: false },
  { id: 'te604', personId: 'aaliyah-johnson', date: addDays(lastWeekStart, 1), description: 'Market research', projectId: 'vantage-crm', category: 'Research', minutes: 365, startMinutes: 540 },
  { id: 'te605', personId: 'aaliyah-johnson', date: addDays(lastWeekStart, 1), description: 'Roadmap planning', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 70, startMinutes: 935 },
  { id: 'te606', personId: 'aaliyah-johnson', date: addDays(lastWeekStart, 2), description: 'Competitor analysis', projectId: 'echo-integration', category: 'Research', minutes: 555, startMinutes: 540, billable: false },
  { id: 'te607', personId: 'aaliyah-johnson', date: addDays(lastWeekStart, 2), description: 'Client sync call', projectId: 'vantage-crm', category: 'Meetings & Calls', minutes: 30, startMinutes: 1095, billable: false },
  { id: 'te608', personId: 'aaliyah-johnson', date: addDays(lastWeekStart, 3), description: 'Onboarding paperwork', projectId: 'echo-integration', category: 'Admin', minutes: 460, startMinutes: 540, billable: false },
  { id: 'te609', personId: 'aaliyah-johnson', date: addDays(lastWeekStart, 4), description: 'Market research', projectId: 'echo-integration', category: 'Research', minutes: 470, startMinutes: 540, billable: false },
  { id: 'te610', personId: 'aaliyah-johnson', date: addDays(twoWeeksAgoStart, 0), description: 'Expense reports', projectId: 'echo-integration', category: 'Admin', minutes: 160, startMinutes: 540, billable: false },
  { id: 'te611', personId: 'aaliyah-johnson', date: addDays(twoWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'echo-integration', category: 'Meetings & Calls', minutes: 45, startMinutes: 730 },
  { id: 'te612', personId: 'aaliyah-johnson', date: addDays(twoWeeksAgoStart, 1), description: 'Technical spike', projectId: 'vantage-crm', category: 'Research', minutes: 205, startMinutes: 540, billable: false },
  { id: 'te613', personId: 'aaliyah-johnson', date: addDays(twoWeeksAgoStart, 2), description: 'Competitor analysis', projectId: 'echo-integration', category: 'Research', minutes: 450, startMinutes: 540 },
  { id: 'te614', personId: 'aaliyah-johnson', date: addDays(twoWeeksAgoStart, 3), description: 'Technical spike', projectId: 'echo-integration', category: 'Research', minutes: 235, startMinutes: 540 },
  { id: 'te615', personId: 'aaliyah-johnson', date: addDays(twoWeeksAgoStart, 3), description: 'Documentation updates', projectId: 'echo-integration', category: 'Admin', minutes: 345, startMinutes: 775, billable: false },
  { id: 'te616', personId: 'aaliyah-johnson', date: addDays(threeWeeksAgoStart, 1), description: 'Documentation updates', projectId: 'echo-integration', category: 'Admin', minutes: 290, startMinutes: 540, billable: false },
  { id: 'te617', personId: 'aaliyah-johnson', date: addDays(threeWeeksAgoStart, 2), description: 'Market research', projectId: 'vantage-crm', category: 'Research', minutes: 190, startMinutes: 540, billable: true },
  { id: 'te618', personId: 'aaliyah-johnson', date: addDays(threeWeeksAgoStart, 4), description: 'Competitor analysis', projectId: 'vantage-crm', category: 'Research', minutes: 260, startMinutes: 540 },
  { id: 'te619', personId: 'aaliyah-johnson', date: addDays(fourWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'vantage-crm', category: 'Admin', minutes: 165, startMinutes: 540, billable: false },
  { id: 'te620', personId: 'aaliyah-johnson', date: addDays(fourWeeksAgoStart, 1), description: 'Market research', projectId: 'vantage-crm', category: 'Research', minutes: 250, startMinutes: 540 },
  { id: 'te621', personId: 'aaliyah-johnson', date: addDays(fourWeeksAgoStart, 3), description: 'Technical spike', projectId: 'vantage-crm', category: 'Research', minutes: 485, startMinutes: 540 },
  { id: 'te622', personId: 'fatima-al-sayed', date: addDays(lastWeekStart, 0), description: 'Email triage', projectId: 'union-hr-portal', category: 'Admin', minutes: 460, startMinutes: 540, billable: false },
  { id: 'te623', personId: 'fatima-al-sayed', date: addDays(lastWeekStart, 1), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 435, startMinutes: 540, billable: false },
  { id: 'te624', personId: 'fatima-al-sayed', date: addDays(lastWeekStart, 3), description: 'Sprint retro', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 155, startMinutes: 540 },
  { id: 'te625', personId: 'fatima-al-sayed', date: addDays(twoWeeksAgoStart, 0), description: 'Email triage', projectId: 'union-hr-portal', category: 'Admin', minutes: 500, startMinutes: 540, billable: false },
  { id: 'te626', personId: 'fatima-al-sayed', date: addDays(twoWeeksAgoStart, 2), description: 'Admin tasks', projectId: 'union-hr-portal', category: 'Admin', minutes: 445, startMinutes: 540, billable: false },
  { id: 'te627', personId: 'fatima-al-sayed', date: addDays(twoWeeksAgoStart, 3), description: 'Admin tasks', projectId: 'union-hr-portal', category: 'Admin', minutes: 300, startMinutes: 540, billable: false },
  { id: 'te628', personId: 'fatima-al-sayed', date: addDays(twoWeeksAgoStart, 3), description: 'Documentation updates', projectId: 'union-hr-portal', category: 'Admin', minutes: 295, startMinutes: 840, billable: false },
  { id: 'te629', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 0), description: 'Expense reports', projectId: 'union-hr-portal', category: 'Admin', minutes: 40, startMinutes: 540, billable: false },
  { id: 'te630', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'union-hr-portal', category: 'Admin', minutes: 120, startMinutes: 595, billable: false },
  { id: 'te631', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 1), description: 'Daily standup', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 230, startMinutes: 540 },
  { id: 'te632', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 1), description: '1:1 with manager', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 360, startMinutes: 800 },
  { id: 'te633', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 2), description: 'Expense reports', projectId: 'union-hr-portal', category: 'Admin', minutes: 115, startMinutes: 540, billable: false },
  { id: 'te634', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 2), description: 'Sprint retro', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 330, startMinutes: 655 },
  { id: 'te635', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 3), description: 'Sprint retro', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 200, startMinutes: 540 },
  { id: 'te636', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 3), description: 'Sprint planning', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 35, startMinutes: 740, billable: false },
  { id: 'te637', personId: 'fatima-al-sayed', date: addDays(threeWeeksAgoStart, 4), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 510, startMinutes: 540, billable: false },
  { id: 'te638', personId: 'viktor-petrov', date: addDays(lastWeekStart, 0), description: 'Stakeholder update', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 445, startMinutes: 540 },
  { id: 'te639', personId: 'viktor-petrov', date: addDays(lastWeekStart, 1), description: 'Client sync call', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 215, startMinutes: 540 },
  { id: 'te640', personId: 'viktor-petrov', date: addDays(lastWeekStart, 2), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 280, startMinutes: 540, billable: false },
  { id: 'te641', personId: 'viktor-petrov', date: addDays(lastWeekStart, 2), description: 'Manual regression testing', projectId: null, category: 'Manual', minutes: 150, startMinutes: 850 },
  { id: 'te642', personId: 'viktor-petrov', date: addDays(lastWeekStart, 4), description: 'Onboarding paperwork', projectId: null, category: 'Admin', minutes: 455, startMinutes: 540, billable: false },
  { id: 'te643', personId: 'viktor-petrov', date: addDays(twoWeeksAgoStart, 0), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 215, startMinutes: 540 },
  { id: 'te644', personId: 'viktor-petrov', date: addDays(twoWeeksAgoStart, 1), description: 'Data entry', projectId: null, category: 'Manual', minutes: 420, startMinutes: 540 },
  { id: 'te645', personId: 'viktor-petrov', date: addDays(twoWeeksAgoStart, 1), description: 'Admin tasks', projectId: 'westgate-retainer', category: 'Admin', minutes: 85, startMinutes: 990, billable: false },
  { id: 'te646', personId: 'viktor-petrov', date: addDays(twoWeeksAgoStart, 4), description: 'Manual regression testing', projectId: null, category: 'Manual', minutes: 435, startMinutes: 540 },
  { id: 'te647', personId: 'viktor-petrov', date: addDays(threeWeeksAgoStart, 0), description: '1:1 with manager', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 480, startMinutes: 540 },
  { id: 'te648', personId: 'viktor-petrov', date: addDays(threeWeeksAgoStart, 2), description: 'Expense reports', projectId: null, category: 'Admin', minutes: 360, startMinutes: 540, billable: false },
  { id: 'te649', personId: 'viktor-petrov', date: addDays(threeWeeksAgoStart, 2), description: 'Documentation updates', projectId: 'westgate-retainer', category: 'Admin', minutes: 75, startMinutes: 900, billable: false },
  { id: 'te650', personId: 'viktor-petrov', date: addDays(threeWeeksAgoStart, 3), description: 'Documentation updates', projectId: null, category: 'Admin', minutes: 340, startMinutes: 540, billable: false },
  { id: 'te651', personId: 'viktor-petrov', date: addDays(threeWeeksAgoStart, 3), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 290, startMinutes: 910 },
  { id: 'te652', personId: 'viktor-petrov', date: addDays(threeWeeksAgoStart, 4), description: 'Email triage', projectId: 'westgate-retainer', category: 'Admin', minutes: 485, startMinutes: 540, billable: false },
  { id: 'te653', personId: 'chloe-dubois', date: addDays(lastWeekStart, 0), description: 'Onboarding paperwork', projectId: 'westgate-retainer', category: 'Admin', minutes: 245, startMinutes: 540, billable: false },
  { id: 'te654', personId: 'chloe-dubois', date: addDays(lastWeekStart, 2), description: 'Documentation updates', projectId: 'westgate-retainer', category: 'Admin', minutes: 435, startMinutes: 540 },
  { id: 'te655', personId: 'chloe-dubois', date: addDays(lastWeekStart, 3), description: 'Manual QA pass', projectId: 'westgate-retainer', category: 'Manual', minutes: 200, startMinutes: 540 },
  { id: 'te656', personId: 'chloe-dubois', date: addDays(lastWeekStart, 4), description: 'Sprint planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 155, startMinutes: 540 },
  { id: 'te657', personId: 'chloe-dubois', date: addDays(lastWeekStart, 4), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 90, startMinutes: 695 },
  { id: 'te658', personId: 'chloe-dubois', date: addDays(twoWeeksAgoStart, 0), description: 'Client sync call', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 435, startMinutes: 540 },
  { id: 'te659', personId: 'chloe-dubois', date: addDays(twoWeeksAgoStart, 1), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 120, startMinutes: 540 },
  { id: 'te660', personId: 'chloe-dubois', date: addDays(twoWeeksAgoStart, 1), description: 'Sprint retro', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 480, startMinutes: 675, billable: true },
  { id: 'te661', personId: 'chloe-dubois', date: addDays(twoWeeksAgoStart, 2), description: 'Email triage', projectId: 'westgate-retainer', category: 'Admin', minutes: 445, startMinutes: 540, billable: false },
  { id: 'te662', personId: 'chloe-dubois', date: addDays(twoWeeksAgoStart, 3), description: 'Stakeholder update', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 165, startMinutes: 540, billable: false },
  { id: 'te663', personId: 'chloe-dubois', date: addDays(twoWeeksAgoStart, 4), description: 'Admin tasks', projectId: 'westgate-retainer', category: 'Admin', minutes: 155, startMinutes: 540, billable: false },
  { id: 'te664', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 0), description: 'Expense reports', projectId: 'westgate-retainer', category: 'Admin', minutes: 195, startMinutes: 540, billable: false },
  { id: 'te665', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 0), description: 'Email triage', projectId: 'westgate-retainer', category: 'Admin', minutes: 385, startMinutes: 735, billable: false },
  { id: 'te666', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 1), description: 'Documentation updates', projectId: 'westgate-retainer', category: 'Admin', minutes: 165, startMinutes: 540, billable: false },
  { id: 'te667', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 2), description: 'Admin tasks', projectId: 'westgate-retainer', category: 'Admin', minutes: 395, startMinutes: 540, billable: false },
  { id: 'te668', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 2), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 225, startMinutes: 965, billable: false },
  { id: 'te669', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 3), description: 'Sprint planning', projectId: 'westgate-retainer', category: 'Meetings & Calls', minutes: 160, startMinutes: 540, billable: true },
  { id: 'te670', personId: 'chloe-dubois', date: addDays(threeWeeksAgoStart, 4), description: 'Data entry', projectId: 'westgate-retainer', category: 'Manual', minutes: 430, startMinutes: 540 },
  { id: 'te671', personId: 'rohan-kapoor', date: addDays(lastWeekStart, 0), description: 'Documentation updates', projectId: 'union-hr-portal', category: 'Admin', minutes: 440, startMinutes: 540 },
  { id: 'te672', personId: 'rohan-kapoor', date: addDays(lastWeekStart, 1), description: 'Email triage', projectId: 'union-hr-portal', category: 'Admin', minutes: 290, startMinutes: 540, billable: false },
  { id: 'te673', personId: 'rohan-kapoor', date: addDays(lastWeekStart, 1), description: 'Sprint planning', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 165, startMinutes: 830 },
  { id: 'te674', personId: 'rohan-kapoor', date: addDays(lastWeekStart, 2), description: 'Documentation updates', projectId: 'union-hr-portal', category: 'Admin', minutes: 125, startMinutes: 540, billable: false },
  { id: 'te675', personId: 'rohan-kapoor', date: addDays(lastWeekStart, 2), description: 'Expense reports', projectId: 'union-hr-portal', category: 'Admin', minutes: 475, startMinutes: 695, billable: false },
  { id: 'te676', personId: 'rohan-kapoor', date: addDays(lastWeekStart, 3), description: 'Sprint planning', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 455, startMinutes: 540 },
  { id: 'te677', personId: 'rohan-kapoor', date: addDays(twoWeeksAgoStart, 0), description: 'Admin tasks', projectId: 'union-hr-portal', category: 'Admin', minutes: 215, startMinutes: 540, billable: false },
  { id: 'te678', personId: 'rohan-kapoor', date: addDays(twoWeeksAgoStart, 1), description: 'Admin tasks', projectId: 'union-hr-portal', category: 'Admin', minutes: 60, startMinutes: 540, billable: false },
  { id: 'te679', personId: 'rohan-kapoor', date: addDays(twoWeeksAgoStart, 1), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 210, startMinutes: 600, billable: false },
  { id: 'te680', personId: 'rohan-kapoor', date: addDays(twoWeeksAgoStart, 3), description: 'Client sync call', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 300, startMinutes: 540 },
  { id: 'te681', personId: 'rohan-kapoor', date: addDays(twoWeeksAgoStart, 4), description: 'Sprint planning', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 140, startMinutes: 540, billable: false },
  { id: 'te682', personId: 'rohan-kapoor', date: addDays(twoWeeksAgoStart, 4), description: 'Expense reports', projectId: 'union-hr-portal', category: 'Admin', minutes: 50, startMinutes: 710, billable: false },
  { id: 'te683', personId: 'rohan-kapoor', date: addDays(threeWeeksAgoStart, 1), description: 'Roadmap planning', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 295, startMinutes: 540 },
  { id: 'te684', personId: 'rohan-kapoor', date: addDays(threeWeeksAgoStart, 2), description: 'Sprint retro', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 245, startMinutes: 540 },
  { id: 'te685', personId: 'rohan-kapoor', date: addDays(threeWeeksAgoStart, 3), description: 'Onboarding paperwork', projectId: 'union-hr-portal', category: 'Admin', minutes: 195, startMinutes: 540, billable: false },
  { id: 'te686', personId: 'rohan-kapoor', date: addDays(threeWeeksAgoStart, 4), description: 'Sprint retro', projectId: 'union-hr-portal', category: 'Meetings & Calls', minutes: 450, startMinutes: 540, billable: false },
]

const seedSubmissions: WeekSubmission[] = [
  {
    id: 'ws1',
    personId: 'ajith-pathmanathan',
    weekStart: thisWeekStart,
    status: 'Pending',
    lmStatus: 'Pending',
    hrStatus: 'Pending',
    history: [{ label: 'Submitted for review', at: new Date().toISOString() }],
  },
  {
    id: 'ws2',
    personId: 'hashan-wijesinghe',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws3',
    personId: 'ajith-pathmanathan',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws4',
    personId: 'ajith-pathmanathan',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws5',
    personId: 'ajith-pathmanathan',
    weekStart: threeWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Hashan Wijesinghe) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws6',
    personId: 'ajith-pathmanathan',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws7',
    personId: 'ajith-pathmanathan',
    weekStart: sixWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws8',
    personId: 'ajith-pathmanathan',
    weekStart: sevenWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Hashan Wijesinghe) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws9',
    personId: 'charinda-dissanayake',
    weekStart: twoWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Hashan Wijesinghe) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws10',
    personId: 'charinda-dissanayake',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws11',
    personId: 'charinda-dissanayake',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws12',
    personId: 'charinda-dissanayake',
    weekStart: fiveWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws13',
    personId: 'charinda-dissanayake',
    weekStart: sevenWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws14',
    personId: 'hashan-wijesinghe',
    weekStart: lastWeekStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Pranath) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws15',
    personId: 'hashan-wijesinghe',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws16',
    personId: 'hashan-wijesinghe',
    weekStart: fourWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws17',
    personId: 'hashan-wijesinghe',
    weekStart: fiveWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Pranath) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws18',
    personId: 'hashan-wijesinghe',
    weekStart: sixWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws19',
    personId: 'yuki-tanaka',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws20',
    personId: 'yuki-tanaka',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws21',
    personId: 'yuki-tanaka',
    weekStart: fourWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Faran Siddiqui) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws22',
    personId: 'yuki-tanaka',
    weekStart: fiveWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws23',
    personId: 'yuki-tanaka',
    weekStart: sixWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws24',
    personId: 'yuki-tanaka',
    weekStart: sevenWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws25',
    personId: 'devon-marsh',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws26',
    personId: 'devon-marsh',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws27',
    personId: 'devon-marsh',
    weekStart: threeWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Faran Siddiqui) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws28',
    personId: 'devon-marsh',
    weekStart: fiveWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws29',
    personId: 'devon-marsh',
    weekStart: sixWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Faran Siddiqui)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws30',
    personId: 'devon-marsh',
    weekStart: sevenWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Faran Siddiqui',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Faran Siddiqui) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws31',
    personId: 'ashkar-haris',
    weekStart: lastWeekStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws32',
    personId: 'ashkar-haris',
    weekStart: twoWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Hashan Wijesinghe) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws33',
    personId: 'ashkar-haris',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws34',
    personId: 'ashkar-haris',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws35',
    personId: 'faran-siddiqui',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws36',
    personId: 'faran-siddiqui',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws37',
    personId: 'faran-siddiqui',
    weekStart: fourWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Pranath',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Pranath)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws38',
    personId: 'batool-abdullah',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws39',
    personId: 'batool-abdullah',
    weekStart: threeWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws40',
    personId: 'batool-abdullah',
    weekStart: fourWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Nabeel Syed) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws41',
    personId: 'chamika-wijeratne',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws42',
    personId: 'chamika-wijeratne',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws43',
    personId: 'chamika-wijeratne',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws44',
    personId: 'dinusha-randika',
    weekStart: lastWeekStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws45',
    personId: 'dinusha-randika',
    weekStart: twoWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Nabeel Syed) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws46',
    personId: 'dinusha-randika',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws47',
    personId: 'layla-haddad',
    weekStart: lastWeekStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Dinusha Randika) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws48',
    personId: 'layla-haddad',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws49',
    personId: 'layla-haddad',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws50',
    personId: 'layla-haddad',
    weekStart: fourWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws51',
    personId: 'tomas-rivera',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Chamika Wijeratne',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Chamika Wijeratne)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws52',
    personId: 'tomas-rivera',
    weekStart: threeWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Chamika Wijeratne',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Chamika Wijeratne)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws53',
    personId: 'tomas-rivera',
    weekStart: fourWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Chamika Wijeratne',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Chamika Wijeratne) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws54',
    personId: 'amina-diallo',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws55',
    personId: 'amina-diallo',
    weekStart: threeWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Nabeel Syed) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws56',
    personId: 'amina-diallo',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws57',
    personId: 'oliver-bennett',
    weekStart: lastWeekStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Batool Abdullah',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Batool Abdullah)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws58',
    personId: 'oliver-bennett',
    weekStart: twoWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Batool Abdullah',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Batool Abdullah) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws59',
    personId: 'oliver-bennett',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Batool Abdullah',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Batool Abdullah)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws60',
    personId: 'sara-kowalski',
    weekStart: lastWeekStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Dinusha Randika) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws61',
    personId: 'sara-kowalski',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws62',
    personId: 'sara-kowalski',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws63',
    personId: 'isabela-costa',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Devon Marsh)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws64',
    personId: 'isabela-costa',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Devon Marsh)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws65',
    personId: 'isabela-costa',
    weekStart: threeWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Devon Marsh)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws66',
    personId: 'isabela-costa',
    weekStart: fourWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Devon Marsh) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws67',
    personId: 'kwame-mensah',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Devon Marsh)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws68',
    personId: 'kwame-mensah',
    weekStart: threeWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Devon Marsh) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws69',
    personId: 'kwame-mensah',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Devon Marsh)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws70',
    personId: 'nadia-rahman',
    weekStart: lastWeekStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws71',
    personId: 'nadia-rahman',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws72',
    personId: 'nadia-rahman',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws73',
    personId: 'felix-huber',
    weekStart: lastWeekStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Hashan Wijesinghe) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws74',
    personId: 'felix-huber',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws75',
    personId: 'felix-huber',
    weekStart: fourWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Hashan Wijesinghe',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Hashan Wijesinghe)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws76',
    personId: 'diego-alvarez',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Batool Abdullah',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Batool Abdullah)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws77',
    personId: 'diego-alvarez',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Batool Abdullah',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Batool Abdullah)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws78',
    personId: 'diego-alvarez',
    weekStart: threeWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Batool Abdullah',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Batool Abdullah)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws79',
    personId: 'aaliyah-johnson',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws80',
    personId: 'aaliyah-johnson',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws81',
    personId: 'aaliyah-johnson',
    weekStart: threeWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Nabeel Syed) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws82',
    personId: 'aaliyah-johnson',
    weekStart: fourWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Nabeel Syed',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Nabeel Syed)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws83',
    personId: 'meera-pillai',
    weekStart: twoWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Devon Marsh) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws84',
    personId: 'meera-pillai',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Devon Marsh',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Devon Marsh)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws85',
    personId: 'grace-kim',
    weekStart: lastWeekStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Diego Alvarez',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Diego Alvarez) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws86',
    personId: 'grace-kim',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Diego Alvarez',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Diego Alvarez)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws87',
    personId: 'henrik-larsen',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Chamika Wijeratne',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Chamika Wijeratne)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws88',
    personId: 'henrik-larsen',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Chamika Wijeratne',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Chamika Wijeratne)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws89',
    personId: 'fatima-al-sayed',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Amina Diallo',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Amina Diallo)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws90',
    personId: 'fatima-al-sayed',
    weekStart: twoWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Amina Diallo',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws91',
    personId: 'fatima-al-sayed',
    weekStart: threeWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Amina Diallo',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Amina Diallo) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws92',
    personId: 'viktor-petrov',
    weekStart: lastWeekStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Layla Haddad',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Layla Haddad)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws93',
    personId: 'viktor-petrov',
    weekStart: twoWeeksAgoStart,
    status: 'Rejected',
    comment: 'Please add project detail for the Wednesday entries',
    lmStatus: 'Rejected',
    lmBy: 'Layla Haddad',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Rejected by Line Manager (Layla Haddad) — Please add project detail for the Wednesday entries', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws94',
    personId: 'viktor-petrov',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Layla Haddad',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Layla Haddad)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws95',
    personId: 'chloe-dubois',
    weekStart: twoWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws96',
    personId: 'chloe-dubois',
    weekStart: threeWeeksAgoStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Dinusha Randika',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Dinusha Randika)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws97',
    personId: 'rohan-kapoor',
    weekStart: lastWeekStart,
    status: 'Approved',
    lmStatus: 'Approved',
    lmBy: 'Amina Diallo',
    lmAt: new Date().toISOString(),
    hrStatus: 'Approved',
    hrBy: 'Amina Diallo',
    hrAt: new Date().toISOString(),
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Amina Diallo)', at: new Date().toISOString() },
      { label: 'Approved by HR (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
  {
    id: 'ws98',
    personId: 'rohan-kapoor',
    weekStart: threeWeeksAgoStart,
    status: 'Pending',
    lmStatus: 'Approved',
    lmBy: 'Amina Diallo',
    lmAt: new Date().toISOString(),
    hrStatus: 'Pending',
    history: [
      { label: 'Submitted for review', at: new Date().toISOString() },
      { label: 'Approved by Line Manager (Amina Diallo)', at: new Date().toISOString() },
    ],
  },
]

function loadEntries(): TimeEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY)
    return raw ? (JSON.parse(raw) as TimeEntry[]) : seedEntries
  } catch {
    return seedEntries
  }
}

interface TimeEntryRow {
  id: string
  person_id: string
  date: string
  description: string
  project_id: string | null
  category: string
  minutes: number
  start_minutes: number | null
  billable: boolean
}

function timeEntryFromRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    personId: row.person_id,
    date: row.date,
    description: row.description,
    projectId: row.project_id,
    category: row.category,
    minutes: row.minutes,
    startMinutes: row.start_minutes ?? undefined,
    billable: row.billable,
  }
}

function timeEntryToRow(entry: TimeEntry): TimeEntryRow {
  return {
    id: entry.id,
    person_id: entry.personId,
    date: entry.date,
    description: entry.description,
    project_id: entry.projectId,
    category: entry.category,
    minutes: entry.minutes,
    start_minutes: entry.startMinutes ?? null,
    billable: entry.billable ?? true,
  }
}

async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('time_entries').select('*')
  if (error || !data) return
  setEntries(data.map((row) => timeEntryFromRow(row as TimeEntryRow)))
}

interface SubmissionRow {
  id: string
  person_id: string
  week_start: string
  status: SubmissionStatus
  comment: string | null
  lm_status: ApprovalStatus
  lm_by: string | null
  lm_at: string | null
  hr_status: ApprovalStatus
  hr_by: string | null
  hr_at: string | null
  history: SubmissionHistoryEntry[]
}

function submissionFromRow(row: SubmissionRow): WeekSubmission {
  return {
    id: row.id,
    personId: row.person_id,
    weekStart: row.week_start,
    status: row.status,
    comment: row.comment ?? undefined,
    lmStatus: row.lm_status,
    lmBy: row.lm_by ?? undefined,
    lmAt: row.lm_at ?? undefined,
    hrStatus: row.hr_status,
    hrBy: row.hr_by ?? undefined,
    hrAt: row.hr_at ?? undefined,
    history: row.history ?? [],
  }
}

function submissionToRow(s: WeekSubmission): SubmissionRow {
  return {
    id: s.id,
    person_id: s.personId,
    week_start: s.weekStart,
    status: s.status,
    comment: s.comment ?? null,
    lm_status: s.lmStatus,
    lm_by: s.lmBy ?? null,
    lm_at: s.lmAt ?? null,
    hr_status: s.hrStatus,
    hr_by: s.hrBy ?? null,
    hr_at: s.hrAt ?? null,
    history: s.history,
  }
}

async function hydrateSubmissionsFromSupabase() {
  const { data, error } = await supabase.from('time_submissions').select('*')
  if (error || !data) return
  setSubmissions(data.map((row) => submissionFromRow(row as SubmissionRow)))
}

function syncSubmissionUpsert(s: WeekSubmission) {
  supabase
    .from('time_submissions')
    .upsert(submissionToRow(s))
    .then(({ error }) => {
      if (error) showToast('Could not sync timesheet submission to the server', 'danger')
    })
}

function syncSubmissionUpsertMany(list: WeekSubmission[]) {
  if (list.length === 0) return
  supabase
    .from('time_submissions')
    .upsert(list.map(submissionToRow))
    .then(({ error }) => {
      if (error) showToast('Could not sync timesheet submissions to the server', 'danger')
    })
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

hydrateFromSupabase()
hydrateSubmissionsFromSupabase()

// Fire-and-forget pushes to Supabase so the UI never blocks on network round-trips.
// Local state (and localStorage) is always updated first — these just keep the
// server copy in sync, and surface a toast if that sync fails.
function syncUpsert(entry: TimeEntry) {
  supabase
    .from('time_entries')
    .upsert(timeEntryToRow(entry))
    .then(({ error }) => {
      if (error) showToast('Could not sync time entry to the server', 'danger')
    })
}

function syncUpsertMany(list: TimeEntry[]) {
  if (list.length === 0) return
  supabase
    .from('time_entries')
    .upsert(list.map(timeEntryToRow))
    .then(({ error }) => {
      if (error) showToast('Could not sync time entries to the server', 'danger')
    })
}

function syncDelete(id: string) {
  supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) showToast('Could not sync deletion to the server', 'danger')
    })
}

export function addEntry(input: Omit<TimeEntry, 'id'>) {
  const entry: TimeEntry = { ...input, id: `te${Date.now()}` }
  setEntries([entry, ...entries])
  syncUpsert(entry)
  showToast(`Logged ${formatMinutes(entry.minutes)} — ${entry.description || 'Untitled entry'}`, 'success')
  return entry
}

// Adds several entries in one write with a single summary toast — used when saving
// a batch of manually-staged entries at once, instead of one toast per entry.
export function addEntries(inputs: Omit<TimeEntry, 'id'>[]) {
  if (inputs.length === 0) return []
  const now = Date.now()
  const created = inputs.map((input, i) => ({ ...input, id: `te${now}-${i}` }))
  setEntries([...created, ...entries])
  syncUpsertMany(created)
  showToast(`Logged ${created.length} ${created.length === 1 ? 'entry' : 'entries'}`, 'success')
  return created
}

export function deleteEntry(id: string) {
  setEntries(entries.filter((e) => e.id !== id))
  syncDelete(id)
}

export function updateEntry(id: string, patch: Partial<TimeEntry>) {
  setEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  const updated = entries.find((e) => e.id === id)
  if (updated) syncUpsert(updated)
}

export function duplicateEntry(id: string): TimeEntry | undefined {
  const source = entries.find((e) => e.id === id)
  if (!source) return undefined
  const startMinutes = source.startMinutes !== undefined ? source.startMinutes + source.minutes : undefined
  const copy: TimeEntry = { ...source, id: `te${Date.now()}`, startMinutes }
  setEntries([copy, ...entries])
  syncUpsert(copy)
  showToast(`Duplicated — ${copy.description || 'Untitled entry'}`, 'success')
  return copy
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

// Which approval stage is next up for a submission — null once it's fully settled
// (either Approved by both, or Rejected). Line Manager always signs off before HR.
export function nextReviewStage(s: WeekSubmission): ReviewStage | null {
  if (s.status !== 'Pending') return null
  if (s.lmStatus === 'Pending') return 'lm'
  if (s.hrStatus === 'Pending') return 'hr'
  return null
}

// Once a week is submitted (or fully approved) its entries are locked — the owner
// can no longer edit them directly and has to request a recall instead.
export function isLockedStatus(status: SubmissionStatus): boolean {
  return status === 'Pending' || status === 'Approved'
}

export interface PendingRecallRequest {
  reason: string
  at: string
}

// The history log is append-only, so the *last* recall-flavored entry tells you
// the current state: a trailing 'recall-requested' with nothing after it means a
// request is still awaiting a decision; approved/denied — or none at all — means
// there's nothing pending right now.
export function pendingRecallRequest(s: WeekSubmission): PendingRecallRequest | null {
  const last = s.history[s.history.length - 1]
  if (last?.kind === 'recall-requested') return { reason: last.reason ?? '', at: last.at }
  return null
}

export function requestRecall(id: string, reason: string) {
  const sub = submissions.find((s) => s.id === id)
  if (!sub) return
  const now = new Date().toISOString()
  const updated: WeekSubmission = {
    ...sub,
    history: [...sub.history, { label: `Recall requested — ${reason}`, at: now, kind: 'recall-requested', reason }],
  }
  setSubmissions(submissions.map((s) => (s.id === id ? updated : s)))
  syncSubmissionUpsert(updated)
  showToast('Recall requested — waiting on approval', 'info')
}

export function respondToRecall(id: string, decision: 'Approved' | 'Denied', reviewerName: string) {
  const sub = submissions.find((s) => s.id === id)
  if (!sub) return
  const now = new Date().toISOString()
  const historyEntry: SubmissionHistoryEntry =
    decision === 'Approved'
      ? { label: `Recall approved by ${reviewerName} — timesheet reopened for edits`, at: now, kind: 'recall-approved' }
      : { label: `Recall denied by ${reviewerName}`, at: now, kind: 'recall-denied' }
  const updated: WeekSubmission =
    decision === 'Approved'
      ? {
          ...sub,
          status: 'Not Submitted',
          lmStatus: 'Pending',
          lmBy: undefined,
          lmAt: undefined,
          hrStatus: 'Pending',
          hrBy: undefined,
          hrAt: undefined,
          comment: undefined,
          history: [...sub.history, historyEntry],
        }
      : { ...sub, history: [...sub.history, historyEntry] }
  setSubmissions(submissions.map((s) => (s.id === id ? updated : s)))
  syncSubmissionUpsert(updated)
  showToast(decision === 'Approved' ? 'Recall approved — timesheet reopened for edits' : 'Recall request denied', decision === 'Approved' ? 'success' : 'danger')
}

export function submitWeek(personId: string, weekStart: string) {
  const existing = submissionFor(personId, weekStart)
  const historyEntry: SubmissionHistoryEntry = { label: 'Submitted for review', at: new Date().toISOString() }
  let saved: WeekSubmission
  if (existing) {
    saved = {
      ...existing,
      status: 'Pending',
      lmStatus: 'Pending',
      lmBy: undefined,
      lmAt: undefined,
      hrStatus: 'Pending',
      hrBy: undefined,
      hrAt: undefined,
      comment: undefined,
      history: [...existing.history, historyEntry],
    }
    setSubmissions(submissions.map((s) => (s.id === existing.id ? saved : s)))
  } else {
    saved = { id: `ws${Date.now()}`, personId, weekStart, status: 'Pending', lmStatus: 'Pending', hrStatus: 'Pending', history: [historyEntry] }
    setSubmissions([...submissions, saved])
  }
  syncSubmissionUpsert(saved)
  showToast(`Week of ${formatWeekRange(weekStart)} submitted for review`, 'success')
}

const STAGE_LABEL: Record<ReviewStage, string> = { lm: 'Line Manager', hr: 'HR' }

function applyStageReview(s: WeekSubmission, stage: ReviewStage, decision: 'Approved' | 'Rejected', reviewerName: string, comment?: string): WeekSubmission {
  const now = new Date().toISOString()
  const nextLm = stage === 'lm' ? decision : s.lmStatus
  const nextHr = stage === 'hr' ? decision : s.hrStatus
  const aggregate: SubmissionStatus = decision === 'Rejected' ? 'Rejected' : nextLm === 'Approved' && nextHr === 'Approved' ? 'Approved' : 'Pending'
  const historyEntry: SubmissionHistoryEntry = {
    label: `${decision} by ${STAGE_LABEL[stage]} (${reviewerName})${comment ? ` — ${comment}` : ''}`,
    at: now,
  }
  return {
    ...s,
    ...(stage === 'lm' ? { lmStatus: decision, lmBy: reviewerName, lmAt: now } : { hrStatus: decision, hrBy: reviewerName, hrAt: now }),
    status: aggregate,
    comment: decision === 'Rejected' ? comment : s.comment,
    history: [...s.history, historyEntry],
  }
}

export function reviewSubmission(id: string, stage: ReviewStage, decision: 'Approved' | 'Rejected', reviewerName: string, comment?: string) {
  const sub = submissions.find((s) => s.id === id)
  if (!sub) return
  const updated = applyStageReview(sub, stage, decision, reviewerName, comment)
  setSubmissions(submissions.map((s) => (s.id === id ? updated : s)))
  syncSubmissionUpsert(updated)
  const person = personById(sub.personId)
  showToast(`${person?.name ?? 'Timesheet'} ${decision.toLowerCase()} by ${STAGE_LABEL[stage]}`, decision === 'Approved' ? 'success' : 'danger')
}

// Approves or rejects several submissions at once (same reviewer, same stage), with one shared comment applied to any rejections.
export function reviewSubmissions(ids: string[], stage: ReviewStage, decision: 'Approved' | 'Rejected', reviewerName: string, comment?: string) {
  const idSet = new Set(ids)
  const updated: WeekSubmission[] = []
  setSubmissions(
    submissions.map((s) => {
      if (!idSet.has(s.id)) return s
      const next = applyStageReview(s, stage, decision, reviewerName, comment)
      updated.push(next)
      return next
    }),
  )
  syncSubmissionUpsertMany(updated)
  showToast(`${ids.length} timesheet${ids.length === 1 ? '' : 's'} ${decision.toLowerCase()} by ${STAGE_LABEL[stage]}`, decision === 'Approved' ? 'success' : 'danger')
}

export function minutesForPersonDate(list: TimeEntry[], personId: string, date: string): number {
  return list.filter((e) => e.personId === personId && e.date === date).reduce((sum, e) => sum + e.minutes, 0)
}

export function minutesForPersonWeek(list: TimeEntry[], personId: string, weekStart: string): number {
  const end = addDays(weekStart, 6)
  return list.filter((e) => e.personId === personId && e.date >= weekStart && e.date <= end).reduce((sum, e) => sum + e.minutes, 0)
}

// Every entry a person logged in a given week, sorted chronologically — powers the Timesheet Detail view.
export function entriesForPersonWeek(list: TimeEntry[], personId: string, weekStart: string): TimeEntry[] {
  const end = addDays(weekStart, 6)
  return list
    .filter((e) => e.personId === personId && e.date >= weekStart && e.date <= end)
    .sort((a, b) => (a.date === b.date ? (a.startMinutes ?? 0) - (b.startMinutes ?? 0) : a.date.localeCompare(b.date)))
}

export function projectLabel(projectId: string | null): string {
  if (!projectId) return 'No project'
  return projectById(projectId)?.name ?? 'Unknown project'
}

export interface OverdueWeek {
  weekStart: string
  daysOverdue: number
  minutes: number
}

// A week's timesheet is considered due at the start of the following week.
const SUBMISSION_DUE_OFFSET_DAYS = 7

// Past weeks (excluding the current week) with logged time that are still
// Not Submitted / Rejected, most-overdue first — drives both the Timesheets
// sidebar badge and the "submit last week" nudge banner on My Time.
export function overdueWeeksFor(list: TimeEntry[], subs: WeekSubmission[], personId: string): OverdueWeek[] {
  const today = todayLocal()
  const currentWeek = weekStartFor(today)
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(currentWeek, -7 * (i + 1)))
  return weeks
    .map((w) => {
      const minutes = minutesForPersonWeek(list, personId, w)
      const sub = subs.find((s) => s.personId === personId && s.weekStart === w)
      const isOverdue = minutes > 0 && (!sub || sub.status === 'Rejected')
      if (!isOverdue) return null
      const dueDate = addDays(w, SUBMISSION_DUE_OFFSET_DAYS)
      const daysOverdue = Math.max(0, Math.round((new Date(today + 'T00:00:00').getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000))
      return { weekStart: w, daysOverdue, minutes }
    })
    .filter((w): w is OverdueWeek => w !== null)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export function overdueWeekCount(list: TimeEntry[], subs: WeekSubmission[], personId: string): number {
  return overdueWeeksFor(list, subs, personId).length
}

// Entries within an inclusive date range, optionally scoped to one person — powers
// Reporting's date-range picker and CSV export.
export function entriesInRange(list: TimeEntry[], startDate: string, endDate: string, personId?: string): TimeEntry[] {
  return list.filter((e) => e.date >= startDate && e.date <= endDate && (!personId || e.personId === personId))
}

// Builds a CSV file from time entries and triggers a browser download — no server round-trip needed.
export function exportEntriesToCSV(list: TimeEntry[], filename: string) {
  const header = ['Date', 'Person', 'Description', 'Project', 'Category', 'Hours', 'Billable']
  const rows = list.map((e) => [
    e.date,
    personById(e.personId)?.name ?? e.personId,
    e.description,
    projectLabel(e.projectId),
    e.category,
    (e.minutes / 60).toFixed(2),
    e.billable === false ? 'No' : 'Yes',
  ])
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [header, ...rows].map((row) => row.map((cell) => escape(String(cell))).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


// Most recently logged-on projects / categories for a person (distinct, newest first) — feeds the
// "Recently used" section of the project and category pickers from what they have actually tracked.
function recentFromEntries<T>(pick: (e: TimeEntry) => T | null, personId: string, limit: number): T[] {
  const mine = entries
    .filter((e) => e.personId === personId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startMinutes ?? 0) - (a.startMinutes ?? 0) || b.id.localeCompare(a.id))
  const out: T[] = []
  for (const e of mine) {
    const v = pick(e)
    if (v !== null && v !== undefined && !out.includes(v)) out.push(v)
    if (out.length >= limit) break
  }
  return out
}

export function recentProjectIds(limit = 6, personId: string = CURRENT_USER_ID): string[] {
  return recentFromEntries((e) => e.projectId, personId, limit)
}

export function recentCategoryNames(limit = 6, personId: string = CURRENT_USER_ID): string[] {
  return recentFromEntries((e) => e.category || null, personId, limit)
}
