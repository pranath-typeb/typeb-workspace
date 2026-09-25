import { useState } from 'react'
import { addAssignment } from '../data/staffing'
import { useProjects } from '../data/projects'
import type { Person } from '../data/people'
import { todayLocal } from '../data/timeEntries'
import { CloseIcon } from './icons'

interface CommitHoursModalProps {
  person: Person
  onClose: () => void
}

export default function CommitHoursModal({ person, onClose }: CommitHoursModalProps) {
  const projects = useProjects()
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [hoursPerWeek, setHoursPerWeek] = useState(10)
  const [startDate, setStartDate] = useState(() => todayLocal())
  const [openEnded, setOpenEnded] = useState(true)
  const [note, setNote] = useState('')

  const canSubmit = projectId.length > 0 && hoursPerWeek > 0 && startDate.length > 0

  function submit() {
    if (!canSubmit) return
    addAssignment({
      personId: person.id,
      projectId,
      hoursPerWeek,
      startDate,
      openEnded,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>Commit hours</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>{person.name}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="rgba(0,0,0,0.53)" />
          </button>
        </div>

        <div>
          <div className="field-label">Project *</div>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Hours per week *</div>
            <input className="input" type="number" min={1} max={60} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Starts *</div>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="open-ended" checked={openEnded} onChange={(e) => setOpenEnded(e.target.checked)} />
          <label htmlFor="open-ended" style={{ fontSize: 14 }}>Open-ended</label>
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>No end date — continues until closed.</span>
        </div>

        <div>
          <div className="field-label">Note</div>
          <textarea
            className="input"
            style={{ height: 64, alignItems: 'flex-start', paddingTop: 10, resize: 'vertical' }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!canSubmit} onClick={submit}>Commit hours</button>
        </div>
      </div>
    </div>
  )
}
