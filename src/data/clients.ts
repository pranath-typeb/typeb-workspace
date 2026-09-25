import { useEffect, useState } from 'react'
import type { Project } from './projects'

export type ClientStatus = 'Active' | 'Inactive' | 'Removed'

export interface ClientSummary {
  name: string
  total: number
  active: number
  status: ClientStatus
}

const STORAGE_KEY = 'typeb-hr.client-status.v1'

interface ClientRecord {
  status: ClientStatus
}

function load(): Record<string, ClientRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ClientRecord>) : {}
  } catch {
    return {}
  }
}

function save(next: Record<string, ClientRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(v: Record<string, ClientRecord>) => void> = []
let state: Record<string, ClientRecord> = load()

function setState(next: Record<string, ClientRecord>) {
  state = next
  save(state)
  listeners.forEach((l) => l(state))
}

export function setClientStatus(name: string, status: ClientStatus) {
  setState({ ...state, [name]: { status } })
}

export function useClientStatuses(): Record<string, ClientRecord> {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function clientSummaries(projects: Project[], statuses: Record<string, ClientRecord>): ClientSummary[] {
  const map = new Map<string, ClientSummary>()
  for (const p of projects) {
    const entry = map.get(p.client) ?? { name: p.client, total: 0, active: 0, status: statuses[p.client]?.status ?? 'Active' }
    entry.total += 1
    if (p.status !== 'Completed') entry.active += 1
    map.set(p.client, entry)
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}
