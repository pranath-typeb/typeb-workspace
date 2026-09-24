import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface NavItemProps {
  to: string
  icon: ReactNode
  label: string
  active?: boolean
}

export function NavItem({ to, icon, label, active }: NavItemProps) {
  return (
    <Link to={to} className={active ? 'navitem' : 'navitem-sm'}>
      {icon}
      {label}
    </Link>
  )
}

export function NavGroupLabel({ label }: { label: string }) {
  return <div className="navgroup-label">{label}</div>
}

export function NavSep() {
  return <div className="navsep" />
}
