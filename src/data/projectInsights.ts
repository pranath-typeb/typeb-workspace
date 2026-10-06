import type { Project } from './projects'
import type { TimeEntry } from './timeEntries'
import { addDays, weekStartFor } from './timeEntries'
import { committedHoursFor, MONTHLY_CAPACITY_HOURS, type Assignment } from './staffing'
import { leaveWorkingDays, type LeaveRequest } from './leave'
import type { CalendarEvent } from './calendarEvents'
import { personById } from './people'

// Everything the project pages show is derived from data the app already holds: time entries
// (what was logged), staffing assignments (what was committed), leave, and the company calendar.

const WEEKS_SHOWN = 10

export type ProjectHealth = 'completed' | 'ending-soon' | 'over-allocated' | 'idle' | 'on-track'

export interface MemberStat {
  personId: string
  committedPerWeek: number
  loggedMonthMinutes: number
  loggedTotalMinutes: number
  lastLogged: string | null
  sharePct: number
}

export interface ProjectStats {
  totalMinutes: number
  last30Minutes: number
  weekMinutes: number
  billableMinutes: number
  weekly: { weekStart: string; minutes: number }[]
  prevWeekMinutes: number
  byCategory: { category: string; minutes: number }[]
  members: MemberStat[]
  // People who logged time here but aren't on the project team or staffed on it.
  contributors: MemberStat[]
  teamLoggedMinutes: number
  committedPerWeek: number
  plannedMinutesToDate: number
  // timeline
  totalDays: number
  elapsedDays: number
  daysLeft: number
  timelinePct: number
  lastActivity: string | null
  recent: TimeEntry[]
  health: ProjectHealth
  healthLabel: string
}

const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

export function projectEntries(entries: TimeEntry[], projectId: string): TimeEntry[] {
  return entries.filter((e) => e.projectId === projectId)
}

// Hours logged per project id across all entries — replaces the stored (and never updated) hoursLogged field.
export function loggedMinutesByProject(entries: TimeEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) if (e.projectId) map.set(e.projectId, (map.get(e.projectId) ?? 0) + e.minutes)
  return map
}

export function computeProjectStats(project: Project, allEntries: TimeEntry[], assignments: Assignment[], today: string): ProjectStats {
  const entries = projectEntries(allEntries, project.id)
  const monthStart = today.slice(0, 8) + '01'
  const thirtyAgo = addDays(today, -30)
  const currentWeek = weekStartFor(today)

  let totalMinutes = 0
  let last30Minutes = 0
  let weekMinutes = 0
  let billableMinutes = 0
  const catMap = new Map<string, number>()
  const memberMap = new Map<string, { month: number; total: number; last: string | null }>()
  const weekMap = new Map<string, number>()
  let lastActivity: string | null = null

  for (const e of entries) {
    totalMinutes += e.minutes
    if (e.date >= thirtyAgo && e.date <= today) last30Minutes += e.minutes
    if (e.billable !== false) billableMinutes += e.minutes
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.minutes)
    const ws = weekStartFor(e.date)
    weekMap.set(ws, (weekMap.get(ws) ?? 0) + e.minutes)
    if (ws === currentWeek) weekMinutes += e.minutes
    const m = memberMap.get(e.personId) ?? { month: 0, total: 0, last: null }
    m.total += e.minutes
    if (e.date >= monthStart && e.date <= today) m.month += e.minutes
    if (!m.last || e.date > m.last) m.last = e.date
    memberMap.set(e.personId, m)
    if (!lastActivity || e.date > lastActivity) lastActivity = e.date
  }

  const weekly = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const weekStart = addDays(currentWeek, -7 * (WEEKS_SHOWN - 1 - i))
    return { weekStart, minutes: weekMap.get(weekStart) ?? 0 }
  })

  // Team = project team plus anyone staffed or who logged time here.
  const projectAssignments = assignments.filter((a) => a.projectId === project.id)
  const coreIds = new Set([...project.teamIds, ...projectAssignments.map((a) => a.personId)])
  const ids = Array.from(new Set([...coreIds, ...memberMap.keys()]))
  const allMembers: MemberStat[] = ids
    .map((personId) => {
      const m = memberMap.get(personId)
      return {
        personId,
        committedPerWeek: projectAssignments.filter((a) => a.personId === personId).reduce((s, a) => s + a.hoursPerWeek, 0),
        loggedMonthMinutes: m?.month ?? 0,
        loggedTotalMinutes: m?.total ?? 0,
        lastLogged: m?.last ?? null,
        sharePct: totalMinutes ? Math.round(((m?.total ?? 0) / totalMinutes) * 100) : 0,
      }
    })
    .sort((a, b) => b.loggedTotalMinutes - a.loggedTotalMinutes || b.committedPerWeek - a.committedPerWeek)
  const members = allMembers.filter((m) => coreIds.has(m.personId))
  const contributors = allMembers.filter((m) => !coreIds.has(m.personId))
  const teamLoggedMinutes = members.reduce((sum, m) => sum + m.loggedTotalMinutes, 0)

  const committedPerWeek = projectAssignments.reduce((s, a) => s + a.hoursPerWeek, 0)
  // Planned hours to date: each assignment's weekly hours from its start (or the project start) until today / project end.
  const horizon = today < project.ends ? today : project.ends
  let plannedMinutesToDate = 0
  for (const a of projectAssignments) {
    const from = a.startDate > project.starts ? a.startDate : project.starts
    if (from < horizon) plannedMinutesToDate += Math.round((daysBetween(from, horizon) / 7) * a.hoursPerWeek * 60)
  }

  const totalDays = Math.max(1, daysBetween(project.starts, project.ends))
  const elapsedDays = Math.min(Math.max(daysBetween(project.starts, today), 0), totalDays)
  const daysLeft = daysBetween(today, project.ends)
  const timelinePct = Math.round((elapsedDays / totalDays) * 100)

  const recent = [...entries].sort((a, b) => (b.date + String(b.startMinutes ?? 0).padStart(5, '0')).localeCompare(a.date + String(a.startMinutes ?? 0).padStart(5, '0'))).slice(0, 8)

  const overAllocated = members.some((m) => {
    if (!m.committedPerWeek) return false
    return (committedHoursFor(assignments, m.personId) / MONTHLY_CAPACITY_HOURS) * 100 > 100
  })
  const quiet = lastActivity === null || daysBetween(lastActivity, today) > 14

  let health: ProjectHealth = 'on-track'
  let healthLabel = 'On track'
  if (project.status === 'Completed') {
    health = 'completed'
    healthLabel = 'Completed'
  } else if (overAllocated) {
    health = 'over-allocated'
    healthLabel = 'Team over-allocated'
  } else if (daysLeft >= 0 && daysLeft <= 21) {
    health = 'ending-soon'
    healthLabel = daysLeft === 0 ? 'Ends today' : `Ends in ${daysLeft}d`
  } else if (quiet && project.teamIds.length > 0) {
    health = 'idle'
    healthLabel = 'No recent activity'
  }

  return {
    totalMinutes,
    last30Minutes,
    weekMinutes,
    billableMinutes,
    weekly,
    prevWeekMinutes: weekly[weekly.length - 2]?.minutes ?? 0,
    byCategory: Array.from(catMap.entries()).map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes),
    members,
    contributors,
    teamLoggedMinutes,
    committedPerWeek,
    plannedMinutesToDate,
    totalDays,
    elapsedDays,
    daysLeft,
    timelinePct,
    lastActivity,
    recent,
    health,
    healthLabel,
  }
}

export interface HeadsUp {
  kind: 'leave' | 'over' | 'event' | 'idle'
  text: string
  detail?: string
}

const fmtDay = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Things the project lead would want to know: leave overlapping the next two weeks, team members
// stretched across projects, calendar events linked by keyword, and quiet teammates.
export function projectHeadsUp(
  project: Project,
  stats: ProjectStats,
  assignments: Assignment[],
  leave: LeaveRequest[],
  events: CalendarEvent[],
  today: string,
): HeadsUp[] {
  const out: HeadsUp[] = []
  const horizon = addDays(today, 14)
  const approved = leave.filter((l) => l.status !== 'Rejected')

  for (const m of stats.members) {
    const person = personById(m.personId)
    if (!person) continue
    const days = approved
      .filter((l) => l.requestedBy === person.name)
      .flatMap((l) => leaveWorkingDays(l))
      .filter((d) => d >= today && d <= horizon)
      .sort()
    if (days.length) {
      out.push({ kind: 'leave', text: `${person.name} is off ${fmtDay(days[0])}${days.length > 1 ? ` – ${fmtDay(days[days.length - 1])}` : ''}`, detail: `${days.length} working ${days.length === 1 ? 'day' : 'days'}` })
    }
    if (m.committedPerWeek) {
      const pct = Math.round((committedHoursFor(assignments, m.personId) / MONTHLY_CAPACITY_HOURS) * 100)
      if (pct > 100) out.push({ kind: 'over', text: `${person.name} is over-allocated`, detail: `${pct}% across all projects` })
    }
  }

  const kws = (project.calendarKeywords ?? []).map((k) => k.toLowerCase())
  if (kws.length) {
    events
      .filter((e) => e.date >= today && e.date <= addDays(today, 30) && kws.some((k) => `${e.title} ${e.detail ?? ''}`.toLowerCase().includes(k)))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .forEach((e) => out.push({ kind: 'event', text: e.title, detail: fmtDay(e.date) }))
  }

  if (project.status !== 'Completed') {
    for (const m of stats.members) {
      if (m.committedPerWeek > 0 && !m.lastLogged) {
        const person = personById(m.personId)
        if (person) out.push({ kind: 'idle', text: `${person.name} hasn't logged time here yet`, detail: `${m.committedPerWeek}h/week committed` })
      }
    }
  }
  return out
}

export const fmtHours = (minutes: number) => {
  const h = minutes / 60
  return h >= 100 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`
}

export interface ClientStats {
  totalMinutes: number
  monthMinutes: number
  people: number
  monthly: { month: string; label: string; minutes: number }[]
}

// Hours across all of a client's projects: total, this month, people involved, and the last 6 months.
export function computeClientStats(clientProjects: Project[], entries: TimeEntry[], today: string, months = 6): ClientStats {
  const ids = new Set(clientProjects.map((p) => p.id))
  const monthKey = today.slice(0, 7)
  const people = new Set<string>()
  clientProjects.forEach((p) => p.teamIds.forEach((t) => people.add(t)))
  const byMonth = new Map<string, number>()
  let totalMinutes = 0
  for (const e of entries) {
    if (!e.projectId || !ids.has(e.projectId)) continue
    totalMinutes += e.minutes
    people.add(e.personId)
    byMonth.set(e.date.slice(0, 7), (byMonth.get(e.date.slice(0, 7)) ?? 0) + e.minutes)
  }
  const [y, m] = monthKey.split('-').map(Number)
  const monthly = Array.from({ length: months }, (_, i) => {
    const d = new Date(y, m - 1 - (months - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { month: key, label: d.toLocaleDateString('en-US', { month: 'short' }), minutes: byMonth.get(key) ?? 0 }
  })
  return { totalMinutes, monthMinutes: byMonth.get(monthKey) ?? 0, people: people.size, monthly }
}
