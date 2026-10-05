import { useEffect, useState } from 'react'
import { showToast } from './toast'

export type LetterType = 'Service Letter' | 'Visa Officer Letter' | 'Salary Confirmation Letter' | 'Pay-slip Letter'

export const LETTER_TYPES: LetterType[] = ['Service Letter', 'Visa Officer Letter', 'Salary Confirmation Letter', 'Pay-slip Letter']

export interface LetterRequest {
  id: string
  type: LetterType
  requestedBy: string // personId
  requestedAt: string // YYYY-MM-DD
  addressedTo?: string // e.g. embassy/consulate name, for Visa Officer Letter
  purpose?: string
}

const STORAGE_KEY = 'typeb-hr.letter-requests.v1'

const seedRequests: LetterRequest[] = [
  { id: 'lr1', type: 'Service Letter', requestedBy: 'pranath-b', requestedAt: '2026-08-14', purpose: 'Bank loan application' },
  { id: 'lr2', type: 'Visa Officer Letter', requestedBy: 'hashan-wijesinghe', requestedAt: '2026-08-20', addressedTo: 'Consulate General of Japan', purpose: 'Travel visa application' },
  { id: 'lr3', type: 'Salary Confirmation Letter', requestedBy: 'ajith-pathmanathan', requestedAt: '2026-09-02', purpose: 'Apartment lease application' },
  { id: 'lr4', type: 'Pay-slip Letter', requestedBy: 'batool-abdullah', requestedAt: '2026-09-10' },
  { id: 'lr5', type: 'Service Letter', requestedBy: 'devon-marsh', requestedAt: '2026-09-18', purpose: 'Mortgage refinancing' },
]

function load(): LetterRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedRequests
    return JSON.parse(raw) as LetterRequest[]
  } catch {
    return seedRequests
  }
}

function save(requests: LetterRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  } catch {
    // storage unavailable — in-memory only for this session
  }
}

let listeners: Array<(r: LetterRequest[]) => void> = []
let state: LetterRequest[] = load()

function setState(next: LetterRequest[]) {
  state = next
  save(state)
  listeners.forEach((l) => l(state))
}

export function addLetterRequest(input: Omit<LetterRequest, 'id' | 'requestedAt'>) {
  const request: LetterRequest = {
    ...input,
    id: `lr${Date.now()}`,
    requestedAt: new Date().toISOString().slice(0, 10),
  }
  setState([request, ...state])
  showToast(`${request.type} ready to download`, 'success')
  return request
}

export function deleteLetterRequest(id: string) {
  setState(state.filter((r) => r.id !== id))
}

export function useLetterRequests(): LetterRequest[] {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}

export function letterRequestById(id: string): LetterRequest | undefined {
  return state.find((r) => r.id === id)
}
