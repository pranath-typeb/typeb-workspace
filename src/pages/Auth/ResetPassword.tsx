import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  return (
    <AuthLayout title="Set new password" subtitle="Your new password must be different from previously used passwords.">
      <div>
        <div className="field-label">New password</div>
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <div className="field-label">Confirm password</div>
        <input className="input" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>

      <button className="btn-dark" style={{ justifyContent: 'center', width: '100%', marginTop: 4 }} onClick={() => navigate('/login')}>
        Reset password
      </button>
    </AuthLayout>
  )
}
