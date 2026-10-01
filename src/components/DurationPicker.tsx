import { formatMinutes } from '../data/timeEntries'

export default function DurationPicker({
  options,
  selectedMinutes,
  onSelect,
}: {
  options: number[]
  selectedMinutes: number
  onSelect: (minutes: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((mins) => (
        <button
          key={mins}
          type="button"
          className={`duration-pill ${selectedMinutes === mins ? 'active' : ''}`}
          onClick={() => onSelect(mins)}
        >
          {formatMinutes(mins)}
        </button>
      ))}
    </div>
  )
}
