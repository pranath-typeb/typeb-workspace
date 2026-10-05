import { useState } from 'react'
import SearchableSelect from './SearchableSelect'
import TagGlyph from './TagGlyph'
import { DollarSignIcon, TagIcon } from './icons'
import { recentCategoryNames } from '../data/timeEntries'
import { useTagNames } from '../data/tags'

function useTagOptions() {
  const names = useTagNames()
  return names.map((n) => ({ value: n, label: n, icon: <TagGlyph name={n} size={16} /> }))
}

// Tag icon → the searchable list, with an icon on every tag. Once a tag is chosen the button turns
// green and shows that tag's own icon (the "tag added" cue). `defaultValue` is the tag the form starts
// with — until something else is picked the button stays the plain dark tag.
export function CategoryTagButton({ value, onChange, size, defaultValue }: { value: string; onChange: (c: string) => void; size?: number; defaultValue?: string }) {
  const options = useTagOptions()
  const [picked, setPicked] = useState(false)
  const isSet = picked || (defaultValue === undefined ? true : value !== defaultValue)
  return (
    <SearchableSelect
      value={value}
      onChange={(v) => {
        setPicked(true)
        onChange(v)
      }}
      options={options}
      ariaLabel="Tag"
      title={isSet ? `Tag: ${value}` : 'Add a tag'}
      recentKey="category"
      recentFrom={recentCategoryNames}
      allLabel="All tags"
      iconClassName={isSet ? 'ep-icon-btn tagged' : 'ep-icon-btn dark'}
      iconTrigger={isSet ? <TagGlyph name={value} size={16} color="#fff" /> : <TagIcon size={16} color="var(--color-text-inverse)" />}
      iconSize={size}
    />
  )
}

// Full-width version for forms that show the tag as a field.
export function CategorySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const options = useTagOptions()
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel="Tag"
      recentKey="category"
      recentFrom={recentCategoryNames}
      allLabel="All tags"
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
  defaultCategory,
}: {
  category: string
  onCategory: (c: string) => void
  billable: boolean
  onBillable: (b: boolean) => void
  defaultCategory?: string
}) {
  return (
    <div className="ep-tags">
      <CategoryTagButton value={category} onChange={onCategory} defaultValue={defaultCategory} />
      <BillableButton value={billable} onChange={onBillable} />
      <span className="ep-tags-label">
        <b>{category}</b> · {billable ? 'Billable' : 'Non-billable'}
      </span>
    </div>
  )
}
