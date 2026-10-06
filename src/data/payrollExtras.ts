import { useEffect, useState } from 'react'
import { showToast } from './toast'

// Review-side extras that sit next to a payroll period without touching its synced database row:
// supporting notes/evidence, attached documents, and an audit trail of edits. Kept per period id in
// localStorage (module-level pub-sub, like the other data stores).

export interface PayrollDocument {
  id: string
  name: string
  size: number
  uploadedAt: string // ISO
  uploadedBy: string
}

export interface PayrollEdit {
  at: string // ISO
  by: string
  field: string // "PTO hours"
  from: string
  to: string
}

export interface PayrollExtras {
  evidence?: string
  reviewNotes?: string
  documents?: PayrollDocument[]
  edits?: PayrollEdit[]
}

const KEY = 'typeb-hr.payroll-extras.v1'

function load(): Record<string, PayrollExtras> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, PayrollExtras>) : {}
  } catch {
    return {}
  }
}

let state: Record<string, PayrollExtras> = load()
let listeners: Array<(s: Record<string, PayrollExtras>) => void> = []

function commit(next: Record<string, PayrollExtras>) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(state))
}

export function usePayrollExtras(periodId: string | undefined): PayrollExtras {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return (periodId && value[periodId]) || {}
}

function patch(periodId: string, fn: (e: PayrollExtras) => PayrollExtras) {
  commit({ ...state, [periodId]: fn(state[periodId] ?? {}) })
}

export function recordEdits(periodId: string, by: string, changes: { field: string; from: string; to: string }[]) {
  const real = changes.filter((c) => c.from !== c.to)
  if (real.length === 0) return
  const at = new Date().toISOString()
  patch(periodId, (e) => ({ ...e, edits: [...(e.edits ?? []), ...real.map((c) => ({ at, by, ...c }))] }))
}

export function saveReviewNotes(periodId: string, fields: { reviewNotes: string; evidence: string }, by: string) {
  const prev = state[periodId] ?? {}
  recordEdits(periodId, by, [
    { field: 'Notes', from: prev.reviewNotes ?? '', to: fields.reviewNotes },
    { field: 'Supporting evidence', from: prev.evidence ?? '', to: fields.evidence },
  ])
  patch(periodId, (e) => ({ ...e, reviewNotes: fields.reviewNotes, evidence: fields.evidence }))
}

export function addDocument(periodId: string, file: { name: string; size: number }, by: string) {
  const doc: PayrollDocument = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: by,
  }
  patch(periodId, (e) => ({ ...e, documents: [...(e.documents ?? []), doc] }))
  showToast(`Attached ${file.name}`, 'success')
}

export function removeDocument(periodId: string, docId: string) {
  patch(periodId, (e) => ({ ...e, documents: (e.documents ?? []).filter((d) => d.id !== docId) }))
}
