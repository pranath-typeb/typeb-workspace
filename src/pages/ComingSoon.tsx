import type { ReactNode } from 'react'
import AppShell from '../components/AppShell'

interface ComingSoonProps {
  appIcon: ReactNode
  appLabel: string
  appHref: string
  sidebar: ReactNode
  title: string
}

export default function ComingSoon({ appIcon, appLabel, appHref, sidebar, title }: ComingSoonProps) {
  return (
    <AppShell appIcon={appIcon} appLabel={appLabel} appHref={appHref} sidebar={sidebar}>
      <div className="page-title">{title}</div>
      <div className="card" style={{ fontSize: 14, color: 'rgba(0,0,0,0.53)' }}>
        This screen isn't wired up yet in this build.
      </div>
    </AppShell>
  )
}
