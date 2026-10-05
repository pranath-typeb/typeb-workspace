import { CheckCircleIcon, PlayIcon, StopIcon, TimerActivityIcon } from './icons'
import { stopAndSaveTimer, toggleTimerRunning, useTimerState } from '../data/timer'
import { triggerScreenRipple } from '../data/screenRipple'

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts = h > 0 ? [h, m, s] : [m, s]
  return parts.map((n) => String(n).padStart(2, '0')).join(':')
}

// A Dynamic-Island-style pill that floats at the top of every page while a timer
// session is live — visible the moment it starts, and left in place (in a dimmed
// "paused" state) if you pause rather than stop it. Hover reveals pause/resume + stop.
export default function TimerLiveWidget() {
  const timer = useTimerState()
  if (!timer.running && timer.seconds === 0) return null

  return (
    <div className={`timer-live-widget${timer.running ? ' is-running' : ' is-paused'}`}>
      <div className="timer-live-widget-main">
        {timer.running ? (
          <TimerActivityIcon size={14} color="var(--live-accent)" />
        ) : (
          <span className="timer-live-widget-dot" />
        )}
        <span className="mono timer-live-widget-time">{formatElapsed(timer.seconds)}</span>
        <span className="timer-live-widget-desc">{timer.description || 'Untitled task'}</span>
      </div>
      <div className="timer-live-widget-actions">
        <button
          className="timer-live-widget-btn"
          onClick={() => {
            toggleTimerRunning()
            triggerScreenRipple()
          }}
          aria-label={timer.running ? 'Pause timer' : 'Resume timer'}
          title={timer.running ? 'Pause' : 'Resume'}
        >
          {timer.running ? <StopIcon size={10} color="var(--nav-fg)" /> : <PlayIcon size={10} color="var(--nav-fg)" />}
        </button>
        <button
          className="timer-live-widget-btn timer-live-widget-btn-finish"
          onClick={() => {
            if (stopAndSaveTimer()) triggerScreenRipple()
          }}
          aria-label="Stop and save"
          title="Stop & save"
        >
          <CheckCircleIcon size={14} color="var(--live-accent)" />
        </button>
      </div>
    </div>
  )
}
