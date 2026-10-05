import { useEffect, useMemo, useRef, useState } from 'react'
import DatePicker from '../../components/DatePicker'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import AddTimeEntryModal from '../../components/AddTimeEntryModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import DurationPicker from '../../components/DurationPicker'
import SearchableSelect from '../../components/SearchableSelect'
import { BillableButton, CategoryTagButton } from '../../components/EntryTags'
import TimeInput from '../../components/TimeInput'
import { ChevronLeftIcon, ChevronRightIcon, CircleArrowRightIcon, ClockIcon, DuplicateIcon, EditIcon, LockIcon, PlayIcon, StopIcon, TimerActivityIcon, TrashIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { projectColor, useProjects } from '../../data/projects'
import { committedHoursFor, useAssignments } from '../../data/staffing'
import {
  addDays,
  addEntries,
  addEntry,
  CATEGORIES,
  deleteEntry,
  duplicateEntry,
  formatMinutes,
  formatTimeRange,
  formatWeekRange,
  isLockedStatus,
  minutesForPersonDate,
  minutesForPersonWeek,
  projectLabel,
  submissionFor,
  submitWeek,
  todayLocal,
  type TimeEntry,
  useSubmissions,
  useTimeEntries,
  weekStartFor,
  WEEKLY_TARGET_MINUTES,
  recentProjectIds,
} from '../../data/timeEntries'
import { setTimerBillable, setTimerCategory, setTimerDescription, setTimerProjectId, startTimer, stopAndSaveTimer, toggleTimerRunning, useTimerState } from '../../data/timer'
import { triggerScreenRipple } from '../../data/screenRipple'

let stagedIdCounter = 0
function nextStagedId(): string {
  stagedIdCounter += 1
  return `staged-${Date.now()}-${stagedIdCounter}`
}

function formatStopwatch(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120]
const DAILY_TARGET_MINUTES = 480

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export default function MyTime() {
  const entries = useTimeEntries()
  const submissions = useSubmissions()
  const projects = useProjects()

  const [weekStart, setWeekStart] = useState(() => weekStartFor(todayLocal()))
  const [mode, setMode] = useState<'Timer' | 'Manual'>('Timer')
  const timer = useTimerState()

  const [manualDate, setManualDate] = useState(() => todayLocal())
  const [manualDesc, setManualDesc] = useState('')
  const [manualProject, setManualProject] = useState('')
  const [manualStartTime, setManualStartTime] = useState('09:00')
  const [manualEndTime, setManualEndTime] = useState('10:00')
  const [manualCategory, setManualCategory] = useState('Manual')
  const [manualBillable, setManualBillable] = useState(true)
  const [stagedEntries, setStagedEntries] = useState<TimeEntry[]>([])
  const [stagedDeleteTarget, setStagedDeleteTarget] = useState<TimeEntry | null>(null)
  const [stagedEditTarget, setStagedEditTarget] = useState<TimeEntry | null>(null)

  const [addEntryDate, setAddEntryDate] = useState<string | null>(null)
  const [editEntryTarget, setEditEntryTarget] = useState<TimeEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)

  const today = todayLocal()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekMinutes = minutesForPersonWeek(entries, CURRENT_USER_ID, weekStart)
  const submission = submissionFor(CURRENT_USER_ID, weekStart)
  const weekEntries = entries.filter((e) => e.personId === CURRENT_USER_ID && days.includes(e.date))
  const weekLocked = isLockedStatus(submission?.status ?? 'Not Submitted')

  // Your real target is whatever you're allocated across your assigned projects, not a flat
  // 40h — that's just the weekly cap. Being under your allocation is the expected, good
  // outcome, so it's never treated as "behind." Falls back to the cap only if you have no
  // project allocation on file at all.
  const assignments = useAssignments()
  const allocatedMinutes = committedHoursFor(assignments, CURRENT_USER_ID, 1) * 60
  const weeklyTarget = allocatedMinutes > 0 ? allocatedMinutes : WEEKLY_TARGET_MINUTES

  const currentWeek = weekStartFor(today)
  const quickWeeks = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(currentWeek, -14 + i * 7)), [currentWeek])

  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [activeDay, setActiveDay] = useState(days.includes(today) ? today : days[0])

  useEffect(() => {
    setActiveDay(days.includes(today) ? today : days[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observed) => {
        for (const obs of observed) {
          if (obs.isIntersecting) {
            const date = obs.target.getAttribute('data-day')
            if (date) setActiveDay(date)
          }
        }
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    )
    days.forEach((d) => {
      const el = dayRefs.current[d]
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [days])

  const [jumpedDay, setJumpedDay] = useState<string | null>(null)
  const jumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current)
    }
  }, [])

  function scrollToDay(d: string) {
    setActiveDay(d)
    dayRefs.current[d]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current)
    setJumpedDay(d)
    jumpTimeoutRef.current = setTimeout(() => setJumpedDay(null), 1100)
  }

  const manualMinutes = timeToMinutes(manualEndTime) - timeToMinutes(manualStartTime)

  // Manual entries are staged locally first, so you can build up a whole day's worth
  // before writing anything — mirrors the "add several, save once" flow in the design.
  function addManualEntry() {
    if (!manualDesc.trim() || manualMinutes <= 0) return
    setStagedEntries((prev) => [
      ...prev,
      {
        id: nextStagedId(),
        personId: CURRENT_USER_ID,
        date: manualDate,
        description: manualDesc.trim(),
        projectId: manualProject || null,
        category: manualCategory,
        minutes: manualMinutes,
        startMinutes: timeToMinutes(manualStartTime),
        billable: manualBillable,
      },
    ])
    // Continue chronologically: the next entry picks up where this one left off.
    setManualStartTime(manualEndTime)
    setManualEndTime(minutesToTime(timeToMinutes(manualEndTime) + manualMinutes))
    setManualDesc('')
  }

  function duplicateStagedEntry(entry: TimeEntry) {
    setStagedEntries((prev) => [...prev, { ...entry, id: nextStagedId() }])
  }

  function saveStagedEntryEdit(id: string, fields: Omit<TimeEntry, 'id' | 'personId'>) {
    setStagedEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...fields } : e)))
  }

  function deleteStagedEntry(id: string) {
    setStagedEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function saveStagedEntries() {
    if (stagedEntries.length === 0) return
    addEntries(stagedEntries.map(({ id: _id, ...rest }) => rest))
    setStagedEntries([])
  }

  function clearStagedEntries() {
    setStagedEntries([])
  }

  const stagedByDate = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of stagedEntries) {
      map.set(e.date, [...(map.get(e.date) ?? []), e])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stagedEntries])

  function resumeAsTimer(entry: TimeEntry) {
    setMode('Timer')
    setTimerBillable(entry.billable ?? true)
    startTimer({ description: entry.description, projectId: entry.projectId, category: entry.category })
    triggerScreenRipple()
  }

  function applyQuickDuration(mins: number) {
    setManualEndTime(minutesToTime(timeToMinutes(manualStartTime) + mins))
  }

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="my-time" />}>
      <div className="page-title">My Time</div>

      <div style={{ position: 'relative', background: 'var(--color-background-subtle)', border: '1px solid var(--color-border-default)', borderRadius: 14, padding: 21 }}>
        <div style={{ position: 'absolute', top: -12, left: 21, display: 'flex', gap: 2 }}>
          <button
            onClick={() => setMode('Timer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 14px',
              borderRadius: 30,
              background: mode === 'Timer' ? 'var(--color-background-inverse)' : 'linear-gradient(var(--color-background-muted), var(--color-background-muted)) var(--color-background-page)',
              color: mode === 'Timer' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
              fontSize: 12,
              fontWeight: 600,
              boxShadow: mode === 'Timer' ? 'inset 0 2px 0 0 #66aba9' : 'none',
            }}
          >
            Timer
          </button>
          <button
            onClick={() => setMode('Manual')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 14px',
              borderRadius: 30,
              background: mode === 'Manual' ? 'var(--color-background-inverse)' : 'linear-gradient(var(--color-background-muted), var(--color-background-muted)) var(--color-background-page)',
              color: mode === 'Manual' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
              fontSize: 12,
              fontWeight: 600,
              boxShadow: mode === 'Manual' ? 'inset 0 2px 0 0 #66aba9' : 'none',
            }}
          >
            Manual
          </button>
        </div>

        {mode === 'Timer' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
              {timer.running && <TimerActivityIcon size={18} color="#00736f" />}
              <span className="mono" style={{ fontSize: 24, fontWeight: 400 }}>{formatStopwatch(timer.seconds)}</span>
            </div>
            <input
              className="input"
              style={{ flex: 1, minWidth: 160, borderRadius: 10 }}
              placeholder="Working on"
              value={timer.description}
              onChange={(e) => setTimerDescription(e.target.value)}
            />
            <SearchableSelect
              recentKey="project"
              recentFrom={recentProjectIds}
              allLabel="All projects"
              value={timer.projectId}
              onChange={setTimerProjectId}
              placeholder="Select Project"
              style={{ width: 220 }}
              options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <div className="hide-on-phone" style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border-default)' }} />
            <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
              <CategoryTagButton value={timer.category} onChange={setTimerCategory} size={36} defaultValue="Development" />
              <BillableButton value={timer.billable} onChange={setTimerBillable} size={36} />
            </div>
            {timer.running ? (
              <button
                className="btn-outline"
                style={{ borderRadius: 10 }}
                onClick={() => {
                  if (stopAndSaveTimer()) triggerScreenRipple()
                }}
              >
                <StopIcon size={14} /> Stop & save
              </button>
            ) : (
              <button
                className="btn-dark"
                style={{ borderRadius: 10 }}
                onClick={() => {
                  toggleTimerRunning()
                  triggerScreenRipple()
                }}
              >
                <PlayIcon size={14} color="var(--color-text-inverse)" /> Start timer
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <TimeInput label="Start" value={manualStartTime} onChange={setManualStartTime} />
              <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
                <CircleArrowRightIcon size={16} color="var(--color-text-tertiary)" />
              </div>
              <TimeInput label="End" value={manualEndTime} onChange={setManualEndTime} />
              <div style={{ width: 150 }}>
                <div className="field-label">Date</div>
                <DatePicker style={{ borderRadius: 16 }} value={manualDate} onChange={setManualDate} />
              </div>
              <div style={{ flex: 2, minWidth: 180 }}>
                <div className="field-label">Description</div>
                <input className="input" style={{ borderRadius: 10 }} value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="Worked on" />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="field-label">Project</div>
                <SearchableSelect
                  recentKey="project"
                  recentFrom={recentProjectIds}
                  allLabel="All projects"
                  value={manualProject}
                  onChange={setManualProject}
                  placeholder="No project"
                  options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <DurationPicker options={QUICK_DURATIONS} selectedMinutes={manualMinutes} onSelect={applyQuickDuration} />
              <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
                <CategoryTagButton value={manualCategory} onChange={setManualCategory} size={36} defaultValue="Manual" />
                <BillableButton value={manualBillable} onChange={setManualBillable} size={36} />
                <button className="btn-dark" style={{ borderRadius: 10 }} disabled={!manualDesc.trim() || manualMinutes <= 0} onClick={addManualEntry}>Add Entry</button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stagedByDate.length === 0 ? (
                <div style={{ padding: '10px 12px', border: '1px dashed var(--color-border-subtle)', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  Nothing added yet — entries you add will show here.
                </div>
              ) : (
                stagedByDate.map(([date, dayEntries]) => {
                  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                  const dayTotal = dayEntries.reduce((s, e) => s + e.minutes, 0)
                  return (
                    <div key={date}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{dayLabel}</span>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{formatMinutes(dayTotal)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dayEntries.map((e) => (
                          <EntryRow key={e.id} entry={e} onEdit={setStagedEditTarget} onDuplicate={duplicateStagedEntry} onResume={resumeAsTimer} onDelete={setStagedDeleteTarget} />
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn-outline" style={{ borderRadius: 10 }} disabled={stagedEntries.length === 0} onClick={clearStagedEntries}>Clear All</button>
                <button className="btn-dark" style={{ borderRadius: 10 }} disabled={stagedEntries.length === 0} onClick={saveStagedEntries}>Save Added Entries</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {stagedDeleteTarget && (
        <ConfirmDialog
          title="Remove this entry?"
          message={`This will remove "${stagedDeleteTarget.description || 'Untitled entry'}" (${formatMinutes(stagedDeleteTarget.minutes)}) from the batch you're building — it hasn't been saved yet.`}
          confirmLabel="Remove"
          onCancel={() => setStagedDeleteTarget(null)}
          onConfirm={() => {
            deleteStagedEntry(stagedDeleteTarget.id)
            setStagedDeleteTarget(null)
          }}
        />
      )}

      {confirmingSubmit && (
        <ConfirmDialog
          title="Submit this week for review?"
          message={`You've logged ${formatMinutes(weekMinutes)} of your ${formatMinutes(weeklyTarget)} allocation. Once submitted, entries lock and you'll need to request a recall to change anything.`}
          confirmLabel="Submit"
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={() => {
            submitWeek(CURRENT_USER_ID, weekStart)
            setConfirmingSubmit(false)
          }}
        />
      )}

      <div className="stat-strip" style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--color-background-page)', border: '1px solid var(--color-border-default)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ flex: '1 1 160px', minWidth: 160, padding: '16px 20px', borderRight: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Week logged</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{formatMinutes(weekMinutes)}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>/ {allocatedMinutes > 0 ? 'Allocated' : 'Cap'} {formatMinutes(weeklyTarget)}</span>
          </div>
        </div>
        <div style={{ flex: '1 1 120px', minWidth: 120, padding: '16px 20px', borderRight: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Balance</div>
          <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: weekMinutes <= weeklyTarget ? 'var(--brand-text)' : 'var(--warn-fg)' }}>
            {formatMinutes(weeklyTarget - weekMinutes)}
          </span>
        </div>
        <div style={{ flex: '1 1 120px', minWidth: 120, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Status</div>
          <span className={`badge ${submission?.status === 'Approved' ? 'b-pine' : submission?.status === 'Pending' ? 'b-ember' : submission?.status === 'Rejected' ? 'b-danger' : 'b-neutral'}`}>
            {submission?.status ?? 'Not Submitted'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Week of {formatWeekRange(weekStart)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            aria-label="Previous week"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
              background: 'var(--color-background-page)',
            }}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeftIcon size={14} color="var(--color-text-primary)" />
          </button>
          <button
            style={{
              padding: '7px 12px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
              background: 'var(--color-background-page)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.36px',
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setWeekStart(weekStartFor(todayLocal()))}
          >
            This week
          </button>
          <button
            aria-label="Next week"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
              background: 'var(--color-background-page)',
            }}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRightIcon size={14} color="var(--color-text-primary)" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {days.map((d) => {
          const mins = minutesForPersonDate(entries, CURRENT_USER_ID, d)
          const isToday = d === today
          const dayName = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
          const dateNum = d.slice(-2)
          const fillPct = Math.min(mins / DAILY_TARGET_MINUTES, 1) * 100
          const isFull = mins >= DAILY_TARGET_MINUTES
          const dow = new Date(d + 'T00:00:00').getDay()
          const isWeekend = dow === 0 || dow === 6
          const deEmphasize = isWeekend && mins === 0 && !isToday
          return (
            <button
              key={d}
              onClick={() => {
                setManualDate(d)
                setMode('Manual')
              }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                flex: '1 1 90px',
                background: 'var(--color-background-page)',
                border: isToday ? '1.5px dashed var(--brand-mid)' : '1px solid var(--table-row-border)',
                boxShadow: isToday ? '0 0 0 3px rgba(0,115,111,0.08)' : 'none',
                borderRadius: 14,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                textAlign: 'left',
                opacity: deEmphasize ? 0.55 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {mins > 0 && (
                <div
                  className={isToday ? 'liquid-fill-wavy-top' : undefined}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${fillPct}%`,
                    background: isFull ? 'var(--brand-deep)' : 'var(--daycard-fill-partial)',
                    transition: 'height 0.4s ease, background 0.3s ease',
                  }}
                />
              )}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: isFull ? '#fff' : isToday ? 'var(--brand-mid)' : 'var(--color-text-primary)' }}>{dateNum}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: isFull ? 'rgba(255,255,255,0.6)' : isToday ? 'var(--brand-mid)' : 'var(--color-text-tertiary)' }}>{dayName}</span>
              </div>
              <div className="mono" style={{ position: 'relative', zIndex: 1, fontSize: 13, fontWeight: 600, color: isFull ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)' }}>{mins > 0 ? formatMinutes(mins) : '—'}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {quickWeeks.map((w) => {
          const st = weekChipStatus(w, currentWeek, entries, submissions)
          const selected = w === weekStart
          return (
            <button
              key={w}
              onClick={() => setWeekStart(w)}
              title={st ? `${formatWeekRange(w)} · ${st.label}` : formatWeekRange(w)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: selected ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                background: selected ? 'var(--color-background-inverse)' : 'var(--color-background-muted)',
              }}
            >
              {st && (
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: st.hollow ? 'transparent' : st.color,
                    border: st.hollow ? `1.5px solid ${st.color}` : 'none',
                  }}
                />
              )}
              {formatWeekRange(w)}
              {st?.label === 'Current' && <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.85 }}>{st.label}</span>}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, background: 'var(--color-background-subtle)', border: '1px solid var(--color-border-default)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{formatWeekRange(weekStart)}</div>
              {weekLocked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <LockIcon size={11} color="var(--color-text-secondary)" />
                  Locked — entries can't be edited while {submission?.status === 'Approved' ? 'approved' : 'in review'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{formatMinutes(weekMinutes)} / {formatMinutes(weeklyTarget)}</span>
              <button
                className="btn-dark"
                disabled={weekEntries.length === 0 || weekLocked}
                onClick={() => {
                  if (weekMinutes < weeklyTarget) setConfirmingSubmit(true)
                  else submitWeek(CURRENT_USER_ID, weekStart)
                }}
              >
                Submit Week
              </button>
            </div>
          </div>

          {days.map((d) => {
            const dayEntries = weekEntries.filter((e) => e.date === d)
            const isToday = d === today
            const isJumped = d === jumpedDay
            const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <div
                key={d}
                data-day={d}
                ref={(el) => { dayRefs.current[d] = el }}
                style={{
                  background: isJumped ? 'var(--color-background-muted)' : 'var(--color-background-page)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  scrollMarginTop: 70,
                  boxShadow: isJumped ? '0 6px 20px rgba(20,22,27,0.12)' : 'none',
                  transform: isJumped ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease, background 0.4s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{dayLabel}</span>
                    {isToday && <span className="badge b-pine">Today</span>}
                  </span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{formatMinutes(dayEntries.reduce((s, e) => s + e.minutes, 0))}</span>
                </div>
                {dayEntries.length === 0 ? (
                  weekLocked ? (
                    <div style={{ width: '100%', padding: '10px 14px', border: '1px dashed var(--color-border-default)', borderRadius: 10, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                      Nothing logged
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddEntryDate(d)}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: '1px dashed var(--color-border-default)', borderRadius: 10, fontSize: 12, color: 'var(--color-text-tertiary)' }}
                    >
                      Nothing logged, click to add
                    </button>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dayEntries.map((e) => (
                      <EntryRow key={e.id} entry={e} locked={weekLocked} onEdit={setEditEntryTarget} onDuplicate={(entry) => duplicateEntry(entry.id)} onResume={resumeAsTimer} onDelete={setDeleteTarget} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="week-nav-rail" style={{ position: 'sticky', top: 16, flexShrink: 0, paddingTop: 42 }}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'absolute', top: 14, bottom: 14, width: 2, borderRadius: 1, background: 'var(--color-border-default)', zIndex: 0 }} />
            {days.map((d) => {
              const isActive = d === activeDay
              const isToday = d === today
              const short = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2).toUpperCase()
              const full = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
              return (
                <button
                  key={d}
                  className="week-nav-dot"
                  onClick={() => scrollToDay(d)}
                  title={full}
                  aria-label={`Jump to ${full}`}
                  aria-current={isActive ? 'true' : undefined}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    border: isToday && !isActive ? '1.5px solid var(--brand-mid)' : '1.5px solid var(--color-border-default)',
                    background: isActive ? 'var(--color-background-inverse)' : 'var(--color-background-page)',
                    color: isActive ? 'var(--color-text-inverse)' : isToday ? 'var(--brand-mid)' : 'var(--color-text-secondary)',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {short}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {addEntryDate && (
        <AddTimeEntryModal
          date={addEntryDate}
          onClose={() => setAddEntryDate(null)}
        />
      )}

      {editEntryTarget && (
        <AddTimeEntryModal
          date={editEntryTarget.date}
          editing={editEntryTarget}
          onClose={() => setEditEntryTarget(null)}
        />
      )}

      {stagedEditTarget && (
        <AddTimeEntryModal
          date={stagedEditTarget.date}
          editing={stagedEditTarget}
          onSave={(fields) => saveStagedEntryEdit(stagedEditTarget.id, fields)}
          onClose={() => setStagedEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete entry?"
          message={`This will permanently remove "${deleteTarget.description || 'Untitled entry'}" (${formatMinutes(deleteTarget.minutes)}). This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteEntry(deleteTarget.id)
            setDeleteTarget(null)
          }}
        />
      )}
    </AppShell>
  )
}

// One logged-time row with hover-reveal Duplicate / Resume-as-timer / Delete actions —
// Status cue for a week chip: a dot (solid for something that needs attention or has been decided,
// a hollow ring for the quiet current/upcoming states) plus a short label. Empty past weeks show nothing.
function weekChipStatus(
  week: string,
  currentWeek: string,
  entries: TimeEntry[],
  subs: ReturnType<typeof useSubmissions>,
): { label: string; color: string; hollow?: boolean; quiet?: boolean } | null {
  const sub = subs.find((x) => x.personId === CURRENT_USER_ID && x.weekStart === week)
  if (sub?.status === 'Approved') return { label: 'Approved', color: '#1f8a5b' }
  if (sub?.status === 'Pending') return { label: 'In review', color: '#d99a00' }
  if (sub?.status === 'Rejected') return { label: 'Rejected', color: '#e11d48' }
  if (week === currentWeek) return { label: 'Current', color: 'var(--brand-mid)', hollow: true }
  if (week > currentWeek) return { label: 'Upcoming', color: 'var(--color-text-tertiary)', hollow: true, quiet: true }
  if (minutesForPersonWeek(entries, CURRENT_USER_ID, week) > 0) return { label: 'Not submitted', color: '#ff6d33' }
  return null
}

// shared by the week's day list and the Manual-tab staged-entries list.
function EntryRow({
  entry,
  locked = false,
  onEdit,
  onDuplicate,
  onResume,
  onDelete,
}: {
  entry: TimeEntry
  locked?: boolean
  onEdit: (entry: TimeEntry) => void
  onDuplicate: (entry: TimeEntry) => void
  onResume: (entry: TimeEntry) => void
  onDelete: (entry: TimeEntry) => void
}) {
  const timer = useTimerState()
  const isRunningThis =
    timer.running && timer.description === entry.description && (timer.projectId || '') === (entry.projectId || '')

  return (
    <div
      className="time-entry-row"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: '10px 14px',
        border: '1px solid var(--color-border-default)',
        borderRadius: 10,
        background: isRunningThis ? 'rgba(0, 115, 111, 0.08)' : undefined,
      }}
    >
      <div className={`time-entry-lead${isRunningThis ? ' running' : ''}`}>
        {locked ? (
          <span className="time-entry-action-btn" title="Locked — part of a submitted week" style={{ cursor: 'default' }}>
            <LockIcon size={12} color="var(--color-text-tertiary)" />
          </span>
        ) : (
          <>
            <button
              className="time-entry-action-btn"
              onClick={() => {
                if (isRunningThis) {
                  toggleTimerRunning()
                  triggerScreenRipple()
                } else {
                  onResume(entry)
                }
              }}
              aria-label={isRunningThis ? 'Pause timer' : 'Resume as timer'}
              title={isRunningThis ? 'Pause timer' : 'Resume timer'}
              style={isRunningThis ? { background: '#00736f' } : undefined}
            >
              {isRunningThis ? <StopIcon size={10} color="#fff" /> : <PlayIcon size={12} color="var(--color-text-tertiary)" />}
            </button>
            <button className="time-entry-action-btn" onClick={() => onDuplicate(entry)} aria-label="Duplicate entry" title="Duplicate">
              <DuplicateIcon size={13} color="var(--color-text-tertiary)" />
            </button>
          </>
        )}
      </div>
      {entry.startMinutes !== undefined && (
        <div className="mono time-entry-time" style={{ width: 130, textAlign: 'right', fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
          {formatTimeRange(entry.startMinutes, entry.minutes)}
        </div>
      )}
      <div className="time-entry-main" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{entry.description}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: projectColor(entry.projectId), flexShrink: 0 }} />
          {projectLabel(entry.projectId)} · {entry.category}
          {entry.billable === false && <span className="badge b-neutral" style={{ marginLeft: 6, fontSize: 9, padding: '0 6px', height: 16 }}>Non-billable</span>}
        </div>
      </div>
      {isRunningThis && <TimerActivityIcon size={13} color="#00736f" />}
      <div className="mono time-entry-duration" style={{ fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{formatMinutes(entry.minutes)}</div>
      {!locked && (
        <div className="time-entry-actions">
          <button className="time-entry-action-btn time-entry-action-btn-danger" onClick={() => onDelete(entry)} aria-label="Delete entry" title="Delete">
            <TrashIcon color="#991b1b" />
          </button>
          <button className="time-entry-action-btn" onClick={() => onEdit(entry)} aria-label="Edit entry" title="Edit">
            <EditIcon size={13} color="var(--color-text-tertiary)" />
          </button>
        </div>
      )}
    </div>
  )
}
