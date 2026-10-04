import { useState } from 'react'
import DurationPicker from './DurationPicker'
import SearchableSelect, { Select } from './SearchableSelect'
import TimeInput from './TimeInput'
import { CircleArrowRightIcon, CloseIcon } from './icons'
import { CURRENT_USER_ID } from '../data/people'
import { useProjects } from '../data/projects'
import { addEntry, CATEGORIES, recentProjectIds, updateEntry, type TimeEntry } from '../data/timeEntries'

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240]

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

type EntryFields = Pick<TimeEntry, 'date' | 'description' | 'projectId' | 'category' | 'minutes' | 'startMinutes' | 'billable'>

interface AddTimeEntryModalProps {
  date: string // YYYY-MM-DD — initial date to prefill (the day the user clicked "Add" from)
  onClose: () => void
  editing?: TimeEntry
  // When set, save() calls this instead of writing to the real store — used to edit an
  // entry that's still staged locally (e.g. the Manual tab's not-yet-saved batch).
  onSave?: (fields: EntryFields) => void
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function AddTimeEntryModal({ date, onClose, editing, onSave }: AddTimeEntryModalProps) {
  const projects = useProjects()
  const [entryDate, setEntryDate] = useState(editing?.date ?? date)
  const [description, setDescription] = useState(editing?.description ?? '')
  const [projectId, setProjectId] = useState(editing?.projectId ?? '')
  const [category, setCategory] = useState(editing?.category ?? 'Manual')
  const [startTime, setStartTime] = useState(editing?.startMinutes !== undefined ? minutesToTime(editing.startMinutes) : '09:00')
  const [endTime, setEndTime] = useState(
    editing?.startMinutes !== undefined ? minutesToTime(editing.startMinutes + editing.minutes) : '10:00',
  )
  const [billable, setBillable] = useState(editing?.billable ?? true)

  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime)

  function applyDuration(mins: number) {
    setEndTime(minutesToTime(timeToMinutes(startTime) + mins))
  }

  function save() {
    if (!description.trim() || minutes <= 0) return
    const fields: EntryFields = {
      date: entryDate,
      description: description.trim(),
      projectId: projectId || null,
      category,
      minutes,
      startMinutes: timeToMinutes(startTime),
      billable,
    }
    if (onSave) {
      onSave(fields)
    } else if (editing) {
      updateEntry(editing.id, fields)
    } else {
      addEntry({ personId: CURRENT_USER_ID, ...fields })
    }
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>{editing ? 'Edit time entry' : 'Add time entry'}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{formatDateLabel(entryDate)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>

        <div>
          <div className="field-label">Description</div>
          <input className="input" autoFocus placeholder="What did you work on?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <div className="field-label">Date</div>
          <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Project</div>
            <SearchableSelect
              recentKey="project"
              recentFrom={recentProjectIds}
              allLabel="All projects"
              value={projectId}
              onChange={setProjectId}
              placeholder="No project"
              options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Category</div>
            <Select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <TimeInput label="Start time" value={startTime} onChange={setStartTime} />
          <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
            <CircleArrowRightIcon size={16} color="var(--color-text-tertiary)" />
          </div>
          <TimeInput label="End time" value={endTime} onChange={setEndTime} />
        </div>

        <DurationPicker options={DURATION_OPTIONS} selectedMinutes={minutes} onSelect={applyDuration} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          Billable
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!description.trim() || minutes <= 0} onClick={save}>{editing ? 'Save changes' : 'Add entry'}</button>
        </div>
      </div>
    </div>
  )
}
