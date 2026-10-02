import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'typeb-hr.theme.v1'
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function loadInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
  } catch {
    // ignore
  }
  return 'light'
}

function apply(theme: Theme) {
  const resolved = theme === 'auto' ? (media?.matches ? 'dark' : 'light') : theme
  document.documentElement.setAttribute('data-theme', resolved)
}

let state: Theme = loadInitial()
let listeners: Array<(t: Theme) => void> = []

apply(state)
media?.addEventListener('change', () => {
  if (state === 'auto') apply(state)
})

export function setTheme(next: Theme) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore
  }
  apply(next)
  listeners.forEach((l) => l(state))
}

export function useTheme(): Theme {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}
