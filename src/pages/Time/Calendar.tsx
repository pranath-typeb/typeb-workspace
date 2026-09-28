import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon, RefreshIcon, CloseIcon, TrashIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { useProjects } from '../../data/projects'
import { showToast } from '../../data/toast'
import {
  addDays,
  addEntry,
  CATEGORIES,
  deleteEntry,
  duplicateEntry,
  formatMinutes,
  formatTimeRange,
  formatWeekRange,
  minutesForPersonDate,
  projectLabel,
  todayLocal,
  updateEntry,
  useTimeEntries,
  weekStartFor,
  type TimeEntry,
} from '../../data/timeEntries'

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

export default function TimeCalendar() {
  const entries = useTimeEntries().filter((e) => e.personId === CURRENT_USER_ID)
  const projects = useProjects()
  const [weekStart, setWeekStart] = useState(() => weekStartFor(todayLocal()))
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
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const isThisWeek = weekStart === weekStartFor(today)

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
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="calendar" />}>
      <div className="page-title">Calendar</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <button className="btn-outline" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
          <button className="btn-outline" onClick={() => setWeekStart(weekStartFor(today))}>This week</button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{formatWeekRange(weekStart)}</span>
        </div>
        <button className="btn-outline" onClick={() => showToast('No external calendar connected in this build', 'info')}>
          <RefreshIcon color="#0f0f10" /> Refresh calendar
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>
        Drag a block's edges to resize, drag its body to move it to another day, click it to edit, or click empty space to add a new entry.
      </div>

      <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ebebeb' }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {days.map((d) => {
            const dayMinutes = minutesForPersonDate(entries, CURRENT_USER_ID, d)
            const dayName = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
            const dateNum = Number(d.slice(-2))
            const isToday = d === today
            return (
              <div key={d} style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderLeft: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? '#00736f' : '#171717' }}>{dayName}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: isToday ? '#00736f' : '#171717' }}>{dateNum}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>{dayMinutes > 0 ? formatMinutes(dayMinutes) : ''}</div>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div ref={scrollRef} style={{ display: 'flex', position: 'relative', maxHeight: 560, overflowY: 'auto' }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT, fontSize: 10, color: 'rgba(0,0,0,0.4)', textAlign: 'right', paddingRight: 8, position: 'relative', top: -6 }}>
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
                style={{ flex: 1, minWidth: 0, position: 'relative', borderLeft: '1px solid #f5f5f5', cursor: 'copy' }}
              >
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT, borderTop: '1px solid #f5f5f5' }} />
                ))}
                {entriesForDayIndex(dayIndex).map(({ entry: e, startMinutes, minutes }) => {
                  const top = (startMinutes / 60) * HOUR_HEIGHT
                  const height = Math.max(18, (minutes / 60) * HOUR_HEIGHT)
                  const isDragging = liveOverride?.entryId === e.id
                  return (
                    <div
                      key={e.id}
                      className="cal-entry-block"
                      onMouseDown={(ev) => beginDrag(ev, e, dayIndex, 'move')}
                      title={`${e.description} · ${formatTimeRange(startMinutes, minutes)}`}
                      style={{
                        position: 'absolute',
                        top,
                        height,
                        left: 4,
                        right: 4,
                        background: '#e3f1ef',
                        borderLeft: '3px solid #00736f',
                        borderRadius: 4,
                        padding: '4px 6px',
                        overflow: 'hidden',
                        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                        opacity: isDragging ? 0.9 : 1,
                        zIndex: isDragging ? 3 : 1,
                      }}
                    >
                      <div
                        className="cal-resize-handle"
                        onMouseDown={(ev) => beginDrag(ev, e, dayIndex, 'resize-top')}
                        style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 8 }}
                      />
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#00504d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>
                      {height > 30 && (
                        <div className="mono" style={{ fontSize: 10, color: '#00736f', marginTop: 2 }}>
                          {formatTimeRange(startMinutes, minutes)}
                        </div>
                      )}
                      {height > 44 && (
                        <div style={{ fontSize: 10, color: 'rgba(0,80,77,0.7)', marginTop: 1 }}>{projectLabel(e.projectId)}</div>
                      )}
                      <div
                        className="cal-resize-handle"
                        onMouseDown={(ev) => beginDrag(ev, e, dayIndex, 'resize-bottom')}
                        style={{ position: 'absolute', bottom: -3, left: 0, right: 0, height: 8 }}
                      />
                    </div>
                  )
                })}
                {isToday && isThisWeek && (
                  <div style={{ position: 'absolute', top: (nowMinutes / 60) * HOUR_HEIGHT, left: 0, right: 0, height: 0, borderTop: '2px solid #ff4800', zIndex: 2, pointerEvents: 'none' }}>
                    <span className="mono" style={{ position: 'absolute', left: -4, top: -8, background: '#ff4800', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>
                      {String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:{String(nowMinutes % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

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
  const width = 300
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
  const [duration, setDuration] = useState(entry.minutes)
  const [billable, setBillable] = useState(entry.billable ?? true)

  function save() {
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

  function remove() {
    deleteEntry(entry.id)
    onClose()
  }

  return (
    <>
      <div className="cal-popover-backdrop" onClick={onClose} />
      <div className="cal-popover" style={popoverStyle(anchor, 480)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Edit entry</div>
          <button onClick={onClose} aria-label="Close" style={{ display: 'flex', padding: 2 }}><CloseIcon /></button>
        </div>

        <div>
          <div className="field-label">Description</div>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Project</div>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Category</div>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Start time</div>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Duration</div>
            <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{formatMinutes(d)}</option>
              ))}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          Billable
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button onClick={remove} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#c53030' }}>
            <TrashIcon size={13} color="#c53030" /> Delete
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" onClick={duplicate}>Duplicate</button>
            <button className="btn-dark" onClick={save}>Save</button>
          </div>
        </div>
      </div>
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
  const [duration, setDuration] = useState(30)
  const [billable, setBillable] = useState(true)

  function add() {
    addEntry({
      personId: CURRENT_USER_ID,
      date,
      description: description.trim() || 'Untitled entry',
      projectId: projectId || null,
      category,
      minutes: duration,
      startMinutes,
      billable,
    })
    onClose()
  }

  return (
    <>
      <div className="cal-popover-backdrop" onClick={onClose} />
      <div className="cal-popover" style={popoverStyle(anchor, 420)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>New entry · {dayLabel} · {minutesToHHMM(startMinutes)}</div>
          <button onClick={onClose} aria-label="Close" style={{ display: 'flex', padding: 2 }}><CloseIcon /></button>
        </div>

        <div>
          <div className="field-label">Description</div>
          <input className="input" autoFocus placeholder="What did you work on?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Project</div>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Category</div>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="field-label">Duration</div>
          <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{formatMinutes(d)}</option>
            ))}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          Billable
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!description.trim()} onClick={add}>Add entry</button>
        </div>
      </div>
    </>
  )
}
