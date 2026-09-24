import { useState } from 'react'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel, NavSep } from '../../components/NavItem'
import { ClockIcon, GridIcon, LetterIcon, PolicyIcon, BenefitsIcon } from '../../components/icons'
import RequestLeaveModal from '../../components/RequestLeaveModal'
import { useLeaveRequests, PTO_TOTAL_ACCRUED, PTO_TOTAL_USED, LIEU_GRANTED, LEAVE_CYCLE, type LeaveStatus } from '../../data/leave'

const statusBadge: Record<LeaveStatus, string> = {
  Approved: 'b-pine',
  Pending: 'b-ember',
  Rejected: 'b-danger',
}

export default function MyLeave() {
  const [modalType, setModalType] = useState<'PTO' | 'LIEU' | null>(null)
  const requests = useLeaveRequests()

  const pendingDays = requests.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + r.days, 0)
  const availablePto = Math.max(PTO_TOTAL_ACCRUED - PTO_TOTAL_USED - pendingDays, 0)

  return (
    <AppShell
      appIcon={<ClockIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="HR"
      appHref="/hr/leave"
      sidebar={
        <>
          <NavItem to="/hr/overview" icon={<GridIcon />} label="Overview" />
          <NavSep />
          <NavGroupLabel label="Me" />
          <NavItem to="/hr/leave" icon={<ClockIcon color="#fafafa" />} label="My Leave" active />
          <NavItem to="/hr/letters" icon={<LetterIcon />} label="My Letters" />
          <NavItem to="/hr/policies" icon={<PolicyIcon />} label="Policies" />
          <NavItem to="/hr/benefits" icon={<BenefitsIcon />} label="Benefits" />
        </>
      }
    >
      <div className="page-title">My Leave</div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>Leave Cycle</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{LEAVE_CYCLE}</div>
        </div>
        <span className="badge b-pine">Active</span>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-outline" onClick={() => setModalType('LIEU')}>Request LIEU</button>
        <button className="btn-dark" onClick={() => setModalType('PTO')}>Request Leave</button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Stat label="Available PTO" value={`${availablePto.toFixed(1)}d`} />
        <Stat label="Granted LIEU" value={`${LIEU_GRANTED}d`} />
        <Stat label="Taken" value={`${PTO_TOTAL_USED}d`} />
        <Stat label="Pending" value={`${pendingDays}d`} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2">Type</th>
              <th className="th2">Date</th>
              <th className="th2">Status</th>
              <th className="th2">Requested by</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="td2">{r.type}</td>
                <td className="td2">{r.date}</td>
                <td className="td2"><span className={`badge ${statusBadge[r.status]}`}>{r.status}</span></td>
                <td className="td2">{r.requestedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalType && (
        <RequestLeaveModal
          requestedBy="Pranath"
          defaultType={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div className="stat">
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>{label}</div>
        <div className="serif" style={{ fontSize: 28, letterSpacing: '-1px' }}>{value}</div>
      </div>
    </div>
  )
}
