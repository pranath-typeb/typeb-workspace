import { useEffect, useState } from 'react'
import { CURRENT_USER_ID } from './people'
import { addEntry, todayLocal } from './timeEntries'
import { showToast } from './toast'

// The one running timer, shared across the whole app (the nav bar's persistent widget,
// and anywhere else — like Dashboard's "Recent Works" — that can resume a past task into
// it). Module-level like the other data/*.ts stores, so it survives page navigation.
export interface TimerState {
  running: boolean
  seconds: number
  description: string
  projectId: string
  category: string
  billable: boolean
  // The time entry this run was resumed from (if any), so only that one row shows as running —
  // other entries with the same description are separate entries.
  sourceId: string
}

let state: TimerState = { running: false, seconds: 0, description: '', projectId: '', category: 'Development', billable: true, sourceId: '' }
let listeners: Array<(s: TimerState) => void> = []
let intervalId: ReturnType<typeof setInterval> | null = null

function setState(patch: Partial<TimerState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l(state))
}

function syncInterval() {
  if (state.running && !intervalId) {
    intervalId = setInterval(() => setState({ seconds: state.seconds + 1 }), 1000)
  } else if (!state.running && intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function useTimerState(): TimerState {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function toggleTimerRunning() {
  setState({ running: !state.running })
  syncInterval()
}

export function setTimerDescription(description: string) {
  setState({ description })
}

export function setTimerProjectId(projectId: string) {
  setState({ projectId })
}

export function setTimerCategory(category: string) {
  setState({ category })
}

export function setTimerBillable(billable: boolean) {
  setState({ billable })
}

// Prefills the shared timer from an existing task and starts it running — "resume as
// timer" / "pick up where you left off" from Dashboard's Recent Works, staged Manual
// entries, etc. Always restarts the elapsed time at 0.
export function startTimer(fields: { description: string; projectId: string | null; category: string; sourceId?: string }) {
  setState({
    sourceId: fields.sourceId ?? '',
    description: fields.description,
    projectId: fields.projectId ?? '',
    category: fields.category,
    seconds: 0,
    running: true,
  })
  syncInterval()
}

export function stopAndSaveTimer(): boolean {
  if (state.seconds < 60) {
    showToast('Track at least a minute before saving', 'info')
    return false
  }
  const minutes = Math.round(state.seconds / 60)
  const now = new Date()
  addEntry({
    personId: CURRENT_USER_ID,
    date: todayLocal(),
    description: state.description.trim() || 'Untitled entry',
    projectId: state.projectId || null,
    category: state.category,
    minutes,
    startMinutes: Math.max(0, now.getHours() * 60 + now.getMinutes() - minutes),
    billable: state.billable,
  })
  setState({ running: false, seconds: 0, description: '', projectId: '', category: 'Development', billable: true, sourceId: '' })
  syncInterval()
  return true
}
