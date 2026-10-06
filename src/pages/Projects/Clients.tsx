import { useMemo, useState } from 'react'
import { useTimeEntries, todayLocal } from '../../data/timeEntries'
import { computeClientStats, fmtHours } from '../../data/projectInsights'
import EmptyState from '../../components/EmptyState'
import { useUrlParam } from '../../lib/useUrlState'
import FilterBar from '../../components/FilterBar'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel } from '../../components/NavItem'
import { BuildingIcon, ProjectsIcon, StaffingIcon, PresentationIcon } from '../../components/icons'
import { useProjects } from '../../data/projects'
import { clientSummaries, useClientStatuses, type ClientStatus } from '../../data/clients'

type Tab = 'Active' | 'Inactive' | 'All' | 'Removed'

export default function Clients() {
  const projects = useProjects()
  const statuses = useClientStatuses()
  const [query, setQuery] = useUrlParam('q', '')
  const [tab, setTab] = useUrlParam<Tab>('tab', 'Active')

  const entries = useTimeEntries()
  const today = todayLocal()
  const clientStatsByName = useMemo(() => {
    const names = Array.from(new Set(projects.map((p) => p.client)))
    return new Map(names.map((n) => [n, computeClientStats(projects.filter((p) => p.client === n), entries, today)]))
  }, [projects, entries, today])
  const clients = useMemo(() => clientSummaries(projects, statuses), [projects, statuses])

  const counts = useMemo(
    () => ({
      Active: clients.filter((c) => c.status === 'Active').length,
      Inactive: clients.filter((c) => c.status === 'Inactive').length,
      All: clients.length,
      Removed: clients.filter((c) => c.status === 'Removed').length,
    }),
    [clients],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q)
      const matchesTab = tab === 'All' || c.status === tab
      return matchesQuery && matchesTab
    })
  }, [clients, query, tab])

  return (
    <AppShell
      appIcon={<PresentationIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="Projects"
      appHref="/projects"
      sidebar={
        <>
          <NavGroupLabel label="General" />
          <NavItem to="/projects" icon={<ProjectsIcon />} label="Projects" />
          <NavItem to="/projects/staffing" icon={<StaffingIcon />} label="Staffing" />
          <NavItem to="/projects/clients" icon={<BuildingIcon color="var(--color-text-inverse)" />} label="Clients" active />
        </>
      }
    >
      <div className="page-title">Clients</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <FilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search clients' }} />
        <div className="scroll-x" style={{ display: 'flex', background: 'var(--color-background-muted)', borderRadius: 10, padding: 2 }}>
          {(Object.keys(counts) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: tab === t ? 'var(--color-background-inverse)' : 'transparent',
                color: tab === t ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              }}
            >
              {t}
              <span className="mono" style={{ background: tab === t ? 'rgba(127,127,127,0.25)' : 'var(--color-border-default)', color: tab === t ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', borderRadius: 9999, fontSize: 11, padding: '1px 7px' }}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{filtered.length} clients</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {filtered.map((c) => (
          <Link key={c.name} to={`/projects/clients/${encodeURIComponent(c.name)}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
              {c.status !== 'Active' && (
                <span className={`badge ${statusBadgeClass(c.status)}`} style={{ fontSize: 10, textTransform: 'uppercase' }}>{c.status}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {c.total} {c.total === 1 ? 'project' : 'projects'}
              {c.active > 0 ? ` · ${c.active} active` : ''}
            </div>
            {(() => {
              const cs = clientStatsByName.get(c.name)
              if (!cs) return null
              const max = Math.max(...cs.monthly.map((m) => m.minutes), 1)
              return (
                <div className="cc-foot">
                  <div>
                    <div className="mono cc-hours">{fmtHours(cs.totalMinutes)}</div>
                    <div className="cc-sub">{cs.monthMinutes ? `${fmtHours(cs.monthMinutes)} this month` : 'Nothing this month'}</div>
                  </div>
                  <div className="cc-spark" aria-hidden title="Hours per month, last 6 months">
                    {cs.monthly.map((m) => (
                      <span key={m.month} style={{ height: `${Math.max((m.minutes / max) * 100, m.minutes ? 12 : 4)}%`, opacity: m.minutes ? 1 : 0.3 }} />
                    ))}
                  </div>
                </div>
              )
            })()}
          </Link>
        ))}
        {filtered.length === 0 && (
          <EmptyState keep={['tab']} title="No clients match" />
        )}
      </div>
    </AppShell>
  )
}

function statusBadgeClass(status: ClientStatus): string {
  if (status === 'Inactive') return 'b-ember'
  if (status === 'Removed') return 'b-danger'
  return 'b-pine'
}
