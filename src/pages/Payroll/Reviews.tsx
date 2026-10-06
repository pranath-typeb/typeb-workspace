import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import FilterBar from '../../components/FilterBar'
import EmptyState from '../../components/EmptyState'
import { avatarContent } from '../../components/Avatar'
import { HoursMeter, StageChip, money } from '../../components/PayrollParts'
import { ChevronRightIcon, WalletIcon } from '../../components/icons'
import { personById, type Department } from '../../data/people'
import { bulkApprove, usePayrollPeriods } from '../../data/payroll'
import { useAssignments } from '../../data/staffing'
import { cyclesFrom, hoursState, isOverdue, reconcile, reviewFigures, stageOf, type StageKey } from '../../data/payrollInsights'
import { useSubmissions } from '../../data/timeEntries'
import { useUrlParam } from '../../lib/useUrlState'

const DEPARTMENTS: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']
const PAGE_SIZE = 25

const STAGE_LABELS: { key: StageKey; label: string; submitted: boolean }[] = [
  { key: 'under-review', label: 'Under review', submitted: true },
  { key: 'update-needed', label: 'Update needed', submitted: true },
  { key: 'approved', label: 'Approved', submitted: true },
  { key: 'paid', label: 'Paid out', submitted: true },
  { key: 'awaiting-confirmation', label: 'Awaiting confirmation', submitted: false },
  { key: 'awaiting-approval', label: 'Awaiting approval', submitted: false },
  { key: 'ready', label: 'Ready to submit', submitted: false },
]

type Group = 'leave' | 'timesheet' | 'invoice'
const GROUPS: { key: Group; label: string; hint: string }[] = [
  { key: 'leave', label: 'Leave', hint: 'Working days, PTO, unpaid leave, payout %' },
  { key: 'timesheet', label: 'Timesheet', hint: 'Target, allocated and actual hours and the gaps' },
  { key: 'invoice', label: 'Invoice', hint: 'Salary, other pay, total, invoice amount and difference' },
]

const dollars = (n: number | null) => (n === null ? '—' : money(n))
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function Reviews() {
  const periods = usePayrollPeriods()
  const assignments = useAssignments()
  useSubmissions()
  const navigate = useNavigate()

  const [stageParam, setStageParam] = useUrlParam<'All' | StageKey>('stage', 'All')
  const impliedTab = stageParam !== 'All' && STAGE_LABELS.find((s) => s.key === stageParam)?.submitted === false ? 'not-submitted' : 'submitted'
  const [tabParam, setTab] = useUrlParam<'submitted' | 'not-submitted'>('tab', impliedTab)
  const tab = tabParam
  const [cycle, setCycle] = useUrlParam('cycle', 'All')
  const [dept, setDept] = useUrlParam<'All' | Department>('dept', 'All')
  const [query, setQuery] = useUrlParam('q', '')
  const [groupsParam, setGroupsParam] = useUrlParam('cols', '')
  const groups = new Set(groupsParam.split(',').filter(Boolean) as Group[])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const cycles = useMemo(() => cyclesFrom(periods), [periods])
  const rows = useMemo(() => periods.map((p) => ({ p, stage: stageOf(p), overdue: isOverdue(p), person: personById(p.personId) })), [periods])

  const base = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (cycle !== 'All' && r.p.cycle !== cycle) return false
      if (dept !== 'All' && r.person?.department !== dept) return false
      return !q || (r.person?.name.toLowerCase().includes(q) ?? false)
    })
  }, [rows, cycle, dept, query])

  const submittedRows = base.filter((r) => r.stage.step > 0)
  const notSubmittedRows = base.filter((r) => r.stage.step === 0)
  const shown = (tab === 'submitted' ? submittedRows : notSubmittedRows).filter((r) => stageParam === 'All' || r.stage.key === stageParam)

  useEffect(() => setPage(0), [tab, cycle, dept, query, stageParam])
  const pages = Math.max(Math.ceil(shown.length / PAGE_SIZE), 1)
  const pageRows = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const reviewable = pageRows.filter((r) => r.stage.key === 'under-review')

  function toggleGroup(g: Group) {
    const next = new Set(groups)
    if (next.has(g)) next.delete(g)
    else next.add(g)
    setGroupsParam([...next].join(','))
  }
  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const allSelected = reviewable.length > 0 && reviewable.every((r) => selected.has(r.p.id))
  function approveSelected() {
    bulkApprove([...selected])
    setSelected(new Set())
  }

  const stageOptions = STAGE_LABELS.filter((s) => s.submitted === (tab === 'submitted')).map((s) => ({ value: s.key, label: s.label }))

  return (
    <AppShell appIcon={<WalletIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="reviews" />}>
      <div className="page-title">Payroll Reviews</div>

      <div className="pr-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'submitted'} className={tab === 'submitted' ? 'on' : ''} onClick={() => { setTab('submitted'); setStageParam('All') }}>
          Submitted <span className="mono">{submittedRows.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'not-submitted'} className={tab === 'not-submitted' ? 'on' : ''} onClick={() => { setTab('not-submitted'); setStageParam('All') }}>
          Not submitted <span className="mono">{notSubmittedRows.length}</span>
        </button>
      </div>
      <div className="pr-dash-sub" style={{ marginTop: -4 }}>
        {tab === 'submitted'
          ? 'Employees who sent their payroll in. Review the ones marked “Under review” and approve or request changes.'
          : 'Employees who have not submitted yet. They still need to confirm their timesheet or get their weeks approved.'}
      </div>

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: 'Search employees' }}
        filters={[
          { key: 'cycle', label: 'Pay cycle', value: cycle, defaultValue: 'All', onChange: setCycle, options: cycles.map((c) => ({ value: c.cycle, label: `${c.label} · ${c.cycle}` })) },
          { key: 'stage', label: 'Status', value: stageParam, defaultValue: 'All', onChange: (v) => setStageParam(v as 'All' | StageKey), options: stageOptions },
          { key: 'dept', label: 'Department', value: dept, defaultValue: 'All', onChange: (v) => setDept(v as 'All' | Department), options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
        ]}
        count={`${shown.length} ${shown.length === 1 ? 'review' : 'reviews'}`}
      />

      <div className="pr-colgroups">
        <span className="pr-colgroups-label">Show columns</span>
        {GROUPS.map((g) => (
          <button key={g.key} type="button" title={g.hint} aria-pressed={groups.has(g.key)} className={`pr-colchip${groups.has(g.key) ? ' on' : ''}`} onClick={() => toggleGroup(g.key)}>
            <span className="pr-colchip-box">{groups.has(g.key) ? '✓' : '+'}</span>
            {g.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="pr-bulk">
          <span>{selected.size} selected</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" onClick={() => setSelected(new Set())}>Clear</button>
            <button className="btn-dark" onClick={approveSelected}>Approve {selected.size}</button>
          </span>
        </div>
      )}

      {/* table (tablet / desktop) */}
      <div className="card pr-table-card">
        <table className="pr-table">
          <thead>
            <tr>
              <th className="th2 pr-sticky" style={{ width: 36 }}>
                {tab === 'submitted' && reviewable.length > 0 && (
                  <input type="checkbox" aria-label="Select all under review" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(reviewable.map((r) => r.p.id)))} />
                )}
              </th>
              <th className="th2 pr-sticky pr-sticky-2">Employee</th>
              <th className="th2">Pay cycle</th>
              {groups.has('leave') && (
                <>
                  <th className="th2 g-leave">Working days</th>
                  <th className="th2 g-leave">PTO</th>
                  <th className="th2 g-leave">UPTO</th>
                  <th className="th2 g-leave">Payout %</th>
                </>
              )}
              {groups.has('timesheet') && (
                <>
                  <th className="th2 g-time">Target h</th>
                  <th className="th2 g-time">Allocated h</th>
                  <th className="th2 g-time">Actual h</th>
                  <th className="th2 g-time">Actual vs target</th>
                </>
              )}
              {!groups.has('timesheet') && <th className="th2">Hours</th>}
              {groups.has('invoice') && (
                <>
                  <th className="th2 g-inv">Budget salary</th>
                  <th className="th2 g-inv">Salary payout</th>
                  <th className="th2 g-inv">Other payout</th>
                  <th className="th2 g-inv">Invoice</th>
                  <th className="th2 g-inv">Difference</th>
                  <th className="th2 g-inv">Notes</th>
                </>
              )}
              <th className="th2">Total payout</th>
              <th className="th2">Status</th>
              <th className="th2" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ p, stage, overdue, person }) => {
              const f = reviewFigures(p, assignments)
              const rec = reconcile(p)
              const hs = hoursState(p)
              return (
                <tr key={p.id} className="row-hover" style={{ cursor: 'pointer' }} onClick={() => navigate(`/payroll/reviews/${p.id}`)}>
                  <td className="td2 pr-sticky" onClick={(e) => e.stopPropagation()}>
                    {stage.key === 'under-review' && <input type="checkbox" aria-label={`Select ${person?.name}`} checked={selected.has(p.id)} onChange={() => toggleRow(p.id)} />}
                  </td>
                  <td className="td2 pr-sticky pr-sticky-2">
                    <Link to={`/people/${p.personId}`} onClick={(e) => e.stopPropagation()} className="pr-emp">
                      <span className="avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>{person ? avatarContent(person) : '?'}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="pr-emp-name">{person?.name ?? 'Unknown'}</span>
                        <span className="pr-emp-sub">{person?.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="td2">{p.cycle}</td>
                  {groups.has('leave') && (
                    <>
                      <td className="td2 mono g-leave">{p.workingDays ?? '—'}{p.holidays ? <span className="pr-muted"> (−{p.holidays} hol)</span> : null}</td>
                      <td className="td2 mono g-leave">{p.ptoHours ?? 0}</td>
                      <td className="td2 mono g-leave">{p.unpaidHours ?? 0}</td>
                      <td className="td2 mono g-leave">{f.payoutPct}%</td>
                    </>
                  )}
                  {groups.has('timesheet') && (
                    <>
                      <td className="td2 mono g-time">{p.targetHours}</td>
                      <td className="td2 mono g-time">{f.allocatedHours ?? '—'}</td>
                      <td className="td2 mono g-time">{p.actualHours}</td>
                      <td className="td2 g-time"><span className={`pr-flag ${hs.tone}`}>{hs.label}</span> <span className="mono pr-muted">{signed(rec.hoursDiff)}h</span></td>
                    </>
                  )}
                  {!groups.has('timesheet') && <td className="td2" style={{ minWidth: 130 }}><HoursMeter p={p} compact /></td>}
                  {groups.has('invoice') && (
                    <>
                      <td className="td2 mono g-inv">{dollars(f.budgetSalary)}</td>
                      <td className="td2 mono g-inv">{dollars(f.salaryPayout)}</td>
                      <td className="td2 mono g-inv">{dollars(f.otherPayout)}</td>
                      <td className="td2 mono g-inv">{dollars(f.invoiceAmount)}</td>
                      <td className="td2 mono g-inv" style={{ color: f.invoiceDiff && Math.abs(f.invoiceDiff) > 0.01 ? 'var(--warn-fg)' : undefined }}>{f.invoiceDiff === null ? '—' : money(f.invoiceDiff)}</td>
                      <td className="td2 g-inv pr-muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.notes || '—'}</td>
                    </>
                  )}
                  <td className="td2 mono" style={{ fontWeight: 600 }}>{money(f.totalPayout)}</td>
                  <td className="td2"><StageChip stage={stage} overdue={overdue} small /></td>
                  <td className="td2" style={{ width: 24 }}><ChevronRightIcon size={14} color="var(--color-text-tertiary)" /></td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={20}>
                  <EmptyState compact keep={['tab', 'cols']} title={tab === 'submitted' ? 'No submitted reviews match' : 'Everyone here has submitted'} body={tab === 'submitted' ? undefined : 'Nobody in this view is still waiting to submit.'} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* cards (phone) */}
      <div className="pr-cards">
        {pageRows.map(({ p, stage, overdue, person }) => {
          const f = reviewFigures(p, assignments)
          return (
            <Link key={p.id} to={`/payroll/reviews/${p.id}`} className="card pr-card">
              <div className="pr-card-top">
                <span className="avatar" style={{ width: 38, height: 38, fontSize: 12, flexShrink: 0 }}>{person ? avatarContent(person) : '?'}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="pr-emp-name">{person?.name ?? 'Unknown'}</span>
                  <span className="pr-emp-sub">{p.cycle}</span>
                </span>
                <span className="mono pr-card-total">{money(f.totalPayout)}</span>
              </div>
              <HoursMeter p={p} />
              <div className="pr-card-bottom">
                <StageChip stage={stage} overdue={overdue} small />
                <ChevronRightIcon size={14} color="var(--color-text-tertiary)" />
              </div>
            </Link>
          )
        })}
        {pageRows.length === 0 && <EmptyState keep={['tab', 'cols']} title="Nothing to show" />}
      </div>

      {pages > 1 && (
        <div className="pr-pager">
          <span className="pr-dash-sub">Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, shown.length)} of {shown.length}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn-outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </span>
        </div>
      )}
    </AppShell>
  )
}
