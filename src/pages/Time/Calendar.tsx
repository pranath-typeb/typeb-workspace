import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import ConfirmDialog from '../../components/ConfirmDialog'
import DurationPicker from '../../components/DurationPicker'
import SearchableSelect, { Select } from '../../components/SearchableSelect'
import { ClockIcon, RefreshIcon, CloseIcon, TrashIcon, DuplicateIcon } from '../../components/icons'
import EntryTags from '../../components/EntryTags'
import { CURRENT_USER_ID } from '../../data/people'
import { projectColor, useProjects } from '../../data/projects'
import { showToast } from '../../data/toast'
import {
  addDays,
  addEntry,
  CATEGORIES,
  deleteEntry,
  duplicateEntry,
  formatMinutes,
  formatTimeRange,
  minutesForPersonDate,
  projectLabel,
  todayLocal,
  updateEntry,
  useTimeEntries,
  weekStartFor,
  type TimeEntry,
  recentProjectIds,
} from '../../data/timeEntries'

// Event blocks: wash strength and text lift come from theme vars so dark theme stays legible.
const entryWash = (hex: string) => `color-mix(in srgb, ${hex} var(--entry-wash), transparent)`
const entryText = (hex: string) => `color-mix(in srgb, ${hex}, #fff var(--entry-lift))`

const HOUR_HEIGHT = 44
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SNAP_MINUTES = 15
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240]

function hourLabel(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function snap(m: number): number {
  return Math.round(m / SNAP_MINUTES) * SNAP_MINUTES
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

interface DayItem {
  entry: TimeEntry
  startMinutes: number
  minutes: number
}

interface LaidOutItem extends DayItem {
  colIndex: number
  numCols: number
}

// Assigns side-by-side lanes to entries that overlap in time, so simultaneous
// blocks sit next to each other instead of stacking directly on top of each other.
function layoutDayItems(items: DayItem[]): LaidOutItem[] {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes || b.minutes - a.minutes)
  const result: LaidOutItem[] = []
  let cluster: LaidOutItem[] = []
  let clusterEnd = -Infinity
  let columnEnds: number[] = []

  function flushCluster() {
    const numCols = columnEnds.length
    for (const it of cluster) it.numCols = numCols
    result.push(...cluster)
    cluster = []
    columnEnds = []
  }

  for (const raw of sorted) {
    const start = raw.startMinutes
    const end = raw.startMinutes + raw.minutes
    if (cluster.length > 0 && start >= clusterEnd) {
      flushCluster()
      clusterEnd = -Infinity
    }
    const item: LaidOutItem = { ...raw, colIndex: 0, numCols: 1 }
    let placed = false
    for (let i = 0; i < columnEnds.length; i++) {
      if (columnEnds[i] <= start) {
        columnEnds[i] = end
        item.colIndex = i
        placed = true
        break
      }
    }
    if (!placed) {
      item.colIndex = columnEnds.length
      columnEnds.push(end)
    }
    clusterEnd = Math.max(clusterEnd, end)
    cluster.push(item)
  }
  flushCluster()
  return result
}

type DragMode = 'move' | 'resize-top' | 'resize-bottom'

interface DragCalc {
  entryId: string
  mode: DragMode
  startClientX: number
  startClientY: number
  originDayIndex: number
  originStartMinutes: number
  originMinutes: number
  moved: boolean
}

interface LiveOverride {
  entryId: string
  dayIndex: number
  startMinutes: number
  minutes: number
}

interface PopoverAnchor {
  x: number
  y: number
}

type ViewMode = 'Day' | '3-Day' | 'Week' | 'Month'
const VIEW_MODES: ViewMode[] = ['Day', '3-Day', 'Week', 'Month']
const VIEW_SPAN: Record<ViewMode, number> = { Day: 1, '3-Day': 3, Week: 7, Month: 1 }
const DAILY_TARGET_MINUTES = 480

function formatRangeLabel(view: ViewMode, days: string[], anchor: string): string {
  if (view === 'Month') {
    return new Date(anchor + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const start = new Date(days[0] + 'T00:00:00')
  if (view === 'Day') {
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const end = new Date(days[days.length - 1] + 'T00:00:00')
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function shiftMonth(dateStr: string, delta: number): string {
  const [y, m] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

interface MonthCell {
  date: string | null
  label: number
  inMonth: boolean
}

function buildMonthGrid(anchor: string): MonthCell[] {
  const [y, m] = anchor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: MonthCell[] = []
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, label: 0, inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: `${y}-${pad2(m)}-${pad2(d)}`, label: d, inMonth: true })
  while (cells.length % 7 !== 0) cells.push({ date: null, label: 0, inMonth: false })
  return cells
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function MonthGrid({
  anchor,
  entries,
  today,
  onSelectDay,
}: {
  anchor: string
  entries: TimeEntry[]
  today: string
  onSelectDay: (date: string) => void
}) {
  const cells = useMemo(() => buildMonthGrid(anchor), [anchor])

  const statsByDate = useMemo(() => {
    const map = new Map<string, { minutes: number; count: number }>()
    for (const e of entries) {
      const cur = map.get(e.date) ?? { minutes: 0, count: 0 }
      cur.minutes += e.minutes
      cur.count += 1
      map.set(e.date, cur)
    }
    return map
  }, [entries])

  const monthTotalMinutes = useMemo(
    () => cells.reduce((sum, c) => sum + (c.date ? statsByDate.get(c.date)?.minutes ?? 0 : 0), 0),
    [cells, statsByDate],
  )
  const activeDays = useMemo(() => cells.filter((c) => c.date && statsByDate.has(c.date)).length, [cells, statsByDate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        <span><strong className="mono" style={{ color: 'var(--color-text-primary)' }}>{formatMinutes(monthTotalMinutes)}</strong> logged this month</span>
        <span><strong className="mono" style={{ color: 'var(--color-text-primary)' }}>{activeDays}</strong> active {activeDays === 1 ? 'day' : 'days'}</span>
      </div>

      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border-default)' }}>
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((cell, i) => {
            if (!cell.date) {
              return (
                <div
                  key={i}
                  style={{ minHeight: 92, borderRight: '1px solid var(--color-border-default)', borderBottom: '1px solid var(--color-border-default)', background: 'var(--color-background-subtle)' }}
                />
              )
            }
            const stats = statsByDate.get(cell.date)
            const minutes = stats?.minutes ?? 0
            const count = stats?.count ?? 0
            const fillPct = minutes > 0 ? Math.max(Math.min(minutes / DAILY_TARGET_MINUTES, 1) * 100, 10) : 0
            const isFull = minutes >= DAILY_TARGET_MINUTES
            const isDark = isFull
            const isToday = cell.date === today
            return (
              <button
                key={cell.date}
                onClick={() => onSelectDay(cell.date as string)}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: 92,
                  padding: 10,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  borderRight: '1px solid var(--color-border-default)',
                  borderBottom: '1px solid var(--color-border-default)',
                  ...(isToday ? { border: '1.5px dashed var(--brand-mid)' } : {}),
                  background: 'var(--color-background-page)',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease',
                }}
              >
                {minutes > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${fillPct}%`,
                      background: isFull ? 'var(--brand-deep)' : 'color-mix(in srgb, var(--brand-deep) 28%, transparent)',
                      borderTop: isFull ? 'none' : '2px solid color-mix(in srgb, var(--brand-deep) 70%, transparent)',
                      transition: 'height 0.4s ease, background 0.3s ease',
                    }}
                  />
                )}
                <span className="mono" style={{ position: 'relative', zIndex: 1, fontSize: 13, fontWeight: 600, color: isDark ? '#fff' : isToday ? 'var(--brand-mid)' : 'var(--color-text-primary)' }}>
                  {cell.label}
                </span>
                {minutes > 0 && (
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#fff' : 'var(--color-text-primary)' }}>
                      {formatMinutes(minutes)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 9999,
                        alignSelf: 'flex-start',
                        background: isDark ? 'rgba(255,255,255,0.2)' : 'color-mix(in srgb, var(--brand-deep) 14%, transparent)',
                        color: isDark ? '#fff' : 'var(--brand-text)',
                      }}
                    >
                      {count} {count === 1 ? 'log' : 'logs'}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function TimeCalendar() {
  const entries = useTimeEntries().filter((e) => e.personId === CURRENT_USER_ID)
  const projects = useProjects()
  const [view, setView] = useState<ViewMode>('Week')
  const [anchor, setAnchor] = useState(() => todayLocal())
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60000)
    return () => clearInterval(t)
  }, [])

  const today = todayLocal()
  const viewSpan = VIEW_SPAN[view]
  const rangeStart = view === 'Week' ? weekStartFor(anchor) : anchor
  const days = useMemo(() => Array.from({ length: viewSpan }, (_, i) => addDays(rangeStart, i)), [rangeStart, viewSpan])
  const showNowLine = days.includes(today)

  function goPrev() {
    setAnchor((a) => (view === 'Month' ? shiftMonth(a, -1) : addDays(a, -viewSpan)))
  }
  function goNext() {
    setAnchor((a) => (view === 'Month' ? shiftMonth(a, 1) : addDays(a, viewSpan)))
  }
  function goToday() {
    setAnchor(todayLocal())
  }

  const dayColRefs = useRef<Array<HTMLDivElement | null>>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const colRectsRef = useRef<DOMRect[]>([])
  const dragCalcRef = useRef<DragCalc | null>(null)
  const [dragSession, setDragSession] = useState(0)
  const [liveOverride, setLiveOverride] = useState<LiveOverride | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editAnchor, setEditAnchor] = useState<PopoverAnchor | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ dayIndex: number; startMinutes: number } | null>(null)
  const [quickAddAnchor, setQuickAddAnchor] = useState<PopoverAnchor | null>(null)

  function beginDrag(e: React.MouseEvent, entry: TimeEntry, dayIndex: number, mode: DragMode) {
    e.stopPropagation()
    e.preventDefault()
    colRectsRef.current = dayColRefs.current.map((el) => el?.getBoundingClientRect() ?? new DOMRect())
    dragCalcRef.current = {
      entryId: entry.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originDayIndex: dayIndex,
      originStartMinutes: entry.startMinutes ?? 0,
      originMinutes: entry.minutes,
      moved: false,
    }
    setLiveOverride({ entryId: entry.id, dayIndex, startMinutes: entry.startMinutes ?? 0, minutes: entry.minutes })
    setEditId(null)
    setQuickAdd(null)
    setDragSession((n) => n + 1)
  }

  useEffect(() => {
    if (dragSession === 0) return

    function onMove(ev: MouseEvent) {
      const calc = dragCalcRef.current
      if (!calc) return
      const deltaX = ev.clientX - calc.startClientX
      const deltaY = ev.clientY - calc.startClientY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) calc.moved = true
      const deltaMinRaw = (deltaY / HOUR_HEIGHT) * 60

      let dayIndex = calc.originDayIndex
      let startMinutes = calc.originStartMinutes
      let minutes = calc.originMinutes

      if (calc.mode === 'move') {
        startMinutes = clamp(snap(calc.originStartMinutes + deltaMinRaw), 0, 24 * 60 - calc.originMinutes)
        const rects = colRectsRef.current
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i]
          if (r.width > 0 && ev.clientX >= r.left && ev.clientX < r.right) {
            dayIndex = i
            break
          }
        }
      } else if (calc.mode === 'resize-top') {
        const newStart = clamp(snap(calc.originStartMinutes + deltaMinRaw), 0, calc.originStartMinutes + calc.originMinutes - SNAP_MINUTES)
        startMinutes = newStart
        minutes = calc.originStartMinutes + calc.originMinutes - newStart
      } else {
        minutes = clamp(snap(calc.originMinutes + deltaMinRaw), SNAP_MINUTES, 24 * 60 - calc.originStartMinutes)
      }

      setLiveOverride({ entryId: calc.entryId, dayIndex, startMinutes, minutes })
    }

    function onUp(ev: MouseEvent) {
      const calc = dragCalcRef.current
      dragCalcRef.current = null
      if (!calc) return
      if (calc.moved) {
        setLiveOverride((curr) => {
          if (curr && curr.entryId === calc.entryId) {
            updateEntry(calc.entryId, { date: days[curr.dayIndex], startMinutes: curr.startMinutes, minutes: curr.minutes })
          }
          return null
        })
      } else {
        setLiveOverride(null)
        setEditAnchor({ x: ev.clientX, y: ev.clientY })
        setEditId(calc.entryId)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragSession])

  function entriesForDayIndex(di: number) {
    const d = days[di]
    const base = entries.filter((e) => e.date === d && e.startMinutes !== undefined)
    const withoutDragged = liveOverride ? base.filter((e) => e.id !== liveOverride.entryId) : base
    const list = withoutDragged.map((e) => ({ entry: e, startMinutes: e.startMinutes as number, minutes: e.minutes }))
    if (liveOverride && liveOverride.dayIndex === di) {
      const draggedEntry = entries.find((e) => e.id === liveOverride.entryId)
      if (draggedEntry) list.push({ entry: draggedEntry, startMinutes: liveOverride.startMinutes, minutes: liveOverride.minutes })
    }
    return list
  }

  function handleColumnMouseDown(e: React.MouseEvent<HTMLDivElement>, dayIndex: number) {
    const el = dayColRefs.current[dayIndex]
    if (!el) return
    const rect = el.getBoundingClientRect()
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    const offsetY = e.clientY - rect.top + scrollTop
    const startMinutes = clamp(snap(Math.round((offsetY / HOUR_HEIGHT) * 60)), 0, 24 * 60 - 30)
    setQuickAddAnchor({ x: e.clientX, y: e.clientY })
    setQuickAdd({ dayIndex, startMinutes })
    setEditId(null)
  }

  const editEntry = editId ? entries.find((e) => e.id === editId) ?? null : null

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="calendar" />}>
      <div className="page-title">Calendar</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={goPrev}>‹</button>
          <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={goNext}>›</button>
          <button className="btn-outline" onClick={goToday}>{view === 'Week' ? 'This week' : view === 'Month' ? 'This month' : 'Today'}</button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{formatRangeLabel(view, days, anchor)}</span>
        </div>
        <div className="cal-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="cal-viewtoggle" style={{ display: 'flex', border: '1px solid var(--color-border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
            {VIEW_MODES.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: view === v ? 'var(--color-background-inverse)' : 'var(--color-background-page)',
                  color: view === v ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn-outline" onClick={() => showToast('No external calendar connected in this build', 'info')}>
            <RefreshIcon color="var(--color-text-primary)" /> Refresh calendar
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
        {view === 'Month'
          ? 'Each day is shaded by hours logged toward an 8h target — click a day to open it.'
          : "Drag a block's edges to resize, drag its body to move it to another day, click it to edit, or click empty space to add a new entry."}
      </div>

      {view === 'Month' ? (
        <MonthGrid
          anchor={anchor}
          entries={entries}
          today={today}
          onSelectDay={(d) => {
            setAnchor(d)
            setView('Day')
          }}
        />
      ) : (
      <div className="cal-scroll-wrap" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header + grid share one scroll container so their columns always line up, even when the vertical scrollbar appears. */}
        <div ref={scrollRef} className="cal-scroller" style={{ maxHeight: 560, overflowY: 'auto' }}>
        <div className="cal-header-row" style={{ display: 'flex', borderBottom: '1px solid var(--color-border-default)', position: 'sticky', top: 0, zIndex: 2, background: 'var(--color-background-page)' }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {days.map((d) => {
            const dayMinutes = minutesForPersonDate(entries, CURRENT_USER_ID, d)
            const dayName = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
            const dateNum = Number(d.slice(-2))
            const isToday = d === today
            return (
              <div key={d} className="cal-day-col" style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderLeft: '1px solid var(--table-row-border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--brand-mid)' : 'var(--color-text-primary)' }}>{dayName}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: isToday ? 'var(--brand-mid)' : 'var(--color-text-primary)' }}>{dateNum}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{dayMinutes > 0 ? formatMinutes(dayMinutes) : ''}</div>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div className="cal-grid-row" style={{ display: 'flex', position: 'relative' }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT, fontSize: 10, color: 'var(--color-text-tertiary)', textAlign: 'right', paddingRight: 8, position: 'relative', top: -6 }}>
                {hourLabel(h)}
              </div>
            ))}
          </div>

          {days.map((d, dayIndex) => {
            const isToday = d === today
            return (
              <div
                key={d}
                ref={(el) => { dayColRefs.current[dayIndex] = el }}
                onMouseDown={(e) => handleColumnMouseDown(e, dayIndex)}
                className="cal-day-col"
                style={{ flex: 1, minWidth: 0, position: 'relative', borderLeft: '1px solid var(--table-row-border)', cursor: 'copy' }}
              >
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT, borderTop: '1px solid var(--table-row-border)' }} />
                ))}
                {layoutDayItems(entriesForDayIndex(dayIndex)).map(({ entry: e, startMinutes, minutes, colIndex, numCols }) => {
                  const top = (startMinutes / 60) * HOUR_HEIGHT
                  const height = Math.max(18, (minutes / 60) * HOUR_HEIGHT)
                  const isDragging = liveOverride?.entryId === e.id
                  const accent = projectColor(e.projectId)
                  return (
                    <div
                      key={e.id}
                      className="cal-entry-block"
                      onMouseDown={(ev) => beginDrag(ev, e, dayIndex, 'move')}
                      title={`${e.description} · ${e.category} · ${formatTimeRange(startMinutes, minutes)}`}
                      style={{
                        position: 'absolute',
                        top,
                        height,
                        left: `calc(${(colIndex * 100) / numCols}% + 4px)`,
                        width: `calc(${100 / numCols}% - 8px)`,
                        background: entryWash(accent),
                        borderLeft: `3px solid ${accent}`,
                        borderRadius: 4,
                        padding: '4px 6px',
                        overflow: 'hidden',
                        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                        opacity: isDragging ? 0.9 : 1,
                        zIndex: isDragging ? 3 : 1,
                      }}
                    >
                      <div
                        className="cal-resize-handle cal-resize-handle-top"
                        onMouseDown={(ev) => beginDrag(ev, e, dayIndex, 'resize-top')}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8 }}
                      >
                        <span className="cal-resize-grip" style={{ background: accent }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: entryText(accent), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>
                      {height > 30 && (
                        <div className="mono" style={{ fontSize: 10, color: entryText(accent), marginTop: 2 }}>
                          {formatTimeRange(startMinutes, minutes)}
                        </div>
                      )}
                      {height > 44 && (
                        <div style={{ fontSize: 10, color: entryText(accent), opacity: 0.8, marginTop: 1 }}>{projectLabel(e.projectId)}</div>
                      )}
                      <div
                        className="cal-resize-handle cal-resize-handle-bottom"
                        onMouseDown={(ev) => beginDrag(ev, e, dayIndex, 'resize-bottom')}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8 }}
                      >
                        <span className="cal-resize-grip" style={{ background: accent }} />
                      </div>
                    </div>
                  )
                })}
                {isToday && showNowLine && (
                  <div style={{ position: 'absolute', top: (nowMinutes / 60) * HOUR_HEIGHT, left: 0, right: 0, height: 0, borderTop: '2px solid #ff4800', zIndex: 2, pointerEvents: 'none' }}>
                    <span className="mono" style={{ position: 'absolute', left: -4, top: -8, background: '#ff4800', color: '#0f0f10', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>
                      {String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:{String(nowMinutes % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </div>
      </div>
      )}

      {editEntry && editAnchor && (
        <EditEntryPopover
          entry={editEntry}
          anchor={editAnchor}
          projects={projects}
          onClose={() => setEditId(null)}
        />
      )}

      {quickAdd && quickAddAnchor && (
        <QuickAddPopover
          dayLabel={new Date(days[quickAdd.dayIndex] + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          date={days[quickAdd.dayIndex]}
          startMinutes={quickAdd.startMinutes}
          anchor={quickAddAnchor}
          projects={projects}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </AppShell>
  )
}

function popoverStyle(anchor: PopoverAnchor, estimatedHeight = 420): React.CSSProperties {
  const width = 360
  const left = clamp(anchor.x + 8, 8, window.innerWidth - width - 8)
  const top = clamp(anchor.y + 8, 8, window.innerHeight - estimatedHeight - 8)
  return { left, top, maxHeight: window.innerHeight - 16, overflowY: 'auto' }
}

function EditEntryPopover({
  entry,
  anchor,
  projects,
  onClose,
}: {
  entry: TimeEntry
  anchor: PopoverAnchor
  projects: { id: string; name: string }[]
  onClose: () => void
}) {
  const [description, setDescription] = useState(entry.description)
  const [projectId, setProjectId] = useState(entry.projectId ?? '')
  const [category, setCategory] = useState(entry.category)
  const [startTime, setStartTime] = useState(minutesToHHMM(entry.startMinutes ?? 0))
  const [endTime, setEndTime] = useState(minutesToHHMM((entry.startMinutes ?? 0) + entry.minutes))
  const [billable, setBillable] = useState(entry.billable ?? true)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const duration = hhmmToMinutes(endTime) - hhmmToMinutes(startTime)

  function handleStartTimeChange(next: string) {
    const shiftedDuration = duration
    setStartTime(next)
    setEndTime(minutesToHHMM(hhmmToMinutes(next) + shiftedDuration))
  }

  function applyDuration(mins: number) {
    setEndTime(minutesToHHMM(hhmmToMinutes(startTime) + mins))
  }

  function save() {
    if (duration <= 0) return
    updateEntry(entry.id, {
      description,
      projectId: projectId || null,
      category,
      startMinutes: hhmmToMinutes(startTime),
      minutes: duration,
      billable,
    })
    onClose()
  }

  function duplicate() {
    duplicateEntry(entry.id)
    onClose()
  }

  return (
    <>
      <div className="cal-popover-backdrop" onClick={onClose} />
      <div className="cal-popover" style={popoverStyle(anchor, 560)}>
        <div className="ep-head">
          <div className="ep-title">Edit entry</div>
          <button className="ep-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div>
          <div className="field-label">Description</div>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <div className="field-label">Project</div>
          <SearchableSelect
            recentKey="project"
            recentFrom={recentProjectIds}
            allLabel="All projects"
            value={projectId}
            onChange={setProjectId}
            placeholder="No project"
            options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>

        <div className="ep-times">
          <div>
            <div className="field-label">Start</div>
            <input className="input" type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
          </div>
          <span className="ep-arrow" aria-hidden>→</span>
          <div>
            <div className="field-label">End</div>
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <DurationPicker options={DURATION_OPTIONS} selectedMinutes={duration} onSelect={applyDuration} />
        {duration <= 0 && <div style={{ fontSize: 12, color: 'var(--danger-fg)' }}>End time must be after start time.</div>}

        <EntryTags category={category} onCategory={setCategory} billable={billable} onBillable={setBillable} />

        <div className="ep-footer">
          <div className="ep-footer-icons">
            <button className="ep-icon-btn danger" title="Delete entry" aria-label="Delete entry" onClick={() => setConfirmingDelete(true)}>
              <TrashIcon size={16} color="var(--danger-fg)" />
            </button>
            <button className="ep-icon-btn" title="Duplicate entry" aria-label="Duplicate entry" onClick={duplicate}>
              <DuplicateIcon size={16} color="var(--color-text-primary)" />
            </button>
          </div>
          <button className="btn-dark ep-primary" disabled={duration <= 0} onClick={save}>Save</button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete entry?"
          message={`This will permanently remove "${entry.description || 'Untitled entry'}". This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            deleteEntry(entry.id)
            onClose()
          }}
        />
      )}
    </>
  )
}

function QuickAddPopover({
  dayLabel,
  date,
  startMinutes,
  anchor,
  projects,
  onClose,
}: {
  dayLabel: string
  date: string
  startMinutes: number
  anchor: PopoverAnchor
  projects: { id: string; name: string }[]
  onClose: () => void
}) {
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [category, setCategory] = useState('Manual')
  const [startTime, setStartTime] = useState(minutesToHHMM(startMinutes))
  const [endTime, setEndTime] = useState(minutesToHHMM(startMinutes + 30))
  const [billable, setBillable] = useState(true)

  const duration = hhmmToMinutes(endTime) - hhmmToMinutes(startTime)

  function handleStartTimeChange(next: string) {
    const shiftedDuration = duration
    setStartTime(next)
    setEndTime(minutesToHHMM(hhmmToMinutes(next) + shiftedDuration))
  }

  function applyDuration(mins: number) {
    setEndTime(minutesToHHMM(hhmmToMinutes(startTime) + mins))
  }

  function add() {
    if (!description.trim() || duration <= 0) return
    addEntry({
      personId: CURRENT_USER_ID,
      date,
      description: description.trim() || 'Untitled entry',
      projectId: projectId || null,
      category,
      minutes: duration,
      startMinutes: hhmmToMinutes(startTime),
      billable,
    })
    onClose()
  }

  return (
    <>
      <div className="cal-popover-backdrop" onClick={onClose} />
      <div className="cal-popover" style={popoverStyle(anchor, 520)}>
        <div className="ep-head">
          <div className="ep-title">New entry <span>· {dayLabel}</span></div>
          <button className="ep-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div>
          <div className="field-label">Description</div>
          <input className="input" autoFocus placeholder="What did you work on?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <div className="field-label">Project</div>
          <SearchableSelect
            recentKey="project"
            recentFrom={recentProjectIds}
            allLabel="All projects"
            value={projectId}
            onChange={setProjectId}
            placeholder="No project"
            options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>

        <div className="ep-times">
          <div>
            <div className="field-label">Start</div>
            <input className="input" type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
          </div>
          <span className="ep-arrow" aria-hidden>→</span>
          <div>
            <div className="field-label">End</div>
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <DurationPicker options={DURATION_OPTIONS} selectedMinutes={duration} onSelect={applyDuration} />
        {duration <= 0 && <div style={{ fontSize: 12, color: 'var(--danger-fg)' }}>End time must be after start time.</div>}

        <EntryTags defaultCategory="Manual" category={category} onCategory={setCategory} billable={billable} onBillable={setBillable} />

        <div className="ep-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark ep-primary" disabled={!description.trim() || duration <= 0} onClick={add}>Add entry</button>
        </div>
      </div>
    </>
  )
}
