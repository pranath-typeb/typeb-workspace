import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type EventCategory = 'Birthday' | 'Public Holiday' | 'Main Event' | 'Employee Leave'

export interface CalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  title: string
  category: EventCategory
  detail?: string
}

export const categoryColor: Record<EventCategory, string> = {
  Birthday: '#c084fc',
  'Public Holiday': '#1f8a85',
  'Main Event': '#ff6d33',
  'Employee Leave': '#3b82f6',
}

export const categoryBadgeClass: Record<EventCategory, string> = {
  Birthday: 'b-neutral',
  'Public Holiday': 'b-pine',
  'Main Event': 'b-danger',
  'Employee Leave': 'b-neutral',
}

// Static holidays / milestones for the current demo year — a real build would
// sync these from an HR/holidays data source per jurisdiction.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Converts leave.ts's "14-Sep-2026" display format into "2026-09-14".
export function parseLeaveDisplayDate(d: string): string {
  const [day, mon, year] = d.split('-')
  const monthIndex = MONTHS.indexOf(mon)
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.padStart(2, '0')}`
}

export const staticEvents: CalendarEvent[] = [
  { id: 'ce1', date: '2026-09-07', title: 'Labor Day', category: 'Public Holiday', detail: '🇺🇸 USA' },
  { id: 'ce2', date: '2026-09-07', title: 'Labour Day', category: 'Public Holiday', detail: '🇨🇦 Canada' },
  { id: 'ce3', date: '2026-09-11', title: 'Nayrouz', category: 'Public Holiday', detail: '🇪🇬 Egypt' },
  { id: 'ce4', date: '2026-09-15', title: 'Democracy & National Unity Day', category: 'Public Holiday', detail: '🇹🇷 Turkey' },
  { id: 'ce5', date: '2026-09-28', title: 'Milad un-Nabi', category: 'Public Holiday', detail: '🇱🇰 Sri Lanka' },
  { id: 'ce6', date: '2026-09-24', title: 'Company All-Hands', category: 'Main Event', detail: 'Quarterly update · 4:00 PM' },
  { id: 'ce7', date: '2026-09-14', title: "Aruna Randika's birthday", category: 'Birthday' },
  { id: 'ce8', date: '2026-09-17', title: "Randunu Dimeshan's birthday", category: 'Birthday' },
  { id: 'ce9', date: '2026-10-03', title: 'Thanksgiving Day', category: 'Public Holiday', detail: '🇩🇪 Germany' },
  { id: 'ce10', date: '2026-10-09', title: 'Hangul Day', category: 'Public Holiday', detail: '🇰🇷 South Korea' },
  { id: 'ce11', date: '2026-10-12', title: "Ben Okafor's work anniversary", category: 'Main Event', detail: '5 years at Type B' },
  { id: 'ce12', date: '2026-11-01', title: 'All Saints Day', category: 'Public Holiday', detail: '🇫🇷 France' },
  { id: 'ce13', date: '2026-09-22', title: "Isabela Costa's birthday", category: 'Birthday' },
  { id: 'ce14', date: '2026-10-15', title: 'All-Hands: Q4 Kickoff', category: 'Main Event', detail: 'Company update · 4:00 PM' },
]

// Read-only Supabase mirror, same pattern as employment_history — no add/edit/delete
// UI writes calendar events today, so staticEvents above stays as the fallback if the
// table is ever unreachable, instead of the only source of truth.
interface CalendarEventRow {
  id: string
  date: string
  title: string
  category: EventCategory
  detail: string | null
}

function calendarEventFromRow(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    category: row.category,
    detail: row.detail ?? undefined,
  }
}

let listeners: Array<(v: CalendarEvent[]) => void> = []
let events: CalendarEvent[] = staticEvents

function setEvents(next: CalendarEvent[]) {
  events = next
  listeners.forEach((l) => l(events))
}

async function hydrateFromSupabase() {
  const { data, error } = await supabase.from('calendar_events').select('*').order('date')
  if (error || !data) return
  setEvents(data.map((row) => calendarEventFromRow(row as CalendarEventRow)))
}

hydrateFromSupabase()

export function useCalendarEvents(): CalendarEvent[] {
  const [value, setValue] = useState(events)
  useEffect(() => {
    listeners.push(setValue)
    return () => {
      listeners = listeners.filter((l) => l !== setValue)
    }
  }, [])
  return value
}
