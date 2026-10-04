import SearchableSelect from './SearchableSelect'
import { DollarSignIcon, TagIcon } from './icons'
import { CATEGORIES, recentCategoryNames } from '../data/timeEntries'

// Category + billable as two compact icon buttons (same as the timer card): the tag opens the category
// list, the $ toggles billable. A one-line summary beside them says what's currently set.
// Tag icon → the same searchable list as every other dropdown.
export function CategoryTagButton({ value, onChange, size }: { value: string; onChange: (c: string) => void; size?: number }) {
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={CATEGORIES.map((c) => ({ value: c, label: c }))}
      ariaLabel="Category"
      title={`Category: ${value}`}
      recentKey="category"
      recentFrom={recentCategoryNames}
      allLabel="All categories"
      iconTrigger={<TagIcon size={16} color="var(--color-text-inverse)" />}
      iconSize={size}
    />
  )
}

// $ icon → Billable / Non-billable in the same dropdown panel (teal when billable).
export function BillableButton({ value, onChange, size }: { value: boolean; onChange: (b: boolean) => void; size?: number }) {
  return (
    <SearchableSelect
      value={value ? 'yes' : 'no'}
      onChange={(v) => onChange(v === 'yes')}
      options={[
        { value: 'yes', label: 'Billable' },
        { value: 'no', label: 'Non-billable' },
      ]}
      ariaLabel="Billable"
      title={value ? 'Billable' : 'Non-billable'}
      iconClassName={`ep-icon-btn bill${value ? ' on' : ''}`}
      iconSize={size}
      iconTrigger={<DollarSignIcon size={16} color={value ? '#ebebeb' : 'var(--color-text-secondary)'} />}
    />
  )
}

export default function EntryTags({
  category,
  onCategory,
  billable,
  onBillable,
}: {
  category: string
  onCategory: (c: string) => void
  billable: boolean
  onBillable: (b: boolean) => void
}) {
  return (
    <div className="ep-tags">
      <CategoryTagButton value={category} onChange={onCategory} />
      <BillableButton value={billable} onChange={onBillable} />
      <span className="ep-tags-label">
        <b>{category}</b> · {billable ? 'Billable' : 'Non-billable'}
      </span>
    </div>
  )
}
