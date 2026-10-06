import { useState, type ReactNode } from 'react'
import { AlertCircleIcon, CheckIcon, ChevronDownIcon } from './icons'
import { hoursState, PIPELINE, type Check, type Stage } from '../data/payrollInsights'
import type { PayrollHistoryEvent, PayrollPeriod } from '../data/payroll'

export const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

// ---- status chip -------------------------------------------------------------------------------------
export function StageChip({ stage, overdue, small }: { stage: Stage; overdue?: boolean; small?: boolean }) {
  return (
    <span className="pr-chips">
      <span className={`pr-chip tone-${stage.tone}${small ? ' sm' : ''}`}>
        <span className="pr-chip-dot" />
        {stage.label}
      </span>
      {overdue && <span className={`pr-chip tone-overdue${small ? ' sm' : ''}`}>Overdue</span>}
    </span>
  )
}

// ---- Timesheet → Review → Approved → Paid out --------------------------------------------------------
export function Stepper({ stage, flagged }: { stage: Stage; flagged?: boolean }) {
  return (
    <ol className="pr-stepper" aria-label="Payroll progress">
      {PIPELINE.map((name, i) => {
        const done = i < stage.step || (i === stage.step && stage.key === 'paid')
        const current = i === stage.step && stage.key !== 'paid'
        return (
          <li key={name} className={`pr-step${done ? ' done' : ''}${current ? ' current' : ''}${current && flagged ? ' flagged' : ''}`}>
            <span className="pr-step-dot">{done ? <CheckIcon size={11} color="#fff" /> : i + 1}</span>
            <span className="pr-step-label">{name}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ---- hours -------------------------------------------------------------------------------------------
export function HoursMeter({ p, compact }: { p: PayrollPeriod; compact?: boolean }) {
  const hs = hoursState(p)
  const pct = p.targetHours ? Math.min((p.actualHours / p.targetHours) * 100, 100) : 0
  return (
    <div className={`pr-hours${compact ? ' compact' : ''}`}>
      <div className="pr-hours-top">
        <span className="mono pr-hours-val">
          {p.actualHours}
          <span className="pr-hours-of"> / {p.targetHours}h</span>
        </span>
        <span className={`pr-flag ${hs.tone}`}>{hs.label}</span>
      </div>
      <div className="pp-meter">
        <div className="pp-meter-fill" style={{ width: `${pct}%`, background: hs.tone === 'warn' ? 'var(--warn-fg)' : 'var(--brand-mid)' }} />
      </div>
    </div>
  )
}

// ---- checklist ---------------------------------------------------------------------------------------
export function ChecksPanel({ checks }: { checks: Check[] }) {
  const issues = checks.filter((c) => c.state !== 'ok').length
  return (
    <div className="pr-checks">
      <div className="pr-checks-head">
        <span className="pr-section-title">Review checklist</span>
        <span className={`pr-flag ${issues ? 'warn' : 'ok'}`}>{issues ? `${issues} to look at` : 'All clear'}</span>
      </div>
      {checks.map((c) => (
        <div key={c.key} className={`pr-check ${c.state}`}>
          <span className="pr-check-icon">{c.state === 'ok' ? <CheckIcon size={12} color="#fff" /> : <AlertCircleIcon size={14} color="currentColor" />}</span>
          <span className="pr-check-body">
            <span className="pr-check-label">{c.label}</span>
            <span className="pr-check-detail">{c.detail}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ---- collapsible section card ------------------------------------------------------------------------
export function Section({
  title,
  summary,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  summary?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card pr-section">
      <button type="button" className="pr-section-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="pr-section-title">{title}</span>
        {badge}
        {summary && <span className="pr-section-summary">{summary}</span>}
        <ChevronDownIcon size={14} color="var(--color-text-tertiary)" />
      </button>
      {open && <div className="pr-section-body">{children}</div>}
    </section>
  )
}

// ---- status timeline ---------------------------------------------------------------------------------
const EVENT_TEXT: Record<string, string> = {
  'Timesheet pending': 'Created as a draft',
  'Under review': 'Submitted for review',
  'Update needed': 'Changes requested',
  Approved: 'Approved',
  'Paid out': 'Paid out',
}

export function Timeline({ history, extra }: { history: PayrollHistoryEvent[]; extra?: { at: string; text: string; sub?: string }[] }) {
  const items = [
    ...history.map((h) => ({ at: h.at, text: EVENT_TEXT[h.status] ?? h.status, sub: h.note })),
    ...(extra ?? []),
  ].sort((a, b) => b.at.localeCompare(a.at))
  if (items.length === 0) return <div className="pp-empty">No history on file yet.</div>
  return (
    <ol className="pr-timeline">
      {items.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <span className="pr-timeline-dot" />
          <div>
            <div className="pr-timeline-text">{e.text}</div>
            {e.sub && <div className="pr-timeline-sub">{e.sub}</div>}
            <div className="pr-timeline-at mono">{fmtDateTime(e.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
