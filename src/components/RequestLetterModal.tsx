import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addLetterRequest, LETTER_TYPES, type LetterType } from '../data/letters'
import { usePayrollPeriods } from '../data/payroll'
import { showToast } from '../data/toast'
import { CloseIcon } from './icons'
import { Select } from './SearchableSelect'

interface RequestLetterModalProps {
  onClose: () => void
  requestedBy: string // personId
  defaultType?: LetterType
}

export default function RequestLetterModal({ onClose, requestedBy, defaultType = 'Service Letter' }: RequestLetterModalProps) {
  const navigate = useNavigate()
  const periods = usePayrollPeriods()
  const [type, setType] = useState<LetterType>(defaultType)
  const [addressedTo, setAddressedTo] = useState('')
  const [purpose, setPurpose] = useState('')

  const isPayslip = type === 'Pay-slip Letter'
  const needsAddressee = type === 'Visa Officer Letter'
  const canSubmit = isPayslip || (purpose.trim().length > 0 && (!needsAddressee || addressedTo.trim().length > 0))

  function submit() {
    if (!canSubmit) return

    if (isPayslip) {
      const latest = periods
        .filter((p) => p.personId === requestedBy && p.payDate)
        .sort((a, b) => (b.payDate ?? '').localeCompare(a.payDate ?? ''))[0]
      onClose()
      if (latest) navigate(`/payroll/payslip/${latest.id}`)
      else showToast("No payslip is available yet", 'info')
      return
    }

    const request = addLetterRequest({
      type,
      requestedBy,
      purpose: purpose.trim(),
      addressedTo: needsAddressee ? addressedTo.trim() : undefined,
    })
    onClose()
    navigate(`/hr/letters/${request.id}`)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Request a letter</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>

        <div>
          <div className="field-label">Letter type</div>
          <Select className="input" value={type} onChange={(e) => setType(e.target.value as LetterType)}>
            {LETTER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>

        {isPayslip ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>This opens your most recent payslip, ready to download as a PDF.</div>
        ) : (
          <>
            {needsAddressee && (
              <div>
                <div className="field-label">Addressed to</div>
                <input className="input" placeholder="e.g. Embassy of Canada, Visa Officer" value={addressedTo} onChange={(e) => setAddressedTo(e.target.value)} />
              </div>
            )}

            <div>
              <div className="field-label">Purpose</div>
              <input className="input" placeholder="e.g. Bank loan application" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!canSubmit} onClick={submit}>{isPayslip ? 'Open payslip' : 'Generate letter'}</button>
        </div>
      </div>
    </div>
  )
}
