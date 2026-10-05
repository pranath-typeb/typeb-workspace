import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import SearchableSelect from './SearchableSelect'
import { ChevronDownIcon, CloseIcon, FilterIcon, SearchIcon, SortIcon } from './icons'

// One filter pattern for every list page (after ElevenLabs / Linear / Plain):
// desktop — a search box, then a dashed "+ Department" pill per filter that turns into a filled
// "Department: Engineering ×" chip once set, with "Clear all" when anything is active;
// phone — search plus a single "Filters" button (with a count) that opens a bottom sheet of grouped
// choices, and the active filters shown as removable chips under the search.

export interface FilterOption {
  value: string
  label: string
}

export interface FilterDef {
  key: string
  label: string
  options: FilterOption[]
  value: string
  // The value that means "not filtering" (e.g. 'All'); picking it or pressing × resets to it.
  defaultValue: string
  onChange: (value: string) => void
  // Always has a value (e.g. a pay cycle): shown as a chip with no × and no "Any" choice.
  required?: boolean
}

export interface ToggleDef {
  key: string
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

export interface SortDef {
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

const SHEET_PREVIEW = 8

const labelOf = (f: FilterDef) => f.options.find((o) => o.value === f.value)?.label ?? f.value

export default function FilterBar({
  search,
  filters = [],
  toggles = [],
  sort,
  count,
  trailing,
}: {
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  filters?: FilterDef[]
  toggles?: ToggleDef[]
  sort?: SortDef
  // Result summary shown at the end of the bar / on the sheet's button, e.g. "33 people".
  count?: string
  // Page actions that sit on the same row (e.g. "Create project", "Export").
  trailing?: ReactNode
}) {
  const phone = useIsPhone()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const active = filters.filter((f) => !f.required && f.value !== f.defaultValue)
  const fixed = filters.filter((f) => f.required)
  const activeToggles = toggles.filter((t) => t.value)
  const activeCount = active.length + activeToggles.length

  function clearAll() {
    filters.forEach((f) => !f.required && f.value !== f.defaultValue && f.onChange(f.defaultValue))
    toggles.forEach((t) => t.value && t.onChange(false))
  }

  const searchBox = search && (
    <div className="fb-search">
      <SearchIcon size={14} color="var(--color-text-tertiary)" />
      <input className="input" placeholder={search.placeholder} value={search.value} onChange={(e) => search.onChange(e.target.value)} aria-label="Search" />
      {search.value && (
        <button type="button" className="fb-search-clear" aria-label="Clear search" onClick={() => search.onChange('')}>
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  )

  const chip = (key: string, label: string, value: string, onClear: () => void, trigger?: ReactNode) => (
    <span key={key} className="fb-chip">
      {trigger ?? (
        <span className="fb-chip-text">
          {value ? <><span className="fb-chip-label">{label}:</span> {value}</> : label}
        </span>
      )}
      <button type="button" className="fb-chip-x" aria-label={`Remove ${label} filter`} onClick={onClear}>
        <CloseIcon size={11} />
      </button>
    </span>
  )

  // ---- phone ----------------------------------------------------------------------------------
  if (phone) {
    return (
      <div className="fb fb-phone">
        {trailing && <div className="fb-phone-trailing">{trailing}</div>}
        <div className="fb-phone-row">
          {searchBox}
          {(filters.length > 0 || toggles.length > 0 || sort) && (
            <button type="button" className={`fb-filters-btn${activeCount ? ' on' : ''}`} onClick={() => setSheetOpen(true)} aria-label={`Filters${activeCount ? `, ${activeCount} active` : ''}`}>
              <FilterIcon size={15} />
              {!search && <span>Filters</span>}
              {activeCount > 0 && <span className="fb-badge">{activeCount}</span>}
            </button>
          )}
        </div>
        {(activeCount > 0 || count || fixed.length > 0) && (
          <div className="fb-phone-chips scroll-x">
            {count && <span className="fb-count">{count}</span>}
            {fixed.map((f) => (
              <span key={f.key} className="fb-chip fb-chip-fixed">
                <span className="fb-chip-text"><span className="fb-chip-label">{f.label}:</span> {labelOf(f)}</span>
              </span>
            ))}
            {active.map((f) => chip(f.key, f.label, labelOf(f), () => f.onChange(f.defaultValue)))}
            {activeToggles.map((t) => chip(t.key, t.label, '', () => t.onChange(false)))}
          </div>
        )}

        {sheetOpen &&
          createPortal(
            <>
              <div className="ss-backdrop" onMouseDown={() => setSheetOpen(false)} />
              <div className="ss-sheet fb-sheet" role="dialog" aria-label="Filters">
                <div className="ss-grabber" />
                <div className="fb-sheet-head">
                  <span>Filters</span>
                  {activeCount > 0 && (
                    <button type="button" className="fb-clear" onClick={clearAll}>Clear all</button>
                  )}
                </div>
                <div className="fb-sheet-body">
                  {sort && (
                    <div className="fb-group">
                      <div className="fb-group-label">Sort by</div>
                      <div className="fb-opts">
                        {sort.options.map((o) => (
                          <button key={o.value} type="button" className={`fb-opt${o.value === sort.value ? ' on' : ''}`} onClick={() => sort.onChange(o.value)}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {filters.map((f) => (
                    <div key={f.key} className="fb-group">
                      <div className="fb-group-label">{f.label}</div>
                      {(() => {
                        const all = f.required ? f.options : [{ value: f.defaultValue, label: 'Any' }, ...f.options.filter((o) => o.value !== f.defaultValue)]
                        const open = expanded.has(f.key) || all.length <= SHEET_PREVIEW + 1
                        // Long lists (e.g. 20 weeks) show the first few plus the current pick, then "Show all".
                        const shown = open ? all : all.filter((o, i) => i < SHEET_PREVIEW || o.value === f.value)
                        return (
                          <>
                            <div className="fb-opts">
                              {shown.map((o) => (
                                <button key={o.value} type="button" className={`fb-opt${o.value === f.value ? ' on' : ''}`} onClick={() => f.onChange(o.value)}>{o.label}</button>
                              ))}
                            </div>
                            {!open && (
                              <button type="button" className="fb-more" onClick={() => setExpanded((e) => new Set(e).add(f.key))}>
                                Show all {f.required ? all.length : all.length - 1}
                              </button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  ))}
                  {toggles.map((t) => (
                    <label key={t.key} className="fb-toggle-row">
                      <span>{t.label}</span>
                      <button type="button" role="switch" aria-checked={t.value} className={`switch${t.value ? ' on' : ''}`} onClick={() => t.onChange(!t.value)} />
                    </label>
                  ))}
                </div>
                <button type="button" className="btn-dark fb-sheet-done" onClick={() => setSheetOpen(false)}>
                  {count ? `Show ${count}` : 'Done'}
                </button>
              </div>
            </>,
            document.body,
          )}
      </div>
    )
  }

  // ---- desktop / tablet -----------------------------------------------------------------------
  return (
    <div className="fb">
      {searchBox}
      {[...filters.filter((f) => f.required), ...filters.filter((f) => !f.required)].map((f) => {
        if (f.required) {
          return (
            <SearchableSelect
              key={f.key}
              value={f.value}
              onChange={f.onChange}
              options={f.options}
              ariaLabel={f.label}
              title={f.label}
              iconClassName="fb-chip fb-chip-fixed fb-chip-btn"
              iconTrigger={
                <span className="fb-chip-text">
                  <span className="fb-chip-label">{f.label}:</span> {labelOf(f)} <ChevronDownIcon size={12} />
                </span>
              }
            />
          )
        }
        const isSet = f.value !== f.defaultValue
        const select = (
          <SearchableSelect
            value={f.value}
            onChange={f.onChange}
            options={[{ value: f.defaultValue, label: `Any ${f.label.toLowerCase()}` }, ...f.options.filter((o) => o.value !== f.defaultValue)]}
            ariaLabel={f.label}
            title={f.label}
            iconClassName={isSet ? 'fb-chip-btn' : 'fb-pill'}
            iconTrigger={
              isSet ? (
                <span className="fb-chip-text">
                  <span className="fb-chip-label">{f.label}:</span> {labelOf(f)}
                </span>
              ) : (
                <>
                  <span className="fb-plus">+</span> {f.label}
                </>
              )
            }
          />
        )
        return isSet ? chip(f.key, f.label, labelOf(f), () => f.onChange(f.defaultValue), select) : <span key={f.key}>{select}</span>
      })}
      {toggles.map((t) => (
        <button key={t.key} type="button" className={t.value ? 'fb-chip fb-chip-toggle' : 'fb-pill'} aria-pressed={t.value} onClick={() => t.onChange(!t.value)}>
          {t.value ? (
            <>
              <span className="fb-chip-text">{t.label}</span>
              <span className="fb-chip-x" aria-hidden>
                <CloseIcon size={11} />
              </span>
            </>
          ) : (
            <>
              <span className="fb-plus">+</span> {t.label}
            </>
          )}
        </button>
      ))}
      {activeCount > 1 && (
        <button type="button" className="fb-clear" onClick={clearAll}>Clear all</button>
      )}
      <span className="fb-spacer" />
      {count && <span className="fb-count">{count}</span>}
      {sort && (
        <SearchableSelect
          value={sort.value}
          onChange={sort.onChange}
          options={sort.options}
          ariaLabel="Sort by"
          title="Sort by"
          iconClassName="fb-sort"
          iconTrigger={
            <>
              <SortIcon size={13} /> {sort.options.find((o) => o.value === sort.value)?.label}
            </>
          }
        />
      )}
      {trailing && <span className="fb-trailing">{trailing}</span>}
    </div>
  )
}
