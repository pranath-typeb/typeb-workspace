import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CloseIcon, PlusIcon } from './icons'
import { setSidebarCollapsed, useSidebarCollapsed } from '../data/sidebar'

interface AppShellProps {
  appIcon: ReactNode
  appLabel: string
  appHref: string
  sidebar: ReactNode
  children: ReactNode
}

// Sidebar starts collapsed to an icon rail on phones/small tablets so it doesn't
// eat most of the screen on first render. On wider screens the collapsed/expanded choice is shared by
// every page (see data/sidebar.ts), so it stays however you left it.
function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export default function AppShell({ appIcon, appLabel, appHref, sidebar, children }: AppShellProps) {
  const narrow = isNarrowViewport()
  const [localCollapsed, setLocalCollapsed] = useState(true)
  const sharedCollapsed = useSidebarCollapsed()
  const collapsed = narrow ? localCollapsed : sharedCollapsed
  const setCollapsed = (update: boolean | ((current: boolean) => boolean)) => {
    const next = typeof update === 'function' ? update(collapsed) : update
    if (narrow) setLocalCollapsed(next)
    else setSidebarCollapsed(next)
  }
  const sidebarRef = useRef<HTMLDivElement>(null)

  // On phones the sidebar is a horizontal chip strip — bring the active section into view.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 640px)').matches) return
    const strip = sidebarRef.current?.querySelector<HTMLElement>('.sidebar-inner')
    const active = strip?.querySelector<HTMLElement>('.navitem')
    if (strip && active) strip.scrollLeft = Math.max(0, active.offsetLeft - strip.clientWidth / 2 + active.offsetWidth / 2)
  }, [])

  return (
    <section className="stage">
      <div className="canvas">
        <div className="topbar">
          <Link to={appHref} className="topbar-app">
            {appIcon}
            <span className="topbar-app-label">{appLabel}</span>
          </Link>
          <Link
            to="/"
            style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close"
          >
            <CloseIcon color="var(--color-text-secondary)" />
          </Link>
        </div>

        <div className="body-row">
          {!collapsed && <div className="sidebar-backdrop" onClick={() => setCollapsed(true)} />}
          <div ref={sidebarRef} className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} style={{ alignSelf: 'flex-start' }}>
            <div className="sidebar-inner">{sidebar}</div>
            <button
              className="sidebar-fab"
              aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <PlusIcon color="#fff" />
            </button>
          </div>

          <div className="content">{children}</div>
        </div>
      </div>
    </section>
  )
}
