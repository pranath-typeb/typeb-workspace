import { useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'
import PayrollSidebar from '../../components/PayrollSidebar'
import { PayrollFileIcon } from '../../components/icons'
import { people } from '../../data/people'
import { usePayrollPeriods } from '../../data/payroll'

const cycles = [
  'Dec 25 – Jan 24',
  'Nov 25 – Dec 24',
  'Oct 25 – Nov 24',
  'Sep 25 – Oct 24',
  'Aug 25 – Sep 24',
  'Jul 25 – Aug 24',
  'Jun 25 – Jul 24',
  'May 25 – Jun 24',
]

export default function Dashboard() {
  const periods = usePayrollPeriods()
  const [selectedCycle, setSelectedCycle] = useState('Aug 25 – Sep 24')

  const cyclePeriods = periods.filter((p) => p.cycle === selectedCycle)
  const totalGross = cyclePeriods.reduce((sum, p) => sum + p.grossPay, 0)
  const submitted = cyclePeriods.filter((p) => p.status !== 'Timesheet pending').length
  const pending = cyclePeriods.filter((p) => p.status === 'Timesheet pending').length
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

  return (
    <AppShell appIcon={<PayrollFileIcon size={16} color="rgba(0,0,0,0.53)" />} appLabel="Payroll" appHref="/payroll" sidebar={<PayrollSidebar active="dashboard" />}>
      <div className="page-title">Dashboard</div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ width: 220, flexShrink: 0, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, padding: '6px 10px 10px' }}>2026</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cycles.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCycle(c)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: c === selectedCycle ? 700 : 500,
                  background: c === selectedCycle ? '#cce3e2' : 'transparent',
                  textAlign: 'left',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>{selectedCycle}</div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Stat label="Total gross pay" value={`$${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${cyclePeriods.length} employees`} />
            <Stat label="Submitted" value={String(submitted)} sub={`of ${cyclePeriods.length} reviews`} />
            <Stat label="Pending timesheets" value={String(pending)} sub="not yet submitted" />
            <Stat label="Approved / Paid out" value={String(approved)} sub={`${cyclePeriods.filter((p) => p.status === 'Paid out').length} paid out`} />
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Headcount by jurisdiction</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>
              Who's on payroll in each jurisdiction this cycle.
            </div>
            {byJurisdiction.map((j) => (
              <div key={j.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderTop: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, width: 140 }}>{j.name}</span>
                  <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>{j.count} {j.count === 1 ? 'employee' : 'employees'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat" style={{ flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}
