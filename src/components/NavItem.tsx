import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface NavItemProps {
  to: string
  icon: ReactNode
  label: string
  active?: boolean
  badge?: number
}

export function NavItem({ to, icon, label, active, badge }: NavItemProps) {
  return (
    <Link to={to} className={active ? 'navitem' : 'navitem-sm'} style={badge ? { justifyContent: 'space-between' } : undefined}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        {label}
      </span>
      {Boolean(badge) && (
        <span
          className="mono"
          style={{
            background: active ? '#99c7c5' : '#ebebeb',
            color: active ? '#004543' : '#525252',
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 10,
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

export function NavGroupLabel({ label }: { label: string }) {
  return <div className="navgroup-label">{label}</div>
}

export function NavSep() {
  return <div className="navsep" />
}
