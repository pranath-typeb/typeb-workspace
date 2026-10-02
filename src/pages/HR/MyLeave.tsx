import { useState } from 'react'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel, NavSep } from '../../components/NavItem'
import { ClockIcon, GridIcon, LetterIcon, PolicyIcon, BenefitsIcon, EyeIcon, EditIcon, TrashIcon, CloseIcon } from '../../components/icons'
import RequestLeaveModal from '../../components/RequestLeaveModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useLeaveRequests, deleteLeaveRequest, PTO_TOTAL_ACCRUED, PTO_TOTAL_USED, LIEU_GRANTED, LEAVE_CYCLE, type LeaveRequest, type LeaveStatus } from '../../data/leave'
import { CURRENT_USER_ID, personById } from '../../data/people'

const statusBadge: Record<LeaveStatus, string> = {
  Approved: 'b-pine',
  Pending: 'b-ember',
  Rejected: 'b-danger',
}

export default function MyLeave() {
  const me = personById(CURRENT_USER_ID)!
  const [modalType, setModalType] = useState<'PTO' | 'LIEU' | null>(null)
  const [editing, setEditing] = useState<LeaveRequest | null>(null)
  const [viewing, setViewing] = useState<LeaveRequest | null>(null)
  const [deleting, setDeleting] = useState<LeaveRequest | null>(null)
  const requests = useLeaveRequests()

  const pendingDays = requests.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + r.days, 0)
  const availablePto = Math.max(PTO_TOTAL_ACCRUED - PTO_TOTAL_USED - pendingDays, 0)

  return (
    <AppShell
      appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="HR"
      appHref="/hr/leave"
      sidebar={
        <>
          <NavItem to="/hr/overview" icon={<GridIcon />} label="Overview" />
          <NavSep />
          <NavGroupLabel label="Me" />
          <NavItem to="/hr/leave" icon={<ClockIcon color="var(--color-text-inverse)" />} label="My Leave" active />
          <NavItem to="/hr/letters" icon={<LetterIcon />} label="My Letters" />
          <NavItem to="/hr/policies" icon={<PolicyIcon />} label="Policies" />
          <NavItem to="/hr/benefits" icon={<BenefitsIcon />} label="Benefits" />
        </>
      }
    >
      <div className="page-title">My Leave</div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Leave Cycle</div>
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
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const isMine = r.requestedBy === me.name
              return (
                <tr key={r.id}>
                  <td className="td2">{r.type}</td>
                  <td className="td2">{r.date}</td>
                  <td className="td2"><span className={`badge ${statusBadge[r.status]}`}>{r.status}</span></td>
                  <td className="td2">{r.requestedBy}</td>
                  <td className="td2">
                    <div className="row-actions">
                      <button className="row-action-btn" onClick={() => setViewing(r)} aria-label="View" title="View">
                        <EyeIcon size={14} color="var(--color-text-secondary)" />
                      </button>
                      {isMine && r.status === 'Pending' && (
                        <>
                          <button className="row-action-btn" onClick={() => setEditing(r)} aria-label="Edit" title="Edit">
                            <EditIcon size={14} color="var(--color-text-secondary)" />
                          </button>
                          <button className="row-action-btn" onClick={() => setDeleting(r)} aria-label="Delete" title="Delete">
                            <TrashIcon size={14} color="var(--color-status-danger)" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalType && (
        <RequestLeaveModal
          requestedBy={me.name}
          defaultType={modalType}
          onClose={() => setModalType(null)}
        />
      )}

      {editing && (
        <RequestLeaveModal
          requestedBy={me.name}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="serif" style={{ fontSize: 19, letterSpacing: '-0.5px' }}>Leave request</div>
              <button onClick={() => setViewing(null)} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloseIcon color="var(--color-text-secondary)" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ViewField label="Type" value={viewing.type} />
              <ViewField label="Date" value={viewing.date} />
              <ViewField label="Days" value={String(viewing.days)} />
              <ViewField label="Requested by" value={viewing.requestedBy} />
              <div>
                <div className="field-label">Status</div>
                <span className={`badge ${statusBadge[viewing.status]}`}>{viewing.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete leave request?"
          message={`This will permanently remove the ${deleting.type} request for ${deleting.date}.`}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteLeaveRequest(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </AppShell>
  )
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div className="stat">
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-1px' }}>{value}</div>
      </div>
    </div>
  )
}
