import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { PayrollFileIcon } from '../../components/icons'
import { people } from '../../data/people'
import { usePayrollPeriods } from '../../data/payroll'

function cycleSortKey(label: string): number {
  const d = new Date(`1 ${label}`)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const periods = usePayrollPeriods()

  const cycles = useMemo(() => {
    const map = new Map<string, string>()
    periods.forEach((p) => {
      if (!map.has(p.cycle)) map.set(p.cycle, p.label)
    })
    return Array.from(map.entries())
      .map(([cycle, label]) => ({ cycle, label }))
      .sort((a, b) => cycleSortKey(b.label) - cycleSortKey(a.label))
  }, [periods])

  const [selectedCycle, setSelectedCycle] = useState(() => cycles[0]?.cycle ?? '')
  const activeCycle = cycles.find((c) => c.cycle === selectedCycle) ?? cycles[0]

  const cyclePeriods = periods.filter((p) => p.cycle === (activeCycle?.cycle ?? selectedCycle))
  const totalGross = cyclePeriods.reduce((sum, p) => sum + p.grossPay, 0)
  const pending = cyclePeriods.filter((p) => p.status === 'Timesheet pending').length
  const needsAttention = cyclePeriods.filter((p) => p.status === 'Under review' || p.status === 'Update needed').length
  const approved = cyclePeriods.filter((p) => p.status === 'Approved' || p.status === 'Paid out').length

  const byJurisdiction = useMemo(() => {
    const map = new Map<string, number>()
    people.forEach((p) => {
      const key = p.jurisdiction ?? 'No jurisdiction'
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [])

  function goToReviews(status?: string) {
    const params = new URLSearchParams()
    if (activeCycle) params.set('cycle', activeCycle.cycle)
    if (status) params.set('status', status)
    navigate(`/payroll/reviews?${params.toString()}`)
  }

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="var(--color-text-secondary)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="dashboard" />}>
      <div className="page-title">Dashboard</div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ width: 220, flexShrink: 0, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, padding: '6px 10px 10px' }}>Pay cycles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cycles.map((c) => (
              <button
                key={c.cycle}
                onClick={() => setSelectedCycle(c.cycle)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: c.cycle === selectedCycle ? 700 : 500,
                  background: c.cycle === selectedCycle ? '#cce3e2' : 'transparent',
                  color: c.cycle === selectedCycle ? '#004543' : undefined,
                  textAlign: 'left',
                }}
              >
                {c.label}
                <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{c.cycle}</span>
              </button>
            ))}
            {cycles.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', padding: '8px 10px' }}>No pay cycles yet.</div>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>{activeCycle?.label ?? 'No data'}</div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Stat label="Total gross pay" value={`$${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${cyclePeriods.length} employees`} onClick={() => goToReviews()} />
            <Stat label="Needs attention" value={String(needsAttention)} sub="under review or flagged" onClick={() => goToReviews()} accent={needsAttention > 0 ? '#cc3a00' : undefined} />
            <Stat label="Pending timesheets" value={String(pending)} sub="not yet submitted" onClick={() => goToReviews('Timesheet pending')} />
            <Stat label="Approved / Paid out" value={String(approved)} sub={`${cyclePeriods.filter((p) => p.status === 'Paid out').length} paid out`} onClick={() => goToReviews('Approved')} />
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Headcount by jurisdiction</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Who's on payroll in each jurisdiction, company-wide.
            </div>
            {byJurisdiction.map((j) => (
              <div key={j.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderTop: '1px solid var(--table-row-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, width: 140 }}>{j.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{j.count} {j.count === 1 ? 'employee' : 'employees'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Stat({ label, value, sub, onClick, accent }: { label: string; value: string; sub: string; onClick?: () => void; accent?: string }) {
  return (
    <button className="stat" style={{ flex: 1, minWidth: 160, textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: accent }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>
    </button>
  )
}
