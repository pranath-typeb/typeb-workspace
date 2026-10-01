import { useEffect, useState } from 'react'

export type NavPosition = 'bottom' | 'top' | 'left' | 'right'

const STORAGE_KEY = 'typeb-hr.nav-position.v1'
const PINNED_STORAGE_KEY = 'typeb-hr.nav-pinned.v1'

function loadInitial(): NavPosition {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'bottom' || saved === 'top' || saved === 'left' || saved === 'right') return saved
  } catch {
    // ignore
  }
  return 'bottom'
}

function loadInitialPinned(): boolean {
  try {
    const saved = localStorage.getItem(PINNED_STORAGE_KEY)
    if (saved === 'false') return false
  } catch {
    // ignore
  }
  return true
}

let state: NavPosition = loadInitial()
let listeners: Array<(p: NavPosition) => void> = []

let pinnedState: boolean = loadInitialPinned()
let pinnedListeners: Array<(p: boolean) => void> = []

export function getNavPosition(): NavPosition {
  return state
}

export function setNavPosition(next: NavPosition) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(state))
}

export function useNavPosition(): NavPosition {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function getNavPinned(): boolean {
  return pinnedState
}

export function setNavPinned(next: boolean) {
  pinnedState = next
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, String(next))
  } catch {
    // ignore
  }
  pinnedListeners.forEach((l) => l(pinnedState))
}

export function useNavPinned(): boolean {
  const [value, setValue] = useState(pinnedState)
  useEffect(() => {
    pinnedListeners.push(setValue)
    return () => {
      pinnedListeners = pinnedListeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}
