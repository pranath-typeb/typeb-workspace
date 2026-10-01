import { useEffect, useState } from 'react'

export type NavPosition = 'bottom' | 'top' | 'left' | 'right'

const STORAGE_KEY = 'typeb-hr.nav-position.v1'

function loadInitial(): NavPosition {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'bottom' || saved === 'top' || saved === 'left' || saved === 'right') return saved
  } catch {
    // ignore
  }
  return 'bottom'
}

let state: NavPosition = loadInitial()
let listeners: Array<(p: NavPosition) => void> = []

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
