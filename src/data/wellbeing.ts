import { useEffect, useState } from 'react'
import { todayLocal, toLocalDateStr } from './timeEntries'
import { playChime } from './ambient'

// Movement reminders. Counts *active* time in the app (tab visible + recent input) and, once
// it passes the chosen interval, offers a short guided stretch — a gentle card, never a modal
// lock-out. Idle for 5+ minutes counts as a natural break and resets the clock.

export interface WellbeingSettings {
  enabled: boolean
  intervalMin: number
  snoozeMin: number
  pauseDuringFocus: boolean
}

export interface Suggestion {
  id: string
  title: string
  blurb: string
  seconds: number
  steps: string[]
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'neck',
    title: 'Neck & shoulder release',
    blurb: 'Undo the screen hunch in one minute.',
    seconds: 60,
    steps: ['Drop your right ear toward your right shoulder — hold 10s', 'Switch sides — hold 10s', 'Roll both shoulders back 5 times', 'Interlace fingers, push palms up and reach tall'],
  },
  {
    id: 'walk',
    title: 'Stand up & walk',
    blurb: 'A short lap does more than another coffee.',
    seconds: 120,
    steps: ['Stand up and push your chair in', 'Walk to the window or down the hall', 'Take a few deep breaths on the way', 'Refill your water on the way back'],
  },
  {
    id: 'eyes',
    title: '20-20-20 eye reset',
    blurb: 'Give your eyes a rest from the screen.',
    seconds: 40,
    steps: ['Look at something 20 feet (6 m) away', 'Hold your gaze for 20 seconds', 'Blink slowly 10 times', 'Gently close your eyes for a few breaths'],
  },
  {
    id: 'wrists',
    title: 'Wrist & hand stretch',
    blurb: 'Keep typing comfortable for the long run.',
    seconds: 60,
    steps: ['Extend one arm, palm up — pull fingers back gently, 10s', 'Palm down — press fingers toward the floor, 10s', 'Switch arms and repeat', 'Shake out both hands loosely'],
  },
  {
    id: 'back',
    title: 'Desk back stretch',
    blurb: 'Open up your spine and hips.',
    seconds: 90,
    steps: ['Sit tall and twist gently to the right — hold 15s', 'Twist to the left — hold 15s', 'Stand and reach arms overhead', 'Fold forward slowly and hang for 15s'],
  },
  {
    id: 'water',
    title: 'Hydrate & breathe',
    blurb: 'Water plus a calm minute resets focus.',
    seconds: 60,
    steps: ['Pour a full glass of water', 'Breathe in for 4, hold for 4, out for 6', 'Repeat 5 times', 'Come back refreshed'],
  },
]

const SETTINGS_KEY = 'typeb-hr.wellbeing-settings.v1'
const BREAKS_KEY = 'typeb-hr.move-breaks.v1'

const DEFAULT_SETTINGS: WellbeingSettings = { enabled: true, intervalMin: 120, snoozeMin: 10, pauseDuringFocus: true }

const IDLE_RESET_SEC = 5 * 60 // away this long = a natural break
const ACTIVE_WINDOW_MS = 90 * 1000 // input within this window counts as "at the screen"

function loadSettings(): WellbeingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

function loadBreaks(): string[] {
  try {
    const raw = localStorage.getItem(BREAKS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch {
    // ignore
  }
  return []
}

let settings = loadSettings()
let breakDates: string[] = loadBreaks() // one entry per completed move break (YYYY-MM-DD)
let activeSeconds = 0
let snoozedUntil = 0
let lastInput = Date.now()
let idleSeconds = 0

export type ReminderPhase = 'hidden' | 'prompt' | 'guided' | 'done'
export interface ReminderState {
  phase: ReminderPhase
  suggestion: Suggestion
  activeMinutes: number
  guidedRemaining: number
}

let reminder: ReminderState = { phase: 'hidden', suggestion: SUGGESTIONS[0], activeMinutes: 0, guidedRemaining: 0 }
let listeners: Array<() => void> = []
let engineStarted = false
let focusRunningProbe: () => boolean = () => false

function emit() {
  listeners.forEach((l) => l())
}

function setReminder(patch: Partial<ReminderState>) {
  reminder = { ...reminder, ...patch }
  emit()
}

function pickSuggestion(): Suggestion {
  // Rotate so people don't see the same stretch twice in a row.
  const idx = (breakDates.length + Math.floor(Math.random() * SUGGESTIONS.length)) % SUGGESTIONS.length
  return SUGGESTIONS[idx]
}

function persistBreaks() {
  try {
    localStorage.setItem(BREAKS_KEY, JSON.stringify(breakDates.slice(-400)))
  } catch {
    // ignore
  }
}

function onSecond() {
  const now = Date.now()
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
  const recentInput = now - lastInput < ACTIVE_WINDOW_MS

  if (visible && recentInput) {
    idleSeconds = 0
    activeSeconds++
  } else {
    idleSeconds++
    if (idleSeconds >= IDLE_RESET_SEC && activeSeconds > 0) activeSeconds = 0
  }

  if (reminder.phase === 'guided') {
    const left = reminder.guidedRemaining - 1
    if (left <= 0) {
      finishBreak()
    } else {
      setReminder({ guidedRemaining: left })
    }
    return
  }

  if (
    settings.enabled &&
    reminder.phase === 'hidden' &&
    now >= snoozedUntil &&
    activeSeconds >= settings.intervalMin * 60 &&
    !(settings.pauseDuringFocus && focusRunningProbe())
  ) {
    showReminder()
  }
}

function showReminder() {
  playChime('break-end')
  setReminder({ phase: 'prompt', suggestion: pickSuggestion(), activeMinutes: Math.max(1, Math.round(activeSeconds / 60)), guidedRemaining: 0 })
}

export function startWellbeingEngine(isFocusRunning: () => boolean) {
  focusRunningProbe = isFocusRunning
  if (engineStarted || typeof window === 'undefined') return
  engineStarted = true
  const bump = () => {
    lastInput = Date.now()
  }
  ;['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach((ev) => window.addEventListener(ev, bump, { passive: true, capture: true }))
  setInterval(onSecond, 1000)
}

// ---- reminder actions -------------------------------------------------------------------
export function startGuidedBreak() {
  setReminder({ phase: 'guided', guidedRemaining: reminder.suggestion.seconds })
}

export function finishBreak() {
  breakDates = [...breakDates, todayLocal()]
  persistBreaks()
  activeSeconds = 0
  idleSeconds = 0
  setReminder({ phase: 'done', guidedRemaining: 0 })
  setTimeout(() => {
    if (reminder.phase === 'done') setReminder({ phase: 'hidden' })
  }, 6000)
}

export function snoozeReminder() {
  snoozedUntil = Date.now() + settings.snoozeMin * 60 * 1000
  setReminder({ phase: 'hidden' })
}

export function dismissReminder() {
  // "Not now": ask again after half an interval rather than immediately.
  snoozedUntil = Date.now() + Math.max(settings.snoozeMin, settings.intervalMin / 2) * 60 * 1000
  setReminder({ phase: 'hidden' })
}

export function closeDone() {
  setReminder({ phase: 'hidden' })
}

export function previewReminder() {
  activeSeconds = Math.max(activeSeconds, 7200)
  showReminder()
}

// ---- settings / stats --------------------------------------------------------------------
export function updateWellbeingSettings(patch: Partial<WellbeingSettings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
  emit()
}

export function moveStreak(): number {
  const days = new Set(breakDates)
  const cursor = new Date()
  if (!days.has(toLocalDateStr(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(toLocalDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function movesToday(): number {
  const today = todayLocal()
  return breakDates.filter((d) => d === today).length
}

export function activeMinutesNow(): number {
  return Math.floor(activeSeconds / 60)
}

function useTick<T>(read: () => T): T {
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

export const useReminder = () => useTick(() => reminder)
export const useWellbeingSettings = () => useTick(() => settings)
export const useWellbeingStats = () => {
  // Re-read on every emit (break completed / settings changed).
  useTick(() => breakDates.length + (settings.enabled ? 1 : 0))
  return { streak: moveStreak(), today: movesToday() }
}
