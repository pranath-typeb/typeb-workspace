import type { LeaveRequest } from './leave'
import { leaveWorkingDays } from './leave'
import type { Person } from './people'
import { addDays, formatMinutes, formatTimeRange, projectLabel, WEEKLY_TARGET_MINUTES, type TimeEntry } from './timeEntries'

// Review flags: plain-language things an approver should look at before deciding. A pure function
// of the week's entries + context, so the Approvals list and the timesheet page agree.

export type FlagSeverity = 'warn' | 'info'

export interface TimesheetFlag {
  id: string
  severity: FlagSeverity
  title: string
  detail: string
  short: string // tiny tag shown on the offending rows
  entryIds: string[] // rows to highlight / jump to ([] = a whole-week observation)
  suggestion: string // a ready-made line for a rejection note
}

// Tunable thresholds — change here to match your policy.
export const FLAG_RULES = {
  longEntryMin: 8 * 60,
  longDayMin: 10 * 60,
  offHoursStart: 6 * 60, // before 06:00
  offHoursEnd: 22 * 60, // after 22:00
  overTargetRatio: 1.15,
  nearBudgetPct: 95,
}

interface FlagInput {
  person: Person
  weekStart: string
  weekEntries: TimeEntry[]
  // weekly allocation (minutes) per project id for this person; absent = no allocation
  allocationMin: (projectId: string) => number
  // total weekly allocation (minutes) across every project this person is staffed on — the
  // real target for their week, not WEEKLY_TARGET_MINUTES (that's just the standard weekly
  // cap). 0 = no staffing assignment on file, in which case the cap is used as a fallback.
  totalAllocationMin: number
  leaveRequests: LeaveRequest[]
  today: string // YYYY-MM-DD
}

const dayName = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const dow = (ymd: string) => new Date(ymd + 'T00:00:00').getDay()

export function computeTimesheetFlags({ person, weekStart, weekEntries, allocationMin, totalAllocationMin, leaveRequests, today }: FlagInput): TimesheetFlag[] {
  const flags: TimesheetFlag[] = []
  const R = FLAG_RULES
  const weekEnd = addDays(weekStart, 6)
  const total = weekEntries.reduce((s, e) => s + e.minutes, 0)

  // Approved/pending leave days for this person, so we can spot conflicts and not call them gaps.
  const leaveDays = new Set<string>()
  leaveRequests
    .filter((r) => r.status !== 'Rejected' && r.requestedBy.toLowerCase() === person.name.toLowerCase())
    .forEach((r) => leaveWorkingDays(r).forEach((d) => leaveDays.add(d)))

  // --- long single entries
  weekEntries
    .filter((e) => e.minutes > R.longEntryMin)
    .forEach((e) => {
      flags.push({
        id: `long-${e.id}`,
        severity: 'warn',
        title: `Long entry: ${formatMinutes(e.minutes)}`,
        detail: `${dayName(e.date)}${e.startMinutes !== undefined ? ` · ${formatTimeRange(e.startMinutes, e.minutes)}` : ''} · ${e.description || 'Untitled'} (${projectLabel(e.projectId)})`,
        short: 'Long entry',
        entryIds: [e.id],
        suggestion: `Please confirm the ${formatMinutes(e.minutes)} entry on ${dayName(e.date)} — it looks like it may need splitting or correcting.`,
      })
    })

  // --- long days
  const byDate = new Map<string, TimeEntry[]>()
  weekEntries.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]))
  byDate.forEach((list, date) => {
    const mins = list.reduce((s, e) => s + e.minutes, 0)
    if (mins > R.longDayMin && !list.some((e) => e.minutes > R.longEntryMin)) {
      flags.push({
        id: `day-${date}`,
        severity: 'warn',
        title: `Long day: ${formatMinutes(mins)}`,
        detail: `${dayName(date)} · ${list.length} entries`,
        short: 'Long day',
        entryIds: list.map((e) => e.id),
        suggestion: `${dayName(date)} adds up to ${formatMinutes(mins)} — please check the entries for that day.`,
      })
    }
  })

  // --- overlaps
  byDate.forEach((list, date) => {
    const timed = list.filter((e) => e.startMinutes !== undefined).sort((a, b) => a.startMinutes! - b.startMinutes!)
    const hit = new Set<string>()
    for (let i = 1; i < timed.length; i++) {
      const prev = timed[i - 1]
      if (timed[i].startMinutes! < prev.startMinutes! + prev.minutes) {
        hit.add(prev.id)
        hit.add(timed[i].id)
      }
    }
    if (hit.size) {
      flags.push({
        id: `overlap-${date}`,
        severity: 'warn',
        title: 'Overlapping entries',
        detail: `${dayName(date)} · ${hit.size} entries run at the same time`,
        short: 'Overlap',
        entryIds: [...hit],
        suggestion: `Some entries on ${dayName(date)} overlap — please fix the times.`,
      })
    }
  })

  // --- time logged on a leave day
  const onLeave = weekEntries.filter((e) => leaveDays.has(e.date))
  if (onLeave.length) {
    const dates = [...new Set(onLeave.map((e) => e.date))]
    flags.push({
      id: 'leave-conflict',
      severity: 'warn',
      title: 'Time logged on a leave day',
      detail: dates.map(dayName).join(', '),
      short: 'On leave',
      entryIds: onLeave.map((e) => e.id),
      suggestion: `Time is logged on ${dates.map(dayName).join(', ')}, which is booked as leave — please reconcile.`,
    })
  }

  // --- project allocation
  const byProject = new Map<string, TimeEntry[]>()
  weekEntries.forEach((e) => e.projectId && byProject.set(e.projectId, [...(byProject.get(e.projectId) ?? []), e]))
  byProject.forEach((list, projectId) => {
    const mins = list.reduce((s, e) => s + e.minutes, 0)
    const alloc = allocationMin(projectId)
    if (!alloc) {
      flags.push({
        id: `noalloc-${projectId}`,
        severity: 'info',
        title: 'Hours on a project with no allocation',
        detail: `${projectLabel(projectId)} · ${formatMinutes(mins)}`,
        short: '', // project-level: shown in the summary, not tagged on every row
        entryIds: list.map((e) => e.id),
        suggestion: `${projectLabel(projectId)} has no allocation for you — please confirm the project is right.`,
      })
      return
    }
    const pct = Math.round((mins / alloc) * 100)
    if (pct > 100 || pct >= R.nearBudgetPct) {
      flags.push({
        id: `budget-${projectId}`,
        severity: pct > 100 ? 'warn' : 'info',
        title: pct > 100 ? `Over allocation on ${projectLabel(projectId)}` : `Near allocation on ${projectLabel(projectId)}`,
        detail: `${formatMinutes(mins)} of ${formatMinutes(alloc)} · ${pct}%`,
        short: '', // project-level: shown in the summary, not tagged on every row
        entryIds: list.map((e) => e.id),
        suggestion: `${projectLabel(projectId)} is at ${pct}% of its weekly allocation — please confirm the hours.`,
      })
    }
  })

  // --- weekend & off-hours
  const weekend = weekEntries.filter((e) => dow(e.date) === 0 || dow(e.date) === 6)
  if (weekend.length) {
    flags.push({
      id: 'weekend',
      severity: 'info',
      title: 'Weekend work',
      detail: `${formatMinutes(weekend.reduce((s, e) => s + e.minutes, 0))} on ${[...new Set(weekend.map((e) => dayName(e.date)))].join(', ')}`,
      short: 'Weekend',
      entryIds: weekend.map((e) => e.id),
      suggestion: 'Please confirm the weekend hours were approved.',
    })
  }
  const offHours = weekEntries.filter((e) => e.startMinutes !== undefined && (e.startMinutes < R.offHoursStart || e.startMinutes + e.minutes > R.offHoursEnd))
  if (offHours.length) {
    flags.push({
      id: 'off-hours',
      severity: 'info',
      title: 'Outside normal hours',
      detail: `${offHours.length} ${offHours.length === 1 ? 'entry' : 'entries'} before 6 am or after 10 pm`,
      short: 'Off-hours',
      entryIds: offHours.map((e) => e.id),
      suggestion: 'Some entries are outside normal working hours — please confirm.',
    })
  }

  // --- week total vs this person's own allocation (only once the week is over). The
  // 40h figure is a cap, not a target — being under your allocated hours is the expected,
  // good outcome and is never flagged. Only meaningfully exceeding your allocation is.
  if (weekEnd < today && total > 0) {
    const target = totalAllocationMin > 0 ? totalAllocationMin : WEEKLY_TARGET_MINUTES
    if (total > target * R.overTargetRatio) {
      flags.push({
        id: 'over',
        severity: 'warn',
        title: `Above allocation: ${formatMinutes(total)} of ${formatMinutes(target)}`,
        detail: `${Math.round((total / target) * 100)}% of the weekly allocation`,
        short: '',
        entryIds: [],
        suggestion: `The week totals ${formatMinutes(total)} against a ${formatMinutes(target)} allocation — please confirm the overtime.`,
      })
    }
  }

  // --- gaps: weekdays that have passed with no time and no leave
  const gaps: string[] = []
  for (let i = 0; i < 5; i++) {
    const d = addDays(weekStart, i)
    if (d < today && !byDate.has(d) && !leaveDays.has(d)) gaps.push(d)
  }
  if (gaps.length && total > 0) {
    flags.push({
      id: 'gaps',
      severity: 'info',
      title: gaps.length === 1 ? `No time on ${dayName(gaps[0])}` : `No time on ${gaps.length} weekdays`,
      detail: gaps.length === 1 ? 'No entries and no leave booked' : gaps.map(dayName).join(', '),
      short: '',
      entryIds: [],
      suggestion: `There is no time or leave on ${gaps.map(dayName).join(', ')}.`,
    })
  }

  // --- hygiene
  const noProject = weekEntries.filter((e) => !e.projectId)
  if (noProject.length) {
    flags.push({
      id: 'no-project',
      severity: 'info',
      title: `${noProject.length} ${noProject.length === 1 ? 'entry' : 'entries'} with no project`,
      detail: formatMinutes(noProject.reduce((s, e) => s + e.minutes, 0)),
      short: 'No project',
      entryIds: noProject.map((e) => e.id),
      suggestion: 'Some entries have no project — please assign them.',
    })
  }
  const noDesc = weekEntries.filter((e) => !e.description.trim())
  if (noDesc.length) {
    flags.push({
      id: 'no-desc',
      severity: 'info',
      title: `${noDesc.length} ${noDesc.length === 1 ? 'entry' : 'entries'} without a description`,
      detail: formatMinutes(noDesc.reduce((s, e) => s + e.minutes, 0)),
      short: 'No description',
      entryIds: noDesc.map((e) => e.id),
      suggestion: 'Some entries are missing descriptions — please add them.',
    })
  }

  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warn' ? -1 : 1))
}

export function flagsByEntry(flags: TimesheetFlag[]): Map<string, TimesheetFlag[]> {
  const map = new Map<string, TimesheetFlag[]>()
  // Only row-specific flags mark rows; project-level ones (empty `short`) just flash rows on "Show".
  flags.filter((f) => f.short).forEach((f) => f.entryIds.forEach((id) => map.set(id, [...(map.get(id) ?? []), f])))
  return map
}
