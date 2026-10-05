import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'

export default function CheckEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email || 'your email'

  return (
    <AuthLayout title="Check your email" subtitle={`We sent a password reset link to ${email}.`}>
      <button className="btn-dark" style={{ justifyContent: 'center', width: '100%', marginTop: 4 }} onClick={() => navigate('/reset-password')}>
        Open email app
      </button>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Back to sign in</Link>
      </div>
    </AuthLayout>
  )
}
