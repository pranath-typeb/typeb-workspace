import { useState } from 'react'
import { addProject, type BillingType, type ProjectStatus } from '../data/projects'
import { CloseIcon } from './icons'

interface CreateProjectModalProps {
  onClose: () => void
  onCreated: (id: string) => void
  initialClient?: string
}

const billingTypes: BillingType[] = ['Fixed bid', 'Time & materials', 'Retainer']
const statuses: ProjectStatus[] = ['Active', 'On Track', 'Completed']

export default function CreateProjectModal({ onClose, onCreated, initialClient }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [client, setClient] = useState(initialClient ?? '')
  const [status, setStatus] = useState<ProjectStatus>('Active')
  const [billing, setBilling] = useState<BillingType>('Fixed bid')
  const [billable, setBillable] = useState(true)
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')

  const canSubmit = name.trim().length > 0 && client.trim().length > 0 && starts.length > 0 && ends.length > 0

  function submit() {
    if (!canSubmit) return
    const project = addProject({
      name: name.trim(),
      client: client.trim(),
      status,
      billing,
      billable,
      staffing: false,
      starts,
      ends,
      managerId: null,
      teamIds: [],
    })
    onCreated(project.id)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Create Project</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="rgba(0,0,0,0.53)" />
          </button>
        </div>

        <div>
          <div className="field-label">Project name *</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Client *</div>
            <input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Billing *</div>
            <select className="input" value={billing} onChange={(e) => setBilling(e.target.value as BillingType)}>
              {billingTypes.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Status *</div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} id="billable-check" />
            <label htmlFor="billable-check" style={{ fontSize: 14 }}>Billable</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Start date *</div>
            <input className="input" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">End date *</div>
            <input className="input" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!canSubmit} onClick={submit}>Create Project</button>
        </div>
      </div>
    </div>
  )
}
