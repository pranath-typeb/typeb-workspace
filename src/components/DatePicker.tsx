import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'

// Custom date picker (replaces the browser's native <input type="date"> popup). Values are
// 'YYYY-MM-DD' strings, same as the native input, so call sites keep their state as is.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PANEL_WIDTH = 304
const PANEL_HEIGHT = 420

const pad = (n: number) => String(n).padStart(2, '0')
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function parse(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function addDaysTo(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  allowClear = false,
  disabled,
  className,
  style,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  allowClear?: boolean
  disabled?: boolean
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}) {
  const selected = parse(value)
  const today = useMemo(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])
  const phone = useIsPhone()

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'days' | 'months'>('days')
  const [view, setView] = useState(() => {
    const base = selected ?? today
    return { y: base.getFullYear(), m: base.getMonth() }
  })
  const [cursor, setCursor] = useState<Date>(selected ?? today)
  const [dir, setDir] = useState<'next' | 'prev' | ''>('')
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const minD = min ? parse(min) : null
  const maxD = max ? parse(max) : null
  const isDisabled = (d: Date) => (!!minD && d < minD) || (!!maxD && d > maxD)

  function openPicker() {
    if (disabled) return
    const base = selected ?? today
    setView({ y: base.getFullYear(), m: base.getMonth() })
    setCursor(base)
    setMode('days')
    setDir('')
    setOpen(true)
  }

  function close(refocus = false) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  function pick(d: Date) {
    if (isDisabled(d)) return
    onChange(toStr(d))
    close(true)
  }

  function shiftMonth(delta: number) {
    setDir(delta > 0 ? 'next' : 'prev')
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  // Keep the keyboard cursor inside the visible month when the view changes by arrows/buttons.
  function moveCursor(next: Date) {
    setCursor(next)
    if (next.getFullYear() !== view.y || next.getMonth() !== view.m) {
      setDir(next > new Date(view.y, view.m, 1) ? 'next' : 'prev')
      setView({ y: next.getFullYear(), m: next.getMonth() })
    }
  }

  useLayoutEffect(() => {
    if (!open || phone) return
    function place() {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const flip = below < PANEL_HEIGHT && above > below
      const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_WIDTH - 8)
      setPos(flip ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, phone])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    requestAnimationFrame(() => panelRef.current?.focus())
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  useEffect(() => {
    if (!open || !phone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, phone])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (mode === 'months') setMode('days')
      else close(true)
      return
    }
    if (mode !== 'days') return
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in step) {
      e.preventDefault()
      moveCursor(addDaysTo(cursor, step[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      const d = new Date(cursor.getFullYear(), cursor.getMonth() + (e.key === 'PageUp' ? -1 : 1), cursor.getDate())
      moveCursor(d)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(cursor)
    }
  }

  // 6 rows x 7 columns, Monday first, padded with the neighbouring months' days.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1)
    const lead = (first.getDay() + 6) % 7
    const start = addDaysTo(first, -lead)
    return Array.from({ length: 42 }, (_, i) => addDaysTo(start, i))
  }, [view])

  const nextMonday = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7))
    return d
  }, [today])
  const quick: Array<{ label: string; date: Date }> = [
    { label: 'Yesterday', date: addDaysTo(today, -1) },
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDaysTo(today, 1) },
    { label: 'Next Mon', date: nextMonday },
  ]

  const same = (a: Date | null, b: Date) => !!a && a.getTime() === b.getTime()

  const body = (
    <div className="dp" onKeyDown={onKeyDown}>
      <div className="dp-summary" aria-live="polite">
        {selected ? (
          <>
            <span className="dp-summary-day">{WEEKDAYS_LONG[selected.getDay()]}</span>
            <span className="dp-summary-date">{selected.getDate()} {MONTHS_LONG[selected.getMonth()]} {selected.getFullYear()}</span>
          </>
        ) : (
          <span className="dp-summary-day">No date picked</span>
        )}
      </div>

      <div className="dp-chips">
        {quick.map((q) => (
          <button key={q.label} type="button" className={`dp-chip${same(selected, q.date) ? ' on' : ''}`} disabled={isDisabled(q.date)} onClick={() => pick(q.date)}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label={mode === 'days' ? 'Previous month' : 'Previous year'} onClick={() => (mode === 'days' ? shiftMonth(-1) : setView((v) => ({ ...v, y: v.y - 1 })))}>
          <ChevronLeftIcon size={14} />
        </button>
        <button type="button" className="dp-title" onClick={() => setMode((m) => (m === 'days' ? 'months' : 'days'))} aria-label="Choose month and year">
          {mode === 'days' ? `${MONTHS_LONG[view.m]} ${view.y}` : view.y}
          <ChevronDownIcon size={12} />
        </button>
        <button type="button" className="dp-nav" aria-label={mode === 'days' ? 'Next month' : 'Next year'} onClick={() => (mode === 'days' ? shiftMonth(1) : setView((v) => ({ ...v, y: v.y + 1 })))}>
          <ChevronRightIcon size={14} />
        </button>
      </div>

      {mode === 'months' ? (
        <div className="dp-months">
          {MONTHS.map((m, i) => {
            const isCur = today.getFullYear() === view.y && today.getMonth() === i
            const isSel = !!selected && selected.getFullYear() === view.y && selected.getMonth() === i
            return (
              <button
                key={m}
                type="button"
                className={`dp-month${isSel ? ' on' : ''}${isCur ? ' now' : ''}`}
                onClick={() => {
                  setView({ y: view.y, m: i })
                  setCursor(new Date(view.y, i, Math.min(cursor.getDate(), 28)))
                  setMode('days')
                }}
              >
                {m}
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <div className="dp-dow" aria-hidden>
            {WEEKDAYS.map((d, i) => (
              <span key={i} className={i > 4 ? 'wk' : ''}>{d}</span>
            ))}
          </div>
          <div className={`dp-grid${dir ? ` slide-${dir}` : ''}`} key={`${view.y}-${view.m}`} role="grid">
            {cells.map((d) => {
              const out = d.getMonth() !== view.m
              const isSel = same(selected, d)
              const isToday = same(today, d)
              const dis = isDisabled(d)
              const wkend = d.getDay() === 0 || d.getDay() === 6
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  role="gridcell"
                  tabIndex={-1}
                  disabled={dis}
                  aria-selected={isSel}
                  aria-label={`${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`}
                  className={`dp-day${out ? ' out' : ''}${wkend ? ' wk' : ''}${isSel ? ' on' : ''}${isToday ? ' today' : ''}${same(cursor, d) ? ' cur' : ''}`}
                  onClick={() => pick(d)}
                  onMouseEnter={() => setCursor(d)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </>
      )}

      {allowClear && (
        <div className="dp-foot">
          <button type="button" className="dp-clear" onClick={() => { onChange(''); close(true) }} disabled={!selected}>
            Clear date
          </button>
        </div>
      )}
    </div>
  )

  const label = selected ? `${selected.getDate()} ${MONTHS[selected.getMonth()]} ${selected.getFullYear()}` : placeholder

  return (
    <div className={`ss-root${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        ref={triggerRef}
        type="button"
        className={`input ss-trigger dp-trigger${open ? ' open' : ''}`}
        style={style?.borderRadius ? { borderRadius: style.borderRadius } : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
      >
        <span className={`ss-value${selected ? '' : ' placeholder'}`}>{label}</span>
        <CalendarIcon size={15} color="var(--color-text-tertiary)" />
      </button>

      {open &&
        createPortal(
          phone ? (
            <>
              <div className="ss-backdrop" onMouseDown={() => close()} onClick={(e) => e.stopPropagation()} />
              <div ref={panelRef} tabIndex={-1} className="ss-sheet dp-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={ariaLabel ?? 'Pick a date'}>
                <div className="ss-grabber" />
                {body}
              </div>
            </>
          ) : (
            <div
              ref={panelRef}
              tabIndex={-1}
              className="ss-panel dp-panel"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={ariaLabel ?? 'Pick a date'}
              style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, width: PANEL_WIDTH } : { visibility: 'hidden' }}
            >
              {body}
            </div>
          ),
          document.body,
        )}
    </div>
  )
}
