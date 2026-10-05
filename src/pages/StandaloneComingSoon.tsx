import { Link } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/icons'

interface StandaloneComingSoonProps {
  title: string
  description: string
}

export default function StandaloneComingSoon({ title, description }: StandaloneComingSoonProps) {
  return (
    <section className="stage">
      <div className="canvas">
        <div style={{ padding: '24px 24px 140px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            <ChevronLeftIcon color="var(--color-text-secondary)" /> Dashboard
          </Link>
          <div className="page-title">{title}</div>
          <div className="card" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{description}</div>
        </div>
      </div>
    </section>
  )
}
