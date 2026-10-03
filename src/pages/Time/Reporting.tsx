import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import TimeSidebar from '../../components/TimeSidebar'
import { ClockIcon, DownloadIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
import { CURRENT_USER_ID, usePeople } from '../../data/people'
import { useProjects } from '../../data/projects'
import {
  addDays,
  CATEGORIES,
  categoryColor,
  entriesInRange,
  exportEntriesToCSV,
  formatMinutes,
  formatWeekRange,
  minutesForPersonWeek,
  NO_PROJECT_COLOR,
  projectLabel,
  todayLocal,
  updateEntry,
  useTimeEntries,
  weekStartFor,
  WEEKLY_TARGET_MINUTES,
} from '../../data/timeEntries'
import { Select } from '../../components/SearchableSelect'

type View = 'mine' | 'team'

function statusForPct(pct: number): { label: string; badge: string } {
  if (pct > 100) return { label: 'Over target', badge: 'b-danger' }
  if (pct < 80) return { label: 'Under target', badge: 'b-ember' }
  return { label: 'On track', badge: 'b-pine' }
}

function SegmentedToggle({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--color-background-muted)', borderRadius: 10, padding: 2 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            whiteSpace: 'nowrap',
            background: value === opt.value ? 'var(--color-background-inverse)' : 'transparent',
            color: value === opt.value ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Reporting() {
  const allEntries = useTimeEntries()
  const people = usePeople()
  const projects = useProjects()
  const [view, setView] = useState<View>('mine')

  const [rangeStart, setRangeStart] = useState(() => addDays(todayLocal(), -29))
  const [rangeEnd, setRangeEnd] = useState(() => todayLocal())
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignProjectId, setAssignProjectId] = useState('')

  const [teamWeek, setTeamWeek] = useState(() => weekStartFor(todayLocal()))
  const teamWeekOptions = useMemo(() => {
    const current = weekStartFor(todayLocal())
    return Array.from({ length: 8 }, (_, i) => addDays(current, -7 * i))
  }, [])

  const myEntries = useMemo(() => entriesInRange(allEntries, rangeStart, rangeEnd, CURRENT_USER_ID), [allEntries, rangeStart, rangeEnd])

  const byProject = useMemo(() => {
    const map = new Map<string, number>()
    myEntries.forEach((e) => {
      const key = projectLabel(e.projectId)
      map.set(key, (map.get(key) ?? 0) + e.minutes)
    })
    const max = Math.max(1, ...map.values())
    return Array.from(map.entries())
      .map(([name, minutes]) => ({ name, minutes, pct: Math.round((minutes / max) * 100) }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [myEntries])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    myEntries.forEach((e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.minutes)
    })
    const max = Math.max(1, ...map.values())
    return Array.from(map.entries())
      .map(([name, minutes]) => ({ name, minutes, pct: Math.round((minutes / max) * 100) }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [myEntries])

  const trend = useMemo(() => {
    const currentWeek = weekStartFor(todayLocal())
    const weeks = Array.from({ length: 6 }, (_, i) => addDays(currentWeek, -7 * (5 - i)))
    return weeks.map((w) => ({ weekStart: w, minutes: minutesForPersonWeek(allEntries, CURRENT_USER_ID, w) }))
  }, [allEntries])

  const totalMinutes = myEntries.reduce((s, e) => s + e.minutes, 0)
  const thisWeekMinutes = trend[trend.length - 1]?.minutes ?? 0
  const thisWeekPct = Math.round((thisWeekMinutes / WEEKLY_TARGET_MINUTES) * 100)
  const maxTrend = Math.max(1, ...trend.map((t) => t.minutes))

  const unassignedRow = byProject.find((r) => r.name === 'No project')
  const unassignedEntries = useMemo(() => myEntries.filter((e) => !e.projectId), [myEntries])

  const teamRows = useMemo(() => {
    return people
      .map((p) => {
        const minutes = minutesForPersonWeek(allEntries, p.id, teamWeek)
        const pct = Math.round((minutes / WEEKLY_TARGET_MINUTES) * 100)
        return { person: p, minutes, pct }
      })
      .sort((a, b) => a.pct - b.pct)
  }, [people, allEntries, teamWeek])

  const teamAvgPct = teamRows.length ? Math.round(teamRows.reduce((s, r) => s + r.pct, 0) / teamRows.length) : 0
  const teamUnderCount = teamRows.filter((r) => r.pct < 80).length
  const teamOverCount = teamRows.filter((r) => r.pct > 100).length

  function applyAssign() {
    if (!assignProjectId) return
    unassignedEntries.forEach((e) => updateEntry(e.id, { projectId: assignProjectId }))
    setAssignOpen(false)
    setAssignProjectId('')
  }

  function exportMine() {
    exportEntriesToCSV(myEntries, `timesheet-${CURRENT_USER_ID}-${rangeStart}-to-${rangeEnd}.csv`)
  }

  function exportTeam() {
    const teamEntries = entriesInRange(allEntries, teamWeek, addDays(teamWeek, 6))
    exportEntriesToCSV(teamEntries, `team-timesheet-${teamWeek}.csv`)
  }

  return (
    <AppShell appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />} appLabel="Time" appHref="/time" sidebar={<TimeSidebar active="reporting" />}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-title" style={{ border: 'none', paddingBottom: 0 }}>Reporting</div>
        <SegmentedToggle
          value={view}
          options={[{ value: 'mine', label: 'My Reporting' }, { value: 'team', label: 'Team' }]}
          onChange={(v) => setView(v as View)}
        />
      </div>

      {view === 'mine' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-outline"
                onClick={() => {
                  const ws = weekStartFor(todayLocal())
                  setRangeStart(ws)
                  setRangeEnd(addDays(ws, 6))
                }}
              >
                This week
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  setRangeStart(addDays(todayLocal(), -29))
                  setRangeEnd(todayLocal())
                }}
              >
                Last 30 days
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  setRangeStart('2000-01-01')
                  setRangeEnd(todayLocal())
                }}
              >
                All time
              </button>
            </div>
            <div>
              <div className="field-label">From</div>
              <input className="input" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </div>
            <div>
              <div className="field-label">To</div>
              <input className="input" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </div>
            <button className="btn-outline" onClick={exportMine}>
              <DownloadIcon size={14} color="var(--color-text-primary)" /> Export CSV
            </button>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="stat" style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Logged in range</div>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{formatMinutes(totalMinutes)}</div>
            </div>
            <div className="stat" style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>This week</div>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{formatMinutes(thisWeekMinutes)}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{thisWeekPct}% of {formatMinutes(WEEKLY_TARGET_MINUTES)} target</div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Weekly trend</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>Hours logged over the last 6 weeks</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {trend.map((t) => (
                <div key={t.weekStart} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                  <div style={{ height: 120, display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      className="mono"
                      title={formatMinutes(t.minutes)}
                      style={{ width: 28, borderRadius: '6px 6px 2px 2px', background: t.minutes >= WEEKLY_TARGET_MINUTES ? 'var(--brand-deep)' : 'var(--brand-bar)', height: Math.max(4, (t.minutes / maxTrend) * 120) }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{formatWeekRange(t.weekStart)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Hours by project</div>
              {byProject.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No entries logged in this range.</div>
              ) : (
                byProject.map((row) => {
                  const isUnassigned = row.name === 'No project'
                  return (
                    <div key={row.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4, gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {row.name}
                          {isUnassigned && <span className="badge b-ember" style={{ fontSize: 10 }}>Unassigned</span>}
                        </span>
                        <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>{formatMinutes(row.minutes)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--color-border-default)', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${row.pct}%`, background: isUnassigned ? NO_PROJECT_COLOR : 'var(--brand-deep)' }} />
                      </div>
                    </div>
                  )
                })
              )}
              {unassignedRow && (
                <button className="btn-outline" style={{ marginTop: 4 }} onClick={() => setAssignOpen(true)}>
                  Assign these {formatMinutes(unassignedRow.minutes)} to a project
                </button>
              )}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Hours by category</div>
              {byCategory.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No entries logged in this range.</div>
              ) : (
                byCategory.map((row) => (
                  <div key={row.name} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColor(row.name), display: 'inline-block' }} />
                        {row.name}
                      </span>
                      <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>{formatMinutes(row.minutes)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-border-default)', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${row.pct}%`, background: categoryColor(row.name) }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="field-label">Week</div>
              <Select className="input" style={{ width: 220 }} value={teamWeek} onChange={(e) => setTeamWeek(e.target.value)}>
                {teamWeekOptions.map((w) => (
                  <option key={w} value={w}>{formatWeekRange(w)}</option>
                ))}
              </Select>
            </div>
            <button className="btn-outline" onClick={exportTeam}>
              <DownloadIcon size={14} color="var(--color-text-primary)" /> Export CSV
            </button>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="stat" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Avg utilization</div>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{teamAvgPct}%</div>
            </div>
            <div className="stat" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Under target</div>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{teamUnderCount}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>below 80%</div>
            </div>
            <div className="stat" style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Over target</div>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px', marginTop: 6 }}>{teamOverCount}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>above 100%</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th className="th2">Employee</th>
                  <th className="th2">Hours logged</th>
                  <th className="th2">Target</th>
                  <th className="th2">Utilization</th>
                  <th className="th2">Status</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((r) => {
                  const status = statusForPct(r.pct)
                  return (
                    <tr key={r.person.id}>
                      <td className="td2">
                        <Link to={`/time/timesheets/${r.person.id}/${teamWeek}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(r.person)}</div>
                          <span style={{ fontWeight: 600 }}>{r.person.name}</span>
                        </Link>
                      </td>
                      <td className="td2 mono">{formatMinutes(r.minutes)}</td>
                      <td className="td2 mono">{formatMinutes(WEEKLY_TARGET_MINUTES)}</td>
                      <td className="td2">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: 'var(--color-border-default)', borderRadius: 9999, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, r.pct)}%`, background: r.pct > 100 ? '#ff6d33' : 'var(--brand-deep)' }} />
                          </div>
                          <span className="mono" style={{ fontSize: 12 }}>{r.pct}%</span>
                        </div>
                      </td>
                      <td className="td2"><span className={`badge ${status.badge}`}>{status.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {assignOpen && (
        <div className="modal-backdrop" onClick={() => setAssignOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Assign unassigned time</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {unassignedEntries.length} {unassignedEntries.length === 1 ? 'entry' : 'entries'} with no project, totaling {unassignedRow ? formatMinutes(unassignedRow.minutes) : '0:00'}, in the selected range.
            </div>

            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', border: '1px solid var(--table-row-border)', borderRadius: 8 }}>
              {unassignedEntries.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderTop: i === 0 ? 'none' : '1px solid var(--table-row-border)' }}>
                  <span style={{ fontSize: 13 }}>{e.description || 'Untitled entry'}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatMinutes(e.minutes)}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="field-label">Assign all to</div>
              <Select className="input" value={assignProjectId} onChange={(e) => setAssignProjectId(e.target.value)}>
                <option value="">Choose a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
                ))}
              </Select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
              <button className="btn-outline" onClick={() => setAssignOpen(false)}>Cancel</button>
              <button className="btn-dark" disabled={!assignProjectId} onClick={applyAssign}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
