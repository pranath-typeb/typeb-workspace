import type { ReactNode } from 'react'
import { GoogleIcon } from './icons'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <section className="stage" style={{ background: 'var(--color-background-subtle)', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 28, letterSpacing: '-1px', color: 'var(--color-text-primary)' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{subtitle}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    </section>
  )
}

export function SocialButtons() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" className="btn-outline" style={{ justifyContent: 'center', width: '100%' }}>
        <GoogleIcon /> Continue with Google
      </button>
    </div>
  )
}

export function AuthDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
    </div>
  )
}
