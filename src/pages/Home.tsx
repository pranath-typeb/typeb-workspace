import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLeaveRequests, PTO_TOTAL_ACCRUED, PTO_TOTAL_USED } from '../data/leave'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const requests = useLeaveRequests()
  const pendingDays = requests.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + r.days, 0)
  const availablePto = Math.max(PTO_TOTAL_ACCRUED - PTO_TOTAL_USED - pendingDays, 0)

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const secStr = now.toLocaleTimeString('en-US', { second: '2-digit' }).split(':').pop() ?? '00'

  return (
    <section className="stage">
      <div className="canvas">
        <div style={{ padding: '24px 24px 140px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              paddingBottom: 16,
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              marginBottom: 20,
            }}
          >
            <div>
              <div className="serif" style={{ fontSize: 24, letterSpacing: '-1.2px', color: '#0f0f10' }}>
                {greeting(now.getHours())}, Pranath.
              </div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginTop: 4 }}>
                {dateStr} · Times shown in Asia/Colombo
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>{timeStr}</span>
                <span style={{ fontSize: 14, fontWeight: 600, paddingBottom: 8 }}>{secStr}</span>
              </div>
            </div>
          </div>

          <div style={{ width: 880, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link
                to="/people"
                className="card"
                style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.53)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  People
                </div>
                <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.8px' }}>Directory & Org chart</div>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>Browse the team, find someone's manager, or check your reporting line.</div>
              </Link>
              <Link
                to="/hr/leave"
                className="card"
                style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.53)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  HR
                </div>
                <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.8px' }}>My Leave</div>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)' }}>Request time off and track approvals for this leave cycle.</div>
              </Link>
            </div>

            <div style={{ position: 'relative', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.53)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Available PTO
                </span>
                <Link to="/hr/leave" style={{ fontSize: 12, fontWeight: 600 }}>My Leave ›</Link>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div className="serif" style={{ fontSize: 28, letterSpacing: '-1px' }}>{availablePto.toFixed(1)}d</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}>
                    {PTO_TOTAL_ACCRUED}d accrued · {PTO_TOTAL_USED}d used
                    {pendingDays > 0 ? ` · ${pendingDays}d pending` : ''}
                  </div>
                </div>
                <Link to="/hr/leave" className="btn-dark">Request Leave</Link>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.53)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Recent leave activity
              </div>
              {requests.slice(0, 4).map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.type} · {r.date}</div>
                  <span className={`badge ${r.status === 'Approved' ? 'b-pine' : r.status === 'Rejected' ? 'b-danger' : 'b-ember'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
