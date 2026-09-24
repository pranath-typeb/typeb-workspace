import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'danger' | 'info'

export interface Toast {
  id: string
  message: string
  kind: ToastKind
}

let listeners: Array<(t: Toast[]) => void> = []
let state: Toast[] = []

function setState(next: Toast[]) {
  state = next
  listeners.forEach((l) => l(state))
}

export function showToast(message: string, kind: ToastKind = 'success') {
  const toast: Toast = { id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`, message, kind }
  setState([...state, toast])
  setTimeout(() => dismissToast(toast.id), 3200)
}

export function dismissToast(id: string) {
  setState(state.filter((t) => t.id !== id))
}

export function useToasts(): Toast[] {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}
