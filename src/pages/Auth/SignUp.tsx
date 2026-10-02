import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout, { SocialButtons, AuthDivider } from '../../components/AuthLayout'

export default function SignUp() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <AuthLayout title="Create an account" subtitle="Get started with your workspace.">
      <SocialButtons />
      <AuthDivider />

      <div>
        <div className="field-label">Full name</div>
        <input className="input" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <div className="field-label">Email</div>
        <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <div className="field-label">Password</div>
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <button className="btn-dark" style={{ justifyContent: 'center', width: '100%', marginTop: 4 }} onClick={() => navigate('/')}>
        Create account
      </button>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Already have an account? <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Sign in</Link>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
        By signing up you agree to our Terms of service &amp; Privacy policy
      </div>
    </AuthLayout>
  )
}
