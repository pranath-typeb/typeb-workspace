import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import DatePicker from '../../components/DatePicker'
import FilterBar from '../../components/FilterBar'
import { avatarContent } from '../../components/Avatar'
import { StageChip, money } from '../../components/PayrollParts'
import { ChevronDownIcon, CloseIcon, WalletIcon } from '../../components/icons'
import { personById, usePeople, type Department } from '../../data/people'
import { runPayroll, usePayrollPeriods } from '../../data/payroll'
import { cycleBreakdown, cyclesFrom, fmtLong, hoursState, isOverdue, nextStep, stageOf, type StageKey } from '../../data/payrollInsights'
import { useSubmissions } from '../../data/timeEntries'
import { useCalendarEvents } from '../../data/calendarEvents'
import { useUrlParam } from '../../lib/useUrlState'

const DEPARTMENTS: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']

// The order a payroll moves through — drives the progress bar and its legend.
const FUNNEL: { key: StageKey; label: string; color: string }[] = [
  { key: 'awaiting-confirmation', label: 'Awaiting confirmation', color: '#8b5cf6' },
  { key: 'awaiting-approval', label: 'Awaiting approval', color: '#94a3b8' },
  { key: 'ready', label: 'Ready to submit', color: '#2aa39d' },
  { key: 'under-review', label: 'Under review', color: '#f5a524' },
  { key: 'update-needed', label: 'Update needed', color: '#e11d48' },
  { key: 'approved', label: 'Approved', color: '#1f8a5b' },
  { key: 'paid', label: 'Paid out', color: '#0f6b44' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const periods = usePayrollPeriods()
  const people = usePeople()
  const events = useCalendarEvents()
  useSubmissions() // weekly approvals feed the stage of each payroll
  const [query, setQuery] = useUrlParam('q', '')
  const [dept, setDept] = useUrlParam<'All' | Department>('dept', 'All')
  const [runOpen, setRunOpen] = useState(false)

  const cycles = useMemo(() => cyclesFrom(periods), [periods])
  const [cycleKey, setCycleKey] = useUrlParam('cycle', cycles[0]?.cycle ?? '')
  const active = cycles.find((c) => c.cycle === cycleKey) ?? cycles[0]

  const cycleAll = useMemo(() => periods.filter((p) => p.cycle === active?.cycle), [periods, active])
  const cyclePeriods = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cycleAll.filter((p) => {
      const person = personById(p.personId)
      if (dept !== 'All' && person?.department !== dept) return false
      return !q || (person?.name.toLowerCase().includes(q) ?? false)
    })
  }, [cycleAll, query, dept])

  const staged = useMemo(() => cyclePeriods.map((p) => ({ p, stage: stageOf(p), overdue: isOverdue(p) })), [cyclePeriods])
  const counts = useMemo(() => {
    const m = new Map<StageKey, number>()
    staged.forEach((s) => m.set(s.stage.key, (m.get(s.stage.key) ?? 0) + 1))
    return m
  }, [staged])

  const total = cyclePeriods.length
  const gross = cyclePeriods.reduce((sum, p) => sum + p.grossPay, 0)
  const submitted = staged.filter((s) => ['under-review', 'update-needed', 'approved', 'paid'].includes(s.stage.key)).length
  const pending = staged.filter((s) => s.stage.step === 0).length
  const approved = staged.filter((s) => s.stage.key === 'approved' || s.stage.key === 'paid').length
  const paid = counts.get('paid') ?? 0

  // Things a payroll admin has to act on, most urgent first.
  const attention = useMemo(() => {
    const rank = (s: (typeof staged)[number]) => (s.stage.key === 'under-review' ? 0 : s.overdue ? 1 : s.stage.key === 'update-needed' ? 2 : 3)
    return staged
      .filter((s) => s.stage.key === 'under-review' || s.overdue || s.stage.key === 'update-needed')
      .sort((a, b) => rank(a) - rank(b))
  }, [staged])

  const breakdown = useMemo(() => cycleBreakdown(cycleAll, people, events), [cycleAll, people, events])

  function toReviews(stage?: StageKey) {
    const params = new URLSearchParams()
    if (active) params.set('cycle', active.cycle)
    if (stage) params.set('stage', stage)
    navigate(`/payroll/reviews?${params.toString()}`)
  }

  const years = useMemo(() => Array.from(new Set(cycles.map((c) => c.year))).sort((a, b) => b - a), [cycles])
  const [closedYears, setClosedYears] = useState<Set<number>>(new Set())

  return (
    <AppShell appIcon={<WalletIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="dashboard" />}>
      <div className="page-title">Dashboard</div>

      <div className="pr-dash">
        {/* Pay cycles: a rail on desktop, a swipeable strip on phones */}
        <nav className="pr-cycles" aria-label="Pay cycles">
          {years.map((y) => {
            const open = !closedYears.has(y)
            return (
              <div key={y} className="pr-cycles-year">
                <button
                  type="button"
                  className="pr-cycles-yearhead"
                  aria-expanded={open}
                  onClick={() => setClosedYears((s) => { const n = new Set(s); if (n.has(y)) n.delete(y); else n.add(y); return n })}
                >
                  {y}
                  <ChevronDownIcon size={13} color="var(--color-text-tertiary)" />
                </button>
                {open && (
                  <div className="pr-cycles-list">
                    {cycles.filter((c) => c.year === y).map((c) => (
                      <button key={c.cycle} type="button" className={`pr-cycle${c.cycle === active?.cycle ? ' on' : ''}`} onClick={() => setCycleKey(c.cycle)}>
                        <span className="pr-cycle-name">{c.label}</span>
                        <span className="pr-cycle-range">{c.cycle}</span>
                        <span className="pr-cycle-count mono">{c.headcount}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {cycles.length === 0 && <div className="pp-empty">No pay cycles yet.</div>}
        </nav>

        <div className="pr-dash-main">
          <div className="pr-dash-head">
            <div>
              <h2 className="serif pr-dash-title">{active?.label ?? 'No data'}</h2>
              {active && <div className="pr-dash-sub">{fmtLong(active.start)} – {fmtLong(active.end)}</div>}
            </div>
            <button className="btn-dark" disabled={approved - paid === 0} onClick={() => setRunOpen(true)} title={approved - paid === 0 ? 'Nothing is approved yet' : undefined}>
              Run payroll{approved - paid > 0 ? ` · ${approved - paid}` : ''}
            </button>
          </div>

          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: 'Search employees' }}
            filters={[
              {
                key: 'dept',
                label: 'Department',
                value: dept,
                defaultValue: 'All',
                onChange: (v) => setDept(v as 'All' | Department),
                options: DEPARTMENTS.map((d) => ({ value: d, label: d })),
              },
            ]}
            count={`${total} ${total === 1 ? 'employee' : 'employees'}`}
          />

          {/* Where this payroll stands */}
          <div className="card pr-funnel">
            <div className="pr-funnel-head">
              <div>
                <div className="pr-section-title">Where this payroll stands</div>
                <div className="pr-dash-sub">Every employee’s pay moves through timesheet → review → approved → paid out.</div>
              </div>
              <div className="pr-funnel-total">
                <div className="mono pr-funnel-gross">{money(gross)}</div>
                <div className="pr-dash-sub">total gross pay</div>
              </div>
            </div>
            <div className="pr-funnel-bar" role="img" aria-label="Employees by payroll stage">
              {FUNNEL.map((f) => {
                const n = counts.get(f.key) ?? 0
                return n ? <button key={f.key} type="button" title={`${f.label}: ${n}`} style={{ flex: n, background: f.color }} onClick={() => toReviews(f.key)} /> : null
              })}
              {total === 0 && <span style={{ flex: 1, background: 'var(--color-background-muted)' }} />}
            </div>
            <div className="pr-funnel-legend">
              {FUNNEL.map((f) => {
                const n = counts.get(f.key) ?? 0
                return (
                  <button key={f.key} type="button" className={`pr-legend-row${n ? '' : ' zero'}`} disabled={!n} onClick={() => toReviews(f.key)}>
                    <span className="pr-legend-dot" style={{ background: f.color }} />
                    <span className="pr-legend-name">{f.label}</span>
                    <span className="mono pr-legend-n">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pr-tiles">
            <Tile label="Employees" value={String(total)} sub={`${money(gross)} gross`} onClick={() => toReviews()} />
            <Tile label="Submitted" value={String(submitted)} sub={`of ${total} reviews`} onClick={() => toReviews()} />
            <Tile label="Pending timesheets" value={String(pending)} sub="not yet submitted" tone={pending ? 'warn' : undefined} onClick={() => toReviews('awaiting-confirmation')} />
            <Tile label="Approved / paid out" value={String(approved)} sub={`${paid} paid out`} onClick={() => toReviews('approved')} />
          </div>

          {/* Needs attention */}
          <div className="card pr-attention">
            <div className="pr-funnel-head">
              <div className="pr-section-title">Needs your attention</div>
              {attention.length > 0 && <span className="pr-flag warn">{attention.length}</span>}
            </div>
            {attention.length === 0 ? (
              <div className="pp-empty">Nothing needs a decision right now. 🎉</div>
            ) : (
              <div className="pr-attn-list">
                {attention.slice(0, 6).map(({ p, stage, overdue }) => {
                  const person = personById(p.personId)
                  const hs = hoursState(p)
                  return (
                    <Link key={p.id} to={`/payroll/reviews/${p.id}`} className="pr-attn-row">
                      <span className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0 }}>{person ? avatarContent(person) : '?'}</span>
                      <span className="pr-attn-main">
                        <span className="pr-attn-name">{person?.name ?? 'Unknown'}</span>
                        <span className="pr-attn-why">{nextStep(p, 'admin').title}{hs.tone === 'warn' ? ` · ${hs.label}` : ''}</span>
                      </span>
                      <StageChip stage={stage} overdue={overdue} small />
                    </Link>
                  )
                })}
                {attention.length > 6 && (
                  <button type="button" className="pp-more" onClick={() => toReviews('under-review')}>See all {attention.length}</button>
                )}
              </div>
            )}
          </div>

          {/* Working days & holidays */}
          <Section breakdown={breakdown} label={active?.label ?? ''} />
        </div>
      </div>

      {runOpen && active && (
        <RunPayrollModal
          label={active.label}
          readyIds={cyclePeriods.filter((p) => p.status === 'Approved').map((p) => p.id)}
          blocked={FUNNEL.filter((f) => ['awaiting-confirmation', 'awaiting-approval', 'ready', 'under-review', 'update-needed'].includes(f.key)).map((f) => ({ label: f.label, n: counts.get(f.key) ?? 0 })).filter((b) => b.n > 0)}
          gross={cyclePeriods.filter((p) => p.status === 'Approved').reduce((s, p) => s + p.grossPay, 0)}
          onClose={() => setRunOpen(false)}
        />
      )}
    </AppShell>
  )
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub: string; tone?: 'warn'; onClick: () => void }) {
  return (
    <button type="button" className="pr-tile" onClick={onClick}>
      <span className="pr-tile-label">{label}</span>
      <span className="mono pr-tile-value" style={tone === 'warn' ? { color: 'var(--warn-fg)' } : undefined}>{value}</span>
      <span className="pr-tile-sub">{sub}</span>
    </button>
  )
}

function Section({ breakdown, label }: { breakdown: ReturnType<typeof cycleBreakdown>; label: string }) {
  const [openName, setOpenName] = useState<string | null>(null)
  return (
    <div className="card pr-breakdown">
      <div className="pr-section-title">Working days by country · {label}</div>
      <div className="pr-dash-sub">
        Public holidays reduce each country’s working days. Salary is prorated against these, so a country with more holidays has a smaller month.
      </div>
      <div className="pr-bk-list">
        {breakdown.map((b) => {
          const open = openName === b.name
          return (
            <div key={b.name} className="pr-bk">
              <button type="button" className="pr-bk-head" aria-expanded={open} onClick={() => setOpenName(open ? null : b.name)}>
                <span className="pr-bk-name">{b.name}</span>
                <span className="pr-bk-badges">
                  <span className="pr-bk-badge days">{b.workingDays} working days</span>
                  <span className={`pr-bk-badge ${b.holidays.length ? 'hol' : 'none'}`}>{b.holidays.length} {b.holidays.length === 1 ? 'holiday' : 'holidays'}</span>
                </span>
                <span className="pr-bk-emp">{b.employees} {b.employees === 1 ? 'employee' : 'employees'}</span>
                <ChevronDownIcon size={14} color="var(--color-text-tertiary)" />
              </button>
              {open && (
                <div className="pr-bk-body">
                  <div className="pr-bk-stats">
                    <Mini label="Working days" value={b.workingDays} />
                    <Mini label="Holidays counted" value={b.holidays.filter((h) => h.counted).length} />
                    <Mini label="Employees" value={b.employees} />
                    <Mini label="Weekend days" value={b.weekendDays} />
                    <Mini label="Calendar days" value={b.calendarDays} />
                  </div>
                  {b.holidays.length > 0 ? (
                    <table className="pr-bk-table">
                      <thead>
                        <tr><th>Date</th><th>Holiday</th><th>Counted</th></tr>
                      </thead>
                      <tbody>
                        {b.holidays.map((h) => (
                          <tr key={h.date + h.title}>
                            <td className="mono">{h.date}</td>
                            <td>{h.title}</td>
                            <td><span className={`pr-flag ${h.counted ? 'ok' : 'warn'}`}>{h.counted ? 'Counted' : 'Weekend — not counted'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="pp-empty">No public holidays this cycle.</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {breakdown.length === 0 && <div className="pp-empty">No employees in this cycle.</div>}
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="pr-mini">
      <span className="pr-mini-label">{label}</span>
      <span className="mono pr-mini-value">{value}</span>
    </div>
  )
}

function RunPayrollModal({ label, readyIds, blocked, gross, onClose }: { label: string; readyIds: string[]; blocked: { label: string; n: number }[]; gross: number; onClose: () => void }) {
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Run payroll · {label}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>
        <div className="pr-run-summary">
          <div>
            <div className="mono pr-run-n">{readyIds.length}</div>
            <div className="pr-dash-sub">approved and ready to pay · {money(gross)} gross</div>
          </div>
        </div>
        {blocked.length > 0 && (
          <div className="pr-run-blocked">
            <div className="pr-run-blocked-title">Not included — still in progress</div>
            {blocked.map((b) => (
              <div key={b.label} className="pr-run-blocked-row"><span>{b.label}</span><span className="mono">{b.n}</span></div>
            ))}
            <div className="pr-dash-sub" style={{ marginTop: 6 }}>These can be paid in a later run once they are approved.</div>
          </div>
        )}
        <div>
          <div className="field-label">Pay date</div>
          <DatePicker value={payDate} onChange={setPayDate} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={readyIds.length === 0} onClick={() => { runPayroll(readyIds, payDate); onClose() }}>
            Pay out {readyIds.length}
          </button>
        </div>
      </div>
    </div>
  )
}
