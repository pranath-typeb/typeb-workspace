import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CloseIcon, PlusIcon } from './icons'

interface AppShellProps {
  appIcon: ReactNode
  appLabel: string
  appHref: string
  sidebar: ReactNode
  children: ReactNode
}

// Sidebar starts collapsed to an icon rail on phones/small tablets so it doesn't
// eat most of the screen on first render — desktop still starts expanded.
function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export default function AppShell({ appIcon, appLabel, appHref, sidebar, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(isNarrowViewport)

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
          <div className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} style={{ alignSelf: 'flex-start' }}>
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
