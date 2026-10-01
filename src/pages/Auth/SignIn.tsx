import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout, { SocialButtons, AuthDivider } from '../../components/AuthLayout'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your workspace.">
      <SocialButtons />
      <AuthDivider />

      <div>
        <div className="field-label">Email</div>
        <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="field-label">Password</div>
          <Link to="/forgot-password" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            Forgot your password?
          </Link>
        </div>
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <button className="btn-dark" style={{ justifyContent: 'center', width: '100%', marginTop: 4 }} onClick={() => navigate('/')}>
        Continue
      </button>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Don&apos;t have an account? <Link to="/signup" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Sign up</Link>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
        By continuing you agree to our Terms of service &amp; Privacy policy
      </div>
    </AuthLayout>
  )
}
