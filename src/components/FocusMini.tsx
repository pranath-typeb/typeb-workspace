import { Link, useLocation } from 'react-router-dom'
import { PauseIcon, TargetIcon } from './icons'
import { formatClock, pauseFocus, resumeFocus, useFocusRun } from '../data/focus'

// Keeps a running focus session visible while you navigate elsewhere in the app.
export default function FocusMini() {
  const run = useFocusRun()
  const { pathname } = useLocation()
  if (run.status === 'idle' || pathname === '/focus') return null
  const running = run.status === 'running'
  return (
    <div className={`focus-mini${running ? '' : ' paused'}`}>
      <Link to="/focus" className="focus-mini-link" aria-label="Open Focus">
        <TargetIcon size={14} color="currentColor" />
        <span className="mono">{formatClock(run.remainingSec)}</span>
        <span className="focus-mini-label">{run.phase === 'focus' ? run.task || 'Focus' : 'Break'}</span>
      </Link>
      <button className="focus-mini-btn" aria-label={running ? 'Pause focus' : 'Resume focus'} onClick={() => (running ? pauseFocus() : resumeFocus())}>
        {running ? <PauseIcon size={12} color="currentColor" /> : <span style={{ fontSize: 11, marginLeft: 1 }}>▶</span>}
      </button>
    </div>
  )
}
