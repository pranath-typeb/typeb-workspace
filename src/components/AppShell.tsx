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

export default function AppShell({ appIcon, appLabel, appHref, sidebar, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

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
            <CloseIcon color="rgba(0,0,0,0.53)" />
          </Link>
        </div>

        <div className="body-row">
          {collapsed ? (
            <button
              className="sidebar-fab sidebar-fab-collapsed"
              aria-label="Open sidebar"
              aria-expanded={false}
              onClick={() => setCollapsed(false)}
            >
              <PlusIcon color="#fff" />
            </button>
          ) : (
            <div className="sidebar" style={{ alignSelf: 'flex-start' }}>
              <div className="sidebar-inner">{sidebar}</div>
              <button
                className="sidebar-fab"
                aria-label="Close sidebar"
                aria-expanded={true}
                onClick={() => setCollapsed(true)}
              >
                <PlusIcon color="#fff" />
              </button>
            </div>
          )}

          <div className="content">{children}</div>
        </div>
      </div>
    </section>
  )
}
