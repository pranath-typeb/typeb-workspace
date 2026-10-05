import { useEffect, useState } from 'react'

// Whether the section sidebar is collapsed to its icon rail — one shared choice for every page, so
// collapsing it on Time keeps it collapsed on People, Payroll, etc. (and the same when expanded).
// Remembered across reloads. Phones/small tablets manage their own state (see AppShell).

const KEY = 'typeb-hr.sidebar-collapsed.v1'

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

let collapsed = load()
let listeners: Array<(c: boolean) => void> = []

export function setSidebarCollapsed(next: boolean) {
  collapsed = next
  try {
    localStorage.setItem(KEY, String(next))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(collapsed))
}

export function useSidebarCollapsed(): boolean {
  const [value, setValue] = useState(collapsed)
  useEffect(() => {
    listeners.push(setValue)
    setValue(collapsed)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}
