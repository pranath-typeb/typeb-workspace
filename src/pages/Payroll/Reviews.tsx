import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { PayrollFileIcon, ChevronRightIcon } from '../../components/icons'
import { avatarContent } from '../../components/Avatar'
import { personById } from '../../data/people'
import { bulkApprove, statusBadgeClass, usePayrollPeriods, type PayrollStatus } from '../../data/payroll'

const STATUSES: PayrollStatus[] = ['Timesheet pending', 'Under review', 'Update needed', 'Approved', 'Paid out']

function cycleSortKey(label: string): number {
  const d = new Date(`1 ${label}`)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export default function Reviews() {
  const periods = usePayrollPeriods()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const cycles = useMemo(() => {
    const map = new Map<string, string>()
    periods.forEach((p) => {
      if (!map.has(p.cycle)) map.set(p.cycle, p.label)
    })
    return Array.from(map.entries())
      .map(([cycle, label]) => ({ cycle, label }))
      .sort((a, b) => cycleSortKey(b.label) - cycleSortKey(a.label))
  }, [periods])

  const cycle = params.get('cycle') ?? cycles[0]?.cycle ?? ''
  const status = (params.get('status') as PayrollStatus | null) ?? 'All'
  const activeCycleLabel = cycles.find((c) => c.cycle === cycle)?.label

  const cyclePeriods = useMemo(() => periods.filter((p) => p.cycle === cycle), [periods, cycle])

  const counts = useMemo(() => {
    const map = new Map<PayrollStatus, number>()
    cyclePeriods.forEach((p) => map.set(p.status, (map.get(p.status) ?? 0) + 1))
    return map
  }, [cyclePeriods])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cyclePeriods.filter((p) => {
      const person = personById(p.personId)
      const matchesQuery = !q || (person?.name.toLowerCase().includes(q) ?? false)
      const matchesStatus = status === 'All' || p.status === status
      return matchesQuery && matchesStatus
    })
  }, [cyclePeriods, query, status])

  function setCycle(next: string) {
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('cycle', next)
      return p
    })
    setSelected(new Set())
  }

  function setStatusFilter(next: 'All' | PayrollStatus) {
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      if (next === 'All') p.delete('status')
      else p.set('status', next)
      return p
    })
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))))
  }

  function approveSelected() {
    bulkApprove([...selected])
    setSelected(new Set())
  }

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="reviews" />}>
      <div className="page-title">Payroll Reviews</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="input" style={{ width: 220 }} value={cycle} onChange={(e) => setCycle(e.target.value)}>
            {cycles.map((c) => (
              <option key={c.cycle} value={c.cycle}>{c.label} · {c.cycle}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{cyclePeriods.length} {cyclePeriods.length === 1 ? 'employee' : 'employees'}</span>
        </div>
        <input className="input" style={{ width: 220 }} placeholder="Search employees…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatusPill label="All" count={cyclePeriods.length} active={status === 'All'} onClick={() => setStatusFilter('All')} />
        {STATUSES.map((s) => (
          <StatusPill key={s} label={s} count={counts.get(s) ?? 0} active={status === s} onClick={() => setStatusFilter(s)} />
        ))}
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-background-subtle)', border: '1px solid var(--color-border-default)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <button className="btn-dark" onClick={approveSelected}>Approve selected</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2" style={{ width: 36 }}>
                <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} />
              </th>
              <th className="th2">Employee</th>
              <th className="th2">Gross</th>
              <th className="th2">Hours (actual / target)</th>
              <th className="th2">Status</th>
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const person = personById(p.personId)
              const behind = p.actualHours < p.targetHours
              return (
                <tr key={p.id} className="row-hover" style={{ cursor: 'pointer' }} onClick={() => navigate(`/payroll/reviews/${p.id}`)}>
                  <td className="td2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleRow(p.id)} />
                  </td>
                  <td className="td2">
                    <Link to={`/people/${p.personId}`} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{person ? avatarContent(person) : '—'}</div>
                      <span style={{ fontWeight: 600 }}>{person?.name ?? 'Unknown'}</span>
                    </Link>
                  </td>
                  <td className="td2 mono">${p.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="td2 mono">
                    <span style={{ color: behind ? '#cc3a00' : undefined }}>{p.actualHours} / {p.targetHours}</span>
                  </td>
                  <td className="td2"><span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
                  <td className="td2" style={{ width: 24 }}>
                    <ChevronRightIcon size={14} color="var(--color-text-tertiary)" />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td2" colSpan={6} style={{ color: 'var(--color-text-tertiary)' }}>
                  No reviews match those filters{activeCycleLabel ? ` for ${activeCycleLabel}` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}

function StatusPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        border: '1px solid var(--color-border-subtle)',
        background: active ? 'var(--color-background-inverse)' : 'var(--color-background-page)',
        color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
      <span
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 9999,
          background: active ? 'rgba(255,255,255,0.2)' : 'var(--color-border-default)',
          color: active ? 'inherit' : 'var(--color-text-primary)',
        }}
      >
        {count}
      </span>
    </button>
  )
}
