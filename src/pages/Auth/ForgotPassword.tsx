import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  return (
    <AuthLayout title="Forgot password?" subtitle="No worries, we'll send you reset instructions.">
      <div>
        <div className="field-label">Email</div>
        <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <button
        className="btn-dark"
        style={{ justifyContent: 'center', width: '100%', marginTop: 4 }}
        onClick={() => navigate('/check-email', { state: { email } })}
      >
        Send reset link
      </button>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Back to sign in</Link>
      </div>
    </AuthLayout>
  )
}
