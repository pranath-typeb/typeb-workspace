import { useState } from 'react'
import DatePicker from './DatePicker'
import { addLeaveRequest, updateLeaveRequest, type LeaveRequest, type LeaveType } from '../data/leave'
import { CloseIcon } from './icons'
import { Select } from './SearchableSelect'

interface RequestLeaveModalProps {
  onClose: () => void
  requestedBy: string
  defaultType?: LeaveType
  editing?: LeaveRequest
}

const leaveTypes: LeaveType[] = ['PTO', 'Sick Leave', 'Unpaid Time Off', 'Accrued Public Holiday', 'LIEU']

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

// Reverses formatDate's "14-Sep-2026" back into an <input type="date"> value, so editing
// an existing request pre-fills the date picker instead of leaving it empty.
function toInputDate(display: string): string {
  const d = new Date(display.replace(/-/g, ' '))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function RequestLeaveModal({ onClose, requestedBy, defaultType = 'PTO', editing }: RequestLeaveModalProps) {
  const [type, setType] = useState<LeaveType>(editing?.type ?? defaultType)
  const [date, setDate] = useState(editing ? toInputDate(editing.date) : '')
  const [days, setDays] = useState(editing?.days ?? 1)

  const canSubmit = date.length > 0 && days > 0

  function submit() {
    if (!canSubmit) return
    if (editing) {
      updateLeaveRequest(editing.id, { type, date: formatDate(date), days })
    } else {
      addLeaveRequest({ type, date: formatDate(date), requestedBy, days })
    }
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>{editing ? 'Edit leave request' : 'Request leave'}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>

        <div>
          <div className="field-label">Type</div>
          <Select className="input" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {leaveTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Date</div>
            <DatePicker value={date} onChange={setDate} />
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
          <button className="btn-dark" disabled={!canSubmit} onClick={submit}>{editing ? 'Save changes' : 'Submit request'}</button>
        </div>
      </div>
    </div>
  )
}
