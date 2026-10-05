import { useEffect, useState } from 'react'

// Tags (time-entry categories) with an icon each. The seven built-in ones are fixed; people can add
// their own with a name, an icon and a colour — stored in the browser like the other data/*.ts stores.

export const TAG_ICON_KEYS = ['code', 'review', 'video', 'clipboard', 'pencil', 'palette', 'flask', 'search', 'calendar', 'chart', 'target', 'coffee', 'message', 'flag', 'heart', 'bolt'] as const
export type TagIconKey = (typeof TAG_ICON_KEYS)[number]

export const BUILTIN_TAGS: Array<{ name: string; icon: TagIconKey }> = [
  { name: 'Development', icon: 'code' },
  { name: 'Code Review', icon: 'review' },
  { name: 'Meetings & Calls', icon: 'video' },
  { name: 'Admin', icon: 'clipboard' },
  { name: 'Manual', icon: 'pencil' },
  { name: 'Design', icon: 'palette' },
  { name: 'Research', icon: 'flask' },
]

export const TAG_COLOR_CHOICES = ['#1f8a85', '#3b82f6', '#c084fc', '#e11d48', '#ff6d33', '#eab308', '#84cc16', '#0ea5e9']

export interface CustomTag {
  name: string
  icon: TagIconKey
  color: string
}

const KEY = 'typeb-hr.custom-tags.v1'

function load(): CustomTag[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as CustomTag[]
  } catch {
    // ignore
  }
  return []
}

let custom: CustomTag[] = load()
let listeners: Array<() => void> = []

export function createTag(name: string, icon: TagIconKey, color: string): { ok: true; name: string } | { ok: false; error: string } {
  const clean = name.trim()
  if (clean.length < 2) return { ok: false, error: 'Give the tag a name' }
  if (clean.length > 28) return { ok: false, error: 'Keep it under 28 characters' }
  const exists = [...BUILTIN_TAGS.map((t) => t.name), ...custom.map((t) => t.name)].some((n) => n.toLowerCase() === clean.toLowerCase())
  if (exists) return { ok: false, error: 'A tag with that name already exists' }
  custom = [...custom, { name: clean, icon, color }]
  try {
    localStorage.setItem(KEY, JSON.stringify(custom))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
  return { ok: true, name: clean }
}

export function tagIconKey(name: string): TagIconKey | null {
  return BUILTIN_TAGS.find((t) => t.name === name)?.icon ?? custom.find((t) => t.name === name)?.icon ?? null
}

export function customTagColor(name: string): string | undefined {
  return custom.find((t) => t.name === name)?.color
}

export function allTagNames(): string[] {
  return [...BUILTIN_TAGS.map((t) => t.name), ...custom.map((t) => t.name)]
}

export function useTagNames(): string[] {
  const [names, setNames] = useState(allTagNames)
  useEffect(() => {
    const l = () => setNames(allTagNames())
    listeners.push(l)
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])
  return names
}
