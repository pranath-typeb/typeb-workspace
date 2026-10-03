import { useEffect, useState } from 'react'
import { CURRENT_USER_ID } from './people'
import { addEntry, todayLocal, toLocalDateStr } from './timeEntries'
import { showToast } from './toast'
import { isAmbientPlaying, playChime, setAmbientVolume, startAmbient, stopAmbient, subscribeAmbient, type SoundKey } from './ambient'

// Focus (Pomodoro-style) sessions. Module-level pub-sub like the other data/*.ts stores.
// Timing is wall-clock based (endsAt) so a throttled background tab never drifts, and the
// running session survives page navigation and reloads.

export type Phase = 'focus' | 'short' | 'long'
export type RunStatus = 'idle' | 'running' | 'paused'

export interface FocusSettings {
  focusMin: number
  shortMin: number
  longMin: number
  longEvery: number // a long break after this many focus sessions
  autoStartNext: boolean
  sound: SoundKey
  volume: number
  logToTimesheet: boolean
}

export interface FocusRun {
  phase: Phase
  status: RunStatus
  totalSec: number
  remainingSec: number
  endsAt: number | null
  task: string
  projectId: string
  cycle: number // focus sessions completed in the current round
}

export interface FocusSession {
  id: string
  date: string // YYYY-MM-DD
  minutes: number
  task: string
  projectId: string | null
  completedAt: string
}

export const PRESETS: Array<{ label: string; focusMin: number; shortMin: number; longMin: number }> = [
  { label: 'Classic', focusMin: 25, shortMin: 5, longMin: 15 },
  { label: 'Deep work', focusMin: 50, shortMin: 10, longMin: 20 },
  { label: 'Flow', focusMin: 90, shortMin: 20, longMin: 30 },
  { label: 'Sprint', focusMin: 15, shortMin: 3, longMin: 10 },
]

const SETTINGS_KEY = 'typeb-hr.focus-settings.v1'
const RUN_KEY = 'typeb-hr.focus-run.v1'
const HISTORY_KEY = 'typeb-hr.focus-history.v1'

const DEFAULT_SETTINGS: FocusSettings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStartNext: false,
  sound: 'rain',
  volume: 0.5,
  logToTimesheet: true,
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    // ignore
  }
  return fallback
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function phaseSeconds(phase: Phase, s: FocusSettings): number {
  return (phase === 'focus' ? s.focusMin : phase === 'short' ? s.shortMin : s.longMin) * 60
}

let settings: FocusSettings = load(SETTINGS_KEY, DEFAULT_SETTINGS)
let history: FocusSession[] = (() => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw) as FocusSession[]
  } catch {
    // ignore
  }
  return []
})()
let run: FocusRun = load<FocusRun>(RUN_KEY, {
  phase: 'focus',
  status: 'idle',
  totalSec: settings.focusMin * 60,
  remainingSec: settings.focusMin * 60,
  endsAt: null,
  task: '',
  projectId: '',
  cycle: 0,
})

let listeners: Array<() => void> = []
let tickId: ReturnType<typeof setInterval> | null = null
const originalTitle = typeof document !== 'undefined' ? document.title : ''

function emit() {
  listeners.forEach((l) => l())
}

function setRun(patch: Partial<FocusRun>) {
  run = { ...run, ...patch }
  save(RUN_KEY, run)
  emit()
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function syncTitle() {
  if (typeof document === 'undefined') return
  if (run.status === 'running') {
    document.title = `${fmt(run.remainingSec)} · ${run.phase === 'focus' ? 'Focus' : 'Break'}`
  } else {
    document.title = originalTitle
  }
}

function syncTicker() {
  if (run.status === 'running' && !tickId) {
    tickId = setInterval(tick, 250)
  } else if (run.status !== 'running' && tickId) {
    clearInterval(tickId)
    tickId = null
  }
  syncTitle()
}

function tick() {
  if (run.status !== 'running' || run.endsAt == null) return
  const remaining = Math.max(0, Math.ceil((run.endsAt - Date.now()) / 1000))
  if (remaining !== run.remainingSec) {
    run = { ...run, remainingSec: remaining }
    save(RUN_KEY, run)
    syncTitle()
    emit()
  }
  if (remaining <= 0) completePhase()
}

function nextPhaseAfter(phase: Phase, cycle: number): { phase: Phase; cycle: number } {
  if (phase === 'focus') {
    const nextCycle = cycle + 1
    return { phase: nextCycle % settings.longEvery === 0 ? 'long' : 'short', cycle: nextCycle }
  }
  return { phase: 'focus', cycle: phase === 'long' ? 0 : cycle }
}

function completePhase() {
  const finished = run
  if (finished.phase === 'focus') {
    const minutes = Math.max(1, Math.round(finished.totalSec / 60))
    const session: FocusSession = {
      id: `fs${Date.now()}`,
      date: todayLocal(),
      minutes,
      task: finished.task,
      projectId: finished.projectId || null,
      completedAt: new Date().toISOString(),
    }
    history = [session, ...history].slice(0, 400)
    save(HISTORY_KEY, history)
    if (settings.logToTimesheet) {
      addEntry({
        personId: CURRENT_USER_ID,
        date: session.date,
        description: finished.task || 'Focus session',
        projectId: session.projectId,
        category: 'Development',
        minutes,
        billable: true,
      })
    } else {
      showToast(`Focus session complete — ${minutes} min`, 'success')
    }
  } else {
    showToast('Break over — ready when you are', 'info')
  }
  playChime(finished.phase === 'focus' ? 'focus-end' : 'break-end')
  stopAmbient()

  const next = nextPhaseAfter(finished.phase, finished.cycle)
  const total = phaseSeconds(next.phase, settings)
  const auto = settings.autoStartNext
  run = {
    ...finished,
    phase: next.phase,
    cycle: next.cycle,
    totalSec: total,
    remainingSec: total,
    status: auto ? 'running' : 'idle',
    endsAt: auto ? Date.now() + total * 1000 : null,
  }
  save(RUN_KEY, run)
  if (auto && run.phase === 'focus') startAmbient(settings.sound, settings.volume)
  syncTicker()
  emit()
}

// ---- boot: resume a session that was running when the page closed -----------------------
if (typeof window !== 'undefined') {
  if (run.status === 'running' && run.endsAt != null) {
    if (run.endsAt <= Date.now()) {
      run = { ...run, remainingSec: 0 }
      queueMicrotask(completePhase)
    } else {
      syncTicker()
    }
  }
}

// Browsers block audio until the user interacts with the page, so after a reload mid-session the
// ambient sound resumes on the first click/tap/key instead of staying silently off.
if (typeof window !== 'undefined' && run.status === 'running' && run.phase === 'focus') {
  const resume = () => {
    window.removeEventListener('pointerdown', resume, true)
    window.removeEventListener('keydown', resume, true)
    if (run.status === 'running' && run.phase === 'focus' && settings.sound !== 'off') startAmbient(settings.sound, settings.volume)
  }
  window.addEventListener('pointerdown', resume, true)
  window.addEventListener('keydown', resume, true)
}

export function toggleAmbientSound() {
  if (isAmbientPlaying()) stopAmbient()
  else if (settings.sound !== 'off') startAmbient(settings.sound, settings.volume)
}

// ---- hooks -----------------------------------------------------------------------------
function useStore<T>(read: () => T): T {
  const [value, setValue] = useState(read)
  useEffect(() => {
    const l = () => setValue(read())
    listeners.push(l)
    l()
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])
  return value
}

export function useAmbientPlaying(): boolean {
  const [v, setV] = useState(isAmbientPlaying)
  useEffect(() => subscribeAmbient(() => setV(isAmbientPlaying())), [])
  return v
}

export const useFocusRun = () => useStore(() => run)
export const useFocusSettings = () => useStore(() => settings)
export const useFocusHistory = () => useStore(() => history)

// ---- actions ---------------------------------------------------------------------------
export function startFocus() {
  const total = run.remainingSec > 0 && run.remainingSec < run.totalSec ? run.remainingSec : run.totalSec
  setRun({ status: 'running', endsAt: Date.now() + total * 1000, remainingSec: total })
  syncTicker()
  if (run.phase === 'focus') startAmbient(settings.sound, settings.volume)
}

export function pauseFocus() {
  if (run.status !== 'running') return
  const remaining = run.endsAt ? Math.max(0, Math.ceil((run.endsAt - Date.now()) / 1000)) : run.remainingSec
  setRun({ status: 'paused', endsAt: null, remainingSec: remaining })
  syncTicker()
  stopAmbient()
}

export function resumeFocus() {
  if (run.status !== 'paused') return
  setRun({ status: 'running', endsAt: Date.now() + run.remainingSec * 1000 })
  syncTicker()
  if (run.phase === 'focus') startAmbient(settings.sound, settings.volume)
}

export function resetFocus() {
  const total = phaseSeconds(run.phase, settings)
  setRun({ status: 'idle', endsAt: null, totalSec: total, remainingSec: total })
  syncTicker()
  stopAmbient()
}

export function skipPhase() {
  const next = nextPhaseAfter(run.phase, run.cycle)
  const total = phaseSeconds(next.phase, settings)
  setRun({ phase: next.phase, cycle: next.cycle, status: 'idle', endsAt: null, totalSec: total, remainingSec: total })
  syncTicker()
  stopAmbient()
}

export function setPhase(phase: Phase) {
  if (run.status === 'running') return
  const total = phaseSeconds(phase, settings)
  setRun({ phase, status: 'idle', endsAt: null, totalSec: total, remainingSec: total })
  syncTicker()
}

export function setFocusTask(task: string) {
  setRun({ task })
}

export function setFocusProject(projectId: string) {
  setRun({ projectId })
}

export function updateFocusSettings(patch: Partial<FocusSettings>) {
  settings = { ...settings, ...patch }
  save(SETTINGS_KEY, settings)
  // Keep an idle timer in step with the duration being edited.
  if (run.status === 'idle') {
    const total = phaseSeconds(run.phase, settings)
    run = { ...run, totalSec: total, remainingSec: total }
    save(RUN_KEY, run)
  }
  // Picking a sound plays it right away (it's a click, so the browser allows audio) — a preview
  // when idle, a live swap mid-session. Silence stops it.
  if (patch.sound !== undefined) {
    if (settings.sound === 'off') stopAmbient()
    else startAmbient(settings.sound, settings.volume)
  }
  if (patch.volume !== undefined) {
    setAmbientVolume(settings.volume)
  }
  emit()
}

export function applyPreset(preset: { focusMin: number; shortMin: number; longMin: number }) {
  updateFocusSettings({ focusMin: preset.focusMin, shortMin: preset.shortMin, longMin: preset.longMin })
}

// ---- selectors -------------------------------------------------------------------------
export function sessionsOn(sessions: FocusSession[], date: string): FocusSession[] {
  return sessions.filter((s) => s.date === date)
}

export function minutesOn(sessions: FocusSession[], date: string): number {
  return sessionsOn(sessions, date).reduce((sum, s) => sum + s.minutes, 0)
}

// Consecutive days (ending today, or yesterday if today has none yet) with ≥1 session.
export function focusStreak(sessions: FocusSession[]): number {
  const days = new Set(sessions.map((s) => s.date))
  const cursor = new Date()
  if (!days.has(toLocalDateStr(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(toLocalDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function lastSevenDays(sessions: FocusSession[]): Array<{ date: string; label: string; minutes: number; today: boolean }> {
  const out = []
  const today = todayLocal()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = toLocalDateStr(d)
    out.push({ date, label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1), minutes: minutesOn(sessions, date), today: date === today })
  }
  return out
}

export function formatClock(sec: number): string {
  return fmt(sec)
}
