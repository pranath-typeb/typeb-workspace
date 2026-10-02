import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, CheckIcon } from './icons'

export interface SearchableSelectOption {
  value: string
  label: string
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  emptyText = 'No items to show',
  className,
  style,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  emptyText?: string
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function selectOption(opt: SearchableSelectOption) {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
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
    }
  }

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', width: '100%', ...style }}>
      <div
        className="input"
        style={{ cursor: disabled ? 'not-allowed' : 'text', opacity: disabled ? 0.6 : 1, gap: 8 }}
        onClick={() => !open && openDropdown()}
      >
        <input
          ref={inputRef}
          value={open ? query : selected?.label ?? ''}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => !open && openDropdown()}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: 'inherit', padding: 0 }}
        />
        <ChevronDownIcon size={14} color="var(--color-text-tertiary)" />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 40,
            background: 'var(--color-background-page)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 10,
            boxShadow: '0 12px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
            maxHeight: 260,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>{emptyText}</div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(opt)
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: i === highlight ? 'var(--color-state-hover)' : 'transparent',
                  color: 'var(--color-text-primary)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                {opt.value === value && <CheckIcon size={14} color="var(--color-text-primary)" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
