import { useEffect, useState } from 'react'

const STORAGE_KEY = 'typeb-hr.pinned-apps.v2'

// Every app starts pinned so the nav bar's icon strip looks the same as before
// this feature existed — unpinning is opt-in via the All apps switcher.
const DEFAULT_PINNED_KEYS = ['dashboard', 'time', 'hr', 'payroll', 'projects', 'people', 'focus', 'challenges', 'calendar', 'analytics']

function loadInitial(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as string[]
  } catch {
    // ignore
  }
  return DEFAULT_PINNED_KEYS
}

let state: string[] = loadInitial()
let listeners: Array<(p: string[]) => void> = []

function setState(next: string[]) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(state))
}

export function togglePinnedApp(key: string) {
  setState(state.includes(key) ? state.filter((k) => k !== key) : [...state, key])
}

export function usePinnedApps(): string[] {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}
