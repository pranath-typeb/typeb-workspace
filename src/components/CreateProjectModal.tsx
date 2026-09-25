import { useState } from 'react'
import { addProject, type BillingType, type ProjectStatus } from '../data/projects'
import { people } from '../data/people'
import { CloseIcon } from './icons'

interface CreateProjectModalProps {
  onClose: () => void
  onCreated: (id: string) => void
  initialClient?: string
  existingClients?: string[]
}

const billingTypes: BillingType[] = ['Fixed bid', 'Time & materials', 'Retainer']
const statuses: ProjectStatus[] = ['Active', 'On Track', 'Completed']

export default function CreateProjectModal({ onClose, onCreated, initialClient, existingClients = [] }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [client, setClient] = useState(initialClient ?? '')
  const [status, setStatus] = useState<ProjectStatus>('Active')
  const [billing, setBilling] = useState<BillingType>('Fixed bid')
  const [billable, setBillable] = useState(true)
  const [staffing, setStaffing] = useState(false)
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [managerId, setManagerId] = useState('')
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')

  const canSubmit = name.trim().length > 0 && client.trim().length > 0 && starts.length > 0 && ends.length > 0

  function toggleTeamMember(id: string) {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function addKeyword() {
    const kw = keywordDraft.trim().replace(/^\[|\]$/g, '')
    if (!kw || keywords.includes(kw)) {
      setKeywordDraft('')
      return
    }
    setKeywords((prev) => [...prev, kw])
    setKeywordDraft('')
  }

  function submit() {
    if (!canSubmit) return
    const project = addProject({
      name: name.trim(),
      client: client.trim(),
      status,
      billing,
      billable,
      staffing,
      starts,
      ends,
      managerId: managerId || null,
      teamIds,
      calendarKeywords: keywords,
    })
    onCreated(project.id)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxHeight: 'calc(100vh - 64px)', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
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
            <input className="input" list="client-suggestions" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Select or type a client" />
            <datalist id="client-suggestions">
              {existingClients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Project type *</div>
            <select className="input" value={billing} onChange={(e) => setBilling(e.target.value as BillingType)}>
              {billingTypes.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Project status *</div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 36, marginTop: 20, cursor: 'pointer' }}>
            <span
              onClick={() => setBillable((v) => !v)}
              style={{ width: 32, height: 18, borderRadius: 9999, background: billable ? '#171717' : '#e5e5e5', position: 'relative', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 2, left: billable ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Billable</span>
          </label>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 36, marginTop: 20, cursor: 'pointer' }}>
            <span
              onClick={() => setStaffing((v) => !v)}
              style={{ width: 32, height: 18, borderRadius: 9999, background: staffing ? '#171717' : '#e5e5e5', position: 'relative', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 2, left: staffing ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Staffing</span>
          </label>
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

        <div>
          <div className="field-label">Project manager</div>
          <select className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">No manager assigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="field-label">Team members</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: 10 }}>
            {people.map((p) => (
              <label
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 9999,
                  background: teamIds.includes(p.id) ? '#171717' : '#f5f5f5',
                  color: teamIds.includes(p.id) ? '#fff' : '#404040',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={teamIds.includes(p.id)} onChange={() => toggleTeamMember(p.id)} style={{ display: 'none' }} />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="field-label">Calendar keywords</div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 8 }}>Tag a calendar event's title with [keyword] to auto-select this project when logging time.</div>
          <input
            className="input"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addKeyword()
              }
            }}
            placeholder="Add a keyword and press Enter"
          />
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {keywords.map((kw) => (
                <span key={kw} className="tag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  [{kw}]
                  <button onClick={() => setKeywords((prev) => prev.filter((k) => k !== kw))} aria-label={`Remove ${kw}`} style={{ display: 'flex' }}>
                    <CloseIcon size={10} color="rgba(0,0,0,0.53)" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!canSubmit} onClick={submit}>Create Project</button>
        </div>
      </div>
    </div>
  )
}
