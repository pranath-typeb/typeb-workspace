import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, usePeople, type Person } from './people'
import { addDays, toLocalDateStr, todayLocal, weekStartFor } from './timeEntries'
import { showToast } from './toast'

// Team step challenges. Module-level pub-sub + localStorage like the other data/*.ts stores.
//
// Only the *current user's* state is persisted (joins, step logs, challenges they create, chosen
// health source). Colleagues' steps are generated deterministically per person + date so the
// leaderboard is stable across reloads — swap `stepsFor` for a real API once health data is synced.

export type HealthProvider = 'apple' | 'google' | 'fitbit' | 'garmin'
export type GoalType = 'daily' | 'total'

export interface Challenge {
  id: string
  title: string
  description: string
  goalType: GoalType
  goalSteps: number // steps per day (daily) or for the whole period (total)
  startDate: string
  endDate: string
  createdBy: string
  seedParticipants: string[] // everyone except the current user (who joins via `joined`)
}

export interface StepLog {
  id: string
  date: string
  steps: number
  source: 'manual' | HealthProvider
  at: string
}

export const PROVIDERS: Array<{ key: HealthProvider; label: string; platform: string }> = [
  { key: 'apple', label: 'Apple Health', platform: 'iPhone & Apple Watch' },
  { key: 'google', label: 'Google Health Connect', platform: 'Android & Wear OS' },
  { key: 'fitbit', label: 'Fitbit', platform: 'Fitbit trackers' },
  { key: 'garmin', label: 'Garmin', platform: 'Garmin watches' },
]

export const DEFAULT_DAILY_GOAL = 10000

const STORE_KEY = 'typeb-hr.challenges.v1'

interface Persisted {
  joined: string[] // challenge ids the current user is in
  left: string[] // seeded challenges the current user opted out of
  logs: StepLog[]
  created: Challenge[]
  provider: HealthProvider | null
  connectedAt?: string | null // ISO time of the last sync with the connected source
  dailyGoal: number
}

function loadStore(): Persisted {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    // ignore
  }
  return { joined: ['ch-current'], left: [], logs: [], created: [], provider: null, dailyGoal: DEFAULT_DAILY_GOAL }
}

let store: Persisted = loadStore()
let listeners: Array<() => void> = []

function commit(next: Persisted) {
  store = next
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

// ---- deterministic seed data --------------------------------------------------------------
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

// A colleague's steps for a day: personal baseline × day wobble × weekend dip. Today is scaled by
// how much of the day has passed so the board moves while you watch.
export function seedSteps(personId: string, date: string): number {
  const base = 5200 + hash(personId) * 7800
  const wobble = 0.65 + hash(`${personId}:${date}`) * 0.7
  const dow = new Date(date + 'T00:00:00').getDay()
  const weekend = dow === 0 || dow === 6 ? 0.82 : 1
  let steps = base * wobble * weekend
  if (date === todayLocal()) {
    const now = new Date()
    const dayFrac = Math.min(1, Math.max(0.05, (now.getHours() * 60 + now.getMinutes() - 6 * 60) / (16 * 60)))
    steps *= dayFrac
  }
  return Math.round(steps / 10) * 10
}

// True while synced steps are simulated. Flip to false (and implement `pullSyncedSteps`) once the
// real Apple Health / Health Connect / Fitbit / Garmin integration is live.
export const SYNC_IS_DEMO = true

// Steps pulled automatically from the connected health source for a day.
function pullSyncedSteps(date: string): number {
  if (!store.provider) return 0
  return Math.round((seedSteps(CURRENT_USER_ID, date) * 0.96) / 10) * 10
}

export function stepsFor(personId: string, date: string): number {
  if (date > todayLocal()) return 0
  if (personId === CURRENT_USER_ID) return pullSyncedSteps(date) + store.logs.filter((l) => l.date === date).reduce((s, l) => s + l.steps, 0)
  return seedSteps(personId, date)
}

function buildSeedChallenges(people: Person[]): Challenge[] {
  const today = todayLocal()
  const monday = weekStartFor(today)
  const others = people.filter((p) => p.id !== CURRENT_USER_ID)
  const pick = (n: number, salt: string) =>
    [...others]
      .sort((a, b) => hash(a.id + salt) - hash(b.id + salt))
      .slice(0, n)
      .map((p) => p.id)

  return [
    {
      id: 'ch-current',
      title: 'Step Up Week',
      description: 'Move a little more every day. Most steps by Sunday takes the crown — and the lunch on us.',
      goalType: 'daily',
      goalSteps: DEFAULT_DAILY_GOAL,
      startDate: monday,
      endDate: addDays(monday, 6),
      createdBy: others[0]?.id ?? CURRENT_USER_ID,
      seedParticipants: pick(14, 'cur'),
    },
    {
      id: 'ch-next',
      title: 'Lunchtime Walk-athon',
      description: 'Swap the desk lunch for a 20-minute walk. Teams of everyone, 60,000 steps in a week.',
      goalType: 'total',
      goalSteps: 60000,
      startDate: addDays(monday, 7),
      endDate: addDays(monday, 13),
      createdBy: others[1]?.id ?? CURRENT_USER_ID,
      seedParticipants: pick(6, 'next'),
    },
    {
      id: 'ch-past',
      title: 'Sunrise Strides',
      description: 'Last week’s early-bird challenge.',
      goalType: 'total',
      goalSteps: 55000,
      startDate: addDays(monday, -7),
      endDate: addDays(monday, -1),
      createdBy: others[2]?.id ?? CURRENT_USER_ID,
      seedParticipants: pick(11, 'past'),
    },
  ]
}

// ---- derived views -------------------------------------------------------------------------
export type ChallengeStatus = 'active' | 'upcoming' | 'past'

export function statusOf(c: Challenge): ChallengeStatus {
  const today = todayLocal()
  if (today < c.startDate) return 'upcoming'
  if (today > c.endDate) return 'past'
  return 'active'
}

export function daysLeft(c: Challenge): number {
  const end = new Date(c.endDate + 'T00:00:00').getTime()
  const now = new Date(todayLocal() + 'T00:00:00').getTime()
  return Math.max(0, Math.round((end - now) / 86400000))
}

export function daysUntilStart(c: Challenge): number {
  const start = new Date(c.startDate + 'T00:00:00').getTime()
  const now = new Date(todayLocal() + 'T00:00:00').getTime()
  return Math.max(0, Math.round((start - now) / 86400000))
}

export function datesIn(c: Challenge, through?: string): string[] {
  const out: string[] = []
  const last = through && through < c.endDate ? through : c.endDate
  for (let d = c.startDate; d <= last; d = addDays(d, 1)) out.push(d)
  return out
}

export function isJoined(c: Challenge): boolean {
  if (c.createdBy === CURRENT_USER_ID && store.created.some((x) => x.id === c.id)) return !store.left.includes(c.id)
  if (store.left.includes(c.id)) return false
  return store.joined.includes(c.id)
}

export function participantIds(c: Challenge): string[] {
  const ids = [...c.seedParticipants]
  if (isJoined(c)) ids.push(CURRENT_USER_ID)
  return ids
}

export interface Standing {
  personId: string
  total: number
  today: number
  rank: number
  change: number // positive = moved up since yesterday
  daily: number[]
}

export function standings(c: Challenge): Standing[] {
  const today = todayLocal()
  const dates = datesIn(c, today)
  const yesterday = addDays(today, -1)
  const ids = participantIds(c)

  const rows = ids.map((id) => {
    const daily = datesIn(c).map((d) => stepsFor(id, d))
    const total = dates.reduce((s, d) => s + stepsFor(id, d), 0)
    const upToYesterday = dates.filter((d) => d <= yesterday).reduce((s, d) => s + stepsFor(id, d), 0)
    return { personId: id, total, today: stepsFor(id, today), daily, upToYesterday }
  })

  const rank = (key: 'total' | 'upToYesterday') => {
    const sorted = [...rows].sort((a, b) => b[key] - a[key])
    return new Map(sorted.map((r, i) => [r.personId, i + 1]))
  }
  const now = rank('total')
  const before = rank('upToYesterday')

  return [...rows]
    .sort((a, b) => b.total - a.total)
    .map((r) => ({
      personId: r.personId,
      total: r.total,
      today: r.today,
      daily: r.daily,
      rank: now.get(r.personId) ?? 0,
      change: dates.length > 1 && dates[0] <= yesterday ? (before.get(r.personId) ?? 0) - (now.get(r.personId) ?? 0) : 0,
    }))
}

export function myStreak(): number {
  const goal = store.dailyGoal
  const cursor = new Date()
  if (stepsFor(CURRENT_USER_ID, toLocalDateStr(cursor)) < goal) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (stepsFor(CURRENT_USER_ID, toLocalDateStr(cursor)) >= goal && streak < 365) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function recentLogs(limit = 5): StepLog[] {
  return [...store.logs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

// ---- hooks ---------------------------------------------------------------------------------
function useStore<T>(read: () => T, refreshMs = 0): T {
  const [value, setValue] = useState(read)
  useEffect(() => {
    const l = () => setValue(read())
    listeners.push(l)
    let id: ReturnType<typeof setInterval> | undefined
    if (refreshMs) id = setInterval(l, refreshMs)
    return () => {
      listeners = listeners.filter((x) => x !== l)
      if (id) clearInterval(id)
    }
  }, [])
  return value
}

export function useChallengeState() {
  const people = usePeople()
  // Bump a counter on every store change / minute tick so derived selectors re-run.
  const version = useStore(() => ({ store }), 60_000)
  const seed = buildSeedChallenges(people)
  const challenges = [...store.created, ...seed]
  return { challenges, store: version.store, people }
}

// ---- actions -------------------------------------------------------------------------------
export function joinChallenge(c: Challenge) {
  commit({
    ...store,
    joined: store.joined.includes(c.id) ? store.joined : [...store.joined, c.id],
    left: store.left.filter((id) => id !== c.id),
  })
  showToast(`You're in — ${c.title}`, 'success')
}

export function leaveChallenge(c: Challenge) {
  commit({ ...store, left: store.left.includes(c.id) ? store.left : [...store.left, c.id] })
  showToast(`Left ${c.title}`, 'info')
}

export function logSteps(steps: number, date = todayLocal()) {
  if (!Number.isFinite(steps) || steps === 0) return
  const log: StepLog = { id: `sl${Date.now()}`, date, steps, source: store.provider ?? 'manual', at: new Date().toISOString() }
  commit({ ...store, logs: [...store.logs, log] })
}

// Replace today's total (what you'd type after glancing at your watch).
export function setTodaySteps(total: number, date = todayLocal()) {
  const current = stepsFor(CURRENT_USER_ID, date)
  logSteps(Math.max(0, Math.round(total)) - current, date)
}

export function undoLastLog() {
  const last = [...store.logs].sort((a, b) => b.at.localeCompare(a.at))[0]
  if (!last) return
  commit({ ...store, logs: store.logs.filter((l) => l.id !== last.id) })
}

export function syncNow() {
  if (!store.provider) return
  commit({ ...store, connectedAt: new Date().toISOString() })
  showToast('Steps synced', 'success')
}

export function connectProvider(p: HealthProvider | null) {
  commit({ ...store, provider: p, connectedAt: p ? new Date().toISOString() : null })
  if (p) {
    const label = PROVIDERS.find((x) => x.key === p)?.label ?? 'your health app'
    showToast(`${label} selected as your step source`, 'success')
  } else {
    showToast('Health app disconnected', 'info')
  }
}

export function setDailyGoal(goal: number) {
  commit({ ...store, dailyGoal: Math.max(1000, Math.round(goal)) })
}

export function createChallenge(input: { title: string; description: string; goalType: GoalType; goalSteps: number; startDate: string; endDate: string }, invitees: string[]): Challenge {
  const c: Challenge = {
    id: `ch${Date.now()}`,
    title: input.title.trim(),
    description: input.description.trim(),
    goalType: input.goalType,
    goalSteps: input.goalSteps,
    startDate: input.startDate,
    endDate: input.endDate,
    createdBy: CURRENT_USER_ID,
    seedParticipants: invitees,
  }
  commit({ ...store, created: [c, ...store.created], joined: [...store.joined, c.id] })
  showToast(`Challenge created — ${invitees.length} teammates invited`, 'success')
  return c
}

// Everyone not yet in a challenge, for the "invite" step; hashed order keeps it stable.
export function suggestedInvitees(people: Person[], count: number): string[] {
  return people
    .filter((p) => p.id !== CURRENT_USER_ID)
    .sort((a, b) => hash(a.id + 'inv') - hash(b.id + 'inv'))
    .slice(0, count)
    .map((p) => p.id)
}
