import { Children, Fragment, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, CheckIcon, SearchIcon } from './icons'
import { feedback } from '../data/uiSounds'

export interface SearchableSelectOption {
  value: string
  label: string
  icon?: ReactNode
}

// Lists at or below this size skip the search box — typing to filter 3 items is noise.
const SEARCH_THRESHOLD = 6
const PANEL_MAX_HEIGHT = 240

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

const RECENT_STORE = 'typeb-hr.recent-picks.v1'
const RECENT_MAX = 4

function readRecents(key: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_STORE) ?? '{}') as Record<string, string[]>
    return all[key] ?? []
  } catch {
    return []
  }
}

function pushRecent(key: string, value: string) {
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_STORE) ?? '{}') as Record<string, string[]>
    all[key] = [value, ...(all[key] ?? []).filter((v) => v !== value)].slice(0, 8)
    localStorage.setItem(RECENT_STORE, JSON.stringify(all))
  } catch {
    // ignore
  }
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  emptyText = 'No matches',
  className,
  style,
  disabled,
  searchThreshold = SEARCH_THRESHOLD,
  ariaLabel,
  title,
  iconTrigger,
  iconClassName = 'ep-icon-btn dark',
  iconSize,
  recentKey,
  recentFrom,
  footer,
  recentLabel = 'Recently used',
  allLabel = 'All',
}: {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  emptyText?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  searchThreshold?: number
  ariaLabel?: string
  title?: string
  // Render the closed state as a compact icon button (e.g. a tag for "category") instead of a field.
  iconTrigger?: ReactNode
  iconClassName?: string
  iconSize?: number
  // Remember what gets picked under this key and list the latest few on top ("Recently used"),
  // above the full list. Only kicks in for lists long enough to need searching.
  recentKey?: string
  // Extra recents derived from real usage (e.g. latest time entries), merged after the remembered picks.
  recentFrom?: () => string[]
  // Pinned below the list (e.g. a "Create tag" form). Receives helpers to select a value / close the panel.
  footer?: (api: { select: (value: string) => void; close: () => void }) => ReactNode
  recentLabel?: string
  allLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const phone = useIsPhone()

  const selected = options.find((o) => o.value === value)
  const searchable = options.length > searchThreshold

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  // "Recently used" section: neutral option first (e.g. "No project"), then the latest picks, then the rest.
  const sections = useMemo(() => {
    if (!recentKey || query.trim() || !searchable || !open) return null
    const neutral = options.filter((o) => o.value === '')
    const merged = [...readRecents(recentKey), ...(recentFrom?.() ?? [])].filter((v, i, a) => a.indexOf(v) === i)
    const recents = merged
      .map((v) => options.find((o) => o.value === v))
      .filter((o): o is SearchableSelectOption => !!o && o.value !== '')
      .slice(0, RECENT_MAX)
    if (recents.length === 0) return null
    const used = new Set([...neutral, ...recents].map((o) => o.value))
    return { neutral, recents, rest: options.filter((o) => !used.has(o.value)) }
  }, [recentKey, query, searchable, open, options])

  const flat = useMemo(() => (sections ? [...sections.neutral, ...sections.recents, ...sections.rest] : filtered), [sections, filtered])

  function close(refocus = false) {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
  }

  function openDropdown() {
    if (disabled) return
    setQuery('')
    setOpen(true)
  }

  // Start the highlight on the current value once the list (with its sections) is laid out.
  useEffect(() => {
    if (open) setHighlight(Math.max(flat.findIndex((o) => o.value === value), 0))
  }, [open])

  // Anchor the panel to the trigger (portal + fixed so modals and scroll cards never clip it),
  // flipping above when there isn't room below.
  useLayoutEffect(() => {
    if (!open || phone) return
    function place() {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const flip = below < 200 && above > below
      const maxHeight = Math.min(PANEL_MAX_HEIGHT + (searchable ? 52 : 0), flip ? above : below)
      // Size the list to the longest option name (bounded), so names aren't cut off where there's room.
      let widest = 0
      const probe = document.createElement('canvas').getContext('2d')
      if (probe && triggerRef.current) {
        const cs = getComputedStyle(triggerRef.current)
        probe.font = `500 ${cs.fontSize} ${cs.fontFamily}`
        options.forEach((o) => {
          widest = Math.max(widest, probe.measureText(o.label).width)
        })
      }
      const maxWidth = Math.min(440, window.innerWidth - 16)
      const iconPad = options.some((o) => o.icon) ? 24 : 0
      const width = Math.min(maxWidth, Math.max(r.width, 150, Math.ceil(widest) + 52 + iconPad))
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
      setPos(flip ? { left, width, bottom: window.innerHeight - r.top + 6, maxHeight } : { left, width, top: r.bottom + 6, maxHeight })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, phone, searchable])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus())
    else requestAnimationFrame(() => panelRef.current?.focus())
  }, [open, searchable, phone])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  // Lock page scroll behind the phone sheet.
  useEffect(() => {
    if (!open || !phone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, phone])

  function selectOption(opt: SearchableSelectOption) {
    feedback('select')
    if (recentKey && opt.value !== '') pushRecent(recentKey, opt.value)
    onChange(opt.value)
    close(true)
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDropdown()
    }
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = flat[highlight]
      if (opt) selectOption(opt)
    } else if (e.key === 'Tab') {
      close()
    }
  }

  const renderOption = (opt: SearchableSelectOption, i: number) => (
    <div
      key={opt.value}
      data-idx={i}
      role="option"
      aria-selected={opt.value === value}
      className={`ss-option${i === highlight ? ' highlighted' : ''}${opt.value === value ? ' selected' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault()
        selectOption(opt)
      }}
      onMouseEnter={() => setHighlight(i)}
    >
      {opt.icon && <span className="ss-option-icon">{opt.icon}</span>}
      <span className="ss-option-label">{opt.label}</span>
      {opt.value === value && <CheckIcon size={14} color="var(--color-text-primary)" />}
    </div>
  )

  const list = (
    <div ref={listRef} className="ss-list" role="listbox">
      {flat.length === 0 ? (
        <div className="ss-empty">{emptyText}</div>
      ) : sections ? (
        <>
          {sections.neutral.map((o, i) => renderOption(o, i))}
          <div className="ss-group" role="presentation">{recentLabel}</div>
          {sections.recents.map((o, i) => renderOption(o, sections.neutral.length + i))}
          <div className="ss-group" role="presentation">{allLabel}</div>
          {sections.rest.map((o, i) => renderOption(o, sections.neutral.length + sections.recents.length + i))}
        </>
      ) : (
        flat.map((o, i) => renderOption(o, i))
      )}
    </div>
  )

  const footerNode = footer ? (
    <div
      className="ss-footer"
      onKeyDown={(e) => {
        // typing in a footer form must not trigger list navigation / selection
        if (e.key !== 'Escape') e.stopPropagation()
      }}
    >
      {footer({ select: (v) => { const o = options.find((x) => x.value === v); if (o) selectOption(o); else { onChange(v); close(true) } }, close: () => close(true) })}
    </div>
  ) : null

  const searchBox = searchable && (
    <div className="ss-search">
      <SearchIcon size={14} color="var(--color-text-tertiary)" />
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        aria-label="Search options"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )

  return (
    <div className={`ss-root${className ? " " + className : ""}`} style={{ position: 'relative', width: iconTrigger ? 'auto' : '100%', ...style }}>
      <button
        ref={triggerRef}
        type="button"
        className={iconTrigger ? `${iconClassName}${open ? ' open' : ''}` : `input ss-trigger${open ? ' open' : ''}`}
        style={iconTrigger && iconSize ? { width: iconSize, height: iconSize } : undefined}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openDropdown())}
        onKeyDown={onTriggerKeyDown}
      >
        {iconTrigger ?? (
          <>
            {selected?.icon && <span className="ss-option-icon">{selected.icon}</span>}
            <span className={`ss-value${selected ? '' : ' placeholder'}`}>{selected ? selected.label : placeholder}</span>
            <ChevronDownIcon size={14} color="var(--color-text-tertiary)" />
          </>
        )}
      </button>

      {open &&
        createPortal(
          phone ? (
            <>
              <div className="ss-backdrop" onMouseDown={() => close()} onClick={(e) => e.stopPropagation()} />
              <div ref={panelRef} tabIndex={-1} className="ss-sheet" onClick={(e) => e.stopPropagation()} onKeyDown={onPanelKeyDown} role="dialog" aria-label={title ?? ariaLabel ?? 'Choose an option'}>
                <div className="ss-grabber" />
                {(title || ariaLabel) && <div className="ss-sheet-title">{title ?? ariaLabel}</div>}
                {searchBox}
                {list}
                {footerNode}
              </div>
            </>
          ) : (
            <div
              ref={panelRef}
              tabIndex={-1}
              className="ss-panel"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onPanelKeyDown}
              style={pos ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight } : { visibility: 'hidden' }}
            >
              {searchBox}
              {list}
              {footerNode}
            </div>
          ),
          document.body,
        )}
    </div>
  )
}

// ---- Drop-in replacement for a native select ------------------------------------------------
// Same JSX shape (<Select value onChange={(e) => e.target.value}><option value>…</option></Select>)
// so existing call sites only swap the tag name and gain search, keyboard nav and a phone sheet.

function optionLabel(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(optionLabel).join('')
  if (isValidElement(node)) return optionLabel((node.props as { children?: ReactNode }).children)
  return ''
}

function collectOptions(children: ReactNode, out: SearchableSelectOption[] = []): SearchableSelectOption[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode }>
    if (el.type === Fragment) {
      collectOptions(el.props.children, out)
    } else if (el.type === 'option') {
      const label = optionLabel(el.props.children)
      out.push({ value: String(el.props.value ?? label), label })
    }
  })
  return out
}

export function Select({
  value,
  onChange,
  children,
  className,
  style,
  disabled,
  placeholder,
  title,
  'aria-label': ariaLabel,
}: {
  value: string | number
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  className?: string
  style?: CSSProperties
  disabled?: boolean
  placeholder?: string
  title?: string
  'aria-label'?: string
}) {
  const options = collectOptions(children)
  return (
    <SearchableSelect
      value={String(value)}
      options={options}
      onChange={(v) => onChange({ target: { value: v } })}
      style={style}
      disabled={disabled}
      placeholder={placeholder}
      title={title}
      ariaLabel={ariaLabel}
    />
  )
}
