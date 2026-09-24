import { useState } from 'react'
import { addLeaveRequest, type LeaveType } from '../data/leave'
import { CloseIcon } from './icons'

interface RequestLeaveModalProps {
  onClose: () => void
  requestedBy: string
  defaultType?: LeaveType
}

const leaveTypes: LeaveType[] = ['PTO', 'Sick Leave', 'Unpaid Time Off', 'Accrued Public Holiday', 'LIEU']

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

export default function RequestLeaveModal({ onClose, requestedBy, defaultType = 'PTO' }: RequestLeaveModalProps) {
  const [type, setType] = useState<LeaveType>(defaultType)
  const [date, setDate] = useState('')
  const [days, setDays] = useState(1)

  const canSubmit = date.length > 0 && days > 0

  function submit() {
    if (!canSubmit) return
    addLeaveRequest({ type, date: formatDate(date), requestedBy, days })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Request leave</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="rgba(0,0,0,0.53)" />
          </button>
        </div>

        <div>
          <div className="field-label">Type</div>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {leaveTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Date</div>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ width: 100 }}>
            <div className="field-label">Days</div>
            <input
              className="input"
              type="number"
              min={0.5}
              step={0.5}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!canSubmit} onClick={submit}>Submit request</button>
        </div>
      </div>
    </div>
  )
}
