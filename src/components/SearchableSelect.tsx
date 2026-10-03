import { Children, Fragment, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, CheckIcon, SearchIcon } from './icons'
import { feedback } from '../data/uiSounds'

export interface SearchableSelectOption {
  value: string
  label: string
}

// Lists at or below this size skip the search box — typing to filter 3 items is noise.
const SEARCH_THRESHOLD = 6
const PANEL_MAX_HEIGHT = 280

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

  function close(refocus = false) {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
  }

  function openDropdown() {
    if (disabled) return
    const idx = options.findIndex((o) => o.value === value)
    setHighlight(Math.max(idx, 0))
    setQuery('')
    setOpen(true)
  }

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
      const width = Math.max(r.width, 180)
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
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) selectOption(opt)
    } else if (e.key === 'Tab') {
      close()
    }
  }

  const list = (
    <div ref={listRef} className="ss-list" role="listbox">
      {filtered.length === 0 ? (
        <div className="ss-empty">{emptyText}</div>
      ) : (
        filtered.map((opt, i) => (
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
            <span className="ss-option-label">{opt.label}</span>
            {opt.value === value && <CheckIcon size={14} color="var(--color-text-primary)" />}
          </div>
        ))
      )}
    </div>
  )

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
    <div className={`ss-root${className ? " " + className : ""}`} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        ref={triggerRef}
        type="button"
        className={`input ss-trigger${open ? ' open' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openDropdown())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`ss-value${selected ? '' : ' placeholder'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDownIcon size={14} color="var(--color-text-tertiary)" />
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
