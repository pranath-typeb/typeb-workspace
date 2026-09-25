import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon, TrashIcon } from '../../components/icons'
import { CURRENT_USER_ID } from '../../data/people'
import { useProjects } from '../../data/projects'
import {
  addDays,
  addEntry,
  deleteEntry,
  formatMinutes,
  formatWeekRange,
  minutesForPersonDate,
  minutesForPersonWeek,
  projectLabel,
  submissionFor,
  submitWeek,
  todayLocal,
  useSubmissions,
  useTimeEntries,
  weekStartFor,
  WEEKLY_TARGET_MINUTES,
} from '../../data/timeEntries'

function formatStopwatch(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function MyTime() {
  const entries = useTimeEntries()
  const submissions = useSubmissions()
  const projects = useProjects()

  const [weekStart, setWeekStart] = useState(() => weekStartFor(todayLocal()))
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [timerDesc, setTimerDesc] = useState('')
  const [timerProject, setTimerProject] = useState('')

  const [manualDate, setManualDate] = useState(() => todayLocal())
  const [manualDesc, setManualDesc] = useState('')
  const [manualProject, setManualProject] = useState('')
  const [manualMinutes, setManualMinutes] = useState(60)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  const today = todayLocal()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekMinutes = minutesForPersonWeek(entries, CURRENT_USER_ID, weekStart)
  const submission = submissionFor(CURRENT_USER_ID, weekStart)
  const weekEntries = entries.filter((e) => e.personId === CURRENT_USER_ID && days.includes(e.date))

  const currentWeek = weekStartFor(today)
  const quickWeeks = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(currentWeek, -14 + i * 7)), [currentWeek])

  function stopTimer() {
    if (seconds > 0) {
      addEntry({
        personId: CURRENT_USER_ID,
        date: todayLocal(),
        description: timerDesc.trim() || 'Untitled entry',
        projectId: timerProject || null,
        category: 'Development',
        minutes: Math.max(1, Math.round(seconds / 60)),
      })
    }
    setRunning(false)
    setSeconds(0)
    setTimerDesc('')
    setTimerProject('')
  }

  function addManualEntry() {
    if (!manualDesc.trim() || manualMinutes <= 0) return
    addEntry({
      personId: CURRENT_USER_ID,
      date: manualDate,
      description: manualDesc.trim(),
      projectId: manualProject || null,
      category: 'Manual',
      minutes: manualMinutes,
    })
    setManualDesc('')
    setManualMinutes(60)
  }

  return (
    <AppShell appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="my-time" />}>
      <div className="page-title">My Time</div>

      <div style={{ position: 'relative', background: '#fafafa', border: '1px solid #ebebeb', borderRadius: 14, padding: 21 }}>
        <div style={{ position: 'absolute', top: -12, left: 21, display: 'flex', background: '#fff', border: '1px solid #ebebeb', borderRadius: 20, padding: 2 }}>
          <span style={{ padding: '4px 14px', borderRadius: 16, background: '#171717', color: '#fff', fontSize: 12, fontWeight: 600 }}>Timer</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600, minWidth: 100 }}>{formatStopwatch(seconds)}</div>
          <input
            className="input"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="What are you working on?"
            value={timerDesc}
            onChange={(e) => setTimerDesc(e.target.value)}
          />
          <select className="input" style={{ width: 180 }} value={timerProject} onChange={(e) => setTimerProject(e.target.value)}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {running ? (
            <button className="btn-outline" onClick={stopTimer}>Stop & save</button>
          ) : (
            <button className="btn-dark" onClick={() => setRunning(true)}>Start timer</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', background: '#fff', border: '1px solid #ececee', borderRadius: 14 }}>
        <div style={{ flex: 1, padding: '16px 20px', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 12, color: '#737373', marginBottom: 6 }}>Week logged</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{formatMinutes(weekMinutes)}</span>
            <span className="mono" style={{ fontSize: 12, color: '#a1a1a1' }}>/ Target {formatMinutes(WEEKLY_TARGET_MINUTES)}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px 20px', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 12, color: '#737373', marginBottom: 6 }}>Balance</div>
          <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: weekMinutes >= WEEKLY_TARGET_MINUTES ? '#004543' : '#ff4800' }}>
            {formatMinutes(weekMinutes - WEEKLY_TARGET_MINUTES)}
          </span>
        </div>
        <div style={{ flex: 1, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: '#737373', marginBottom: 6 }}>Status</div>
          <span className={`badge ${submission?.status === 'Approved' ? 'b-pine' : submission?.status === 'Pending' ? 'b-ember' : submission?.status === 'Rejected' ? 'b-danger' : 'b-neutral'}`}>
            {submission?.status ?? 'Not Submitted'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Week of {formatWeekRange(weekStart)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Prev</button>
          <button className="btn-outline" onClick={() => setWeekStart(weekStartFor(todayLocal()))}>This week</button>
          <button className="btn-outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next ›</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {days.map((d) => {
          const mins = minutesForPersonDate(entries, CURRENT_USER_ID, d)
          const isToday = d === today
          const dayName = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
          const dateNum = d.slice(-2)
          return (
            <button
              key={d}
              onClick={() => setManualDate(d)}
              style={{
                flex: '1 1 90px',
                background: mins > 0 ? '#004543' : '#fff',
                border: isToday ? '1.5px dashed #00736f' : mins > 0 ? 'none' : '1px solid #f5f5f5',
                boxShadow: isToday ? '0 0 0 3px rgba(0,115,111,0.08)' : 'none',
                borderRadius: 14,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: mins > 0 ? '#fff' : isToday ? '#00736f' : '#171717' }}>{dateNum}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: mins > 0 ? 'rgba(255,255,255,0.6)' : isToday ? '#00736f' : '#a1a1a1' }}>{dayName}</span>
              </div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: mins > 0 ? '#fff' : '#171717' }}>{mins > 0 ? formatMinutes(mins) : '—'}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {quickWeeks.map((w) => (
          <button
            key={w}
            onClick={() => setWeekStart(w)}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: w === weekStart ? '#fff' : '#a1a1a1',
              background: w === weekStart ? '#0a0a0a' : '#f5f5f5',
            }}
          >
            {formatWeekRange(w)}
          </button>
        ))}
      </div>

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Add a manual entry</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="field-label">Date</div>
            <input className="input" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <div className="field-label">Description</div>
            <input className="input" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="What did you work on?" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="field-label">Project</div>
            <select className="input" value={manualProject} onChange={(e) => setManualProject(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 100 }}>
            <div className="field-label">Minutes</div>
            <input className="input" type="number" min={1} value={manualMinutes} onChange={(e) => setManualMinutes(Number(e.target.value))} />
          </div>
          <button className="btn-dark" onClick={addManualEntry}>Add</button>
        </div>
      </div>

      <div style={{ background: '#f6f6f6', border: '1px solid #ebebeb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatWeekRange(weekStart)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#737373' }}>{formatMinutes(weekMinutes)} / {formatMinutes(WEEKLY_TARGET_MINUTES)}</span>
            <button
              className="btn-dark"
              disabled={weekEntries.length === 0 || submission?.status === 'Pending' || submission?.status === 'Approved'}
              onClick={() => submitWeek(CURRENT_USER_ID, weekStart)}
            >
              Submit Week
            </button>
          </div>
        </div>

        {days.map((d) => {
          const dayEntries = weekEntries.filter((e) => e.date === d)
          const isToday = d === today
          const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={d} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{dayLabel}</span>
                  {isToday && <span className="badge b-pine">Today</span>}
                </span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{formatMinutes(dayEntries.reduce((s, e) => s + e.minutes, 0))}</span>
              </div>
              {dayEntries.length === 0 ? (
                <button
                  onClick={() => setManualDate(d)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: '1px dashed #ebebeb', borderRadius: 10, fontSize: 12, color: 'rgba(0,0,0,0.35)' }}
                >
                  Nothing logged, click to add
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayEntries.map((e) => (
                    <div key={e.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', border: '1px solid #ebebeb', borderRadius: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{e.description}</div>
                        <div style={{ fontSize: 11, color: '#737373', marginTop: 2 }}>{projectLabel(e.projectId)} · {e.category}</div>
                      </div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{formatMinutes(e.minutes)}</div>
                      <button onClick={() => deleteEntry(e.id)} aria-label="Delete entry"><TrashIcon color="rgba(0,0,0,0.35)" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
