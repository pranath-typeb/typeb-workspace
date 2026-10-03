import { Link, useNavigate } from 'react-router-dom'
import { ClockIcon, PlayIcon, StopIcon, TargetIcon, TrophyIcon } from './icons'
import { startTimer, toggleTimerRunning, useTimerState } from '../data/timer'
import { triggerScreenRipple } from '../data/screenRipple'
import { startFocus, useFocusRun } from '../data/focus'
import { CalendarIcon } from './icons'

// One-tap shortcuts for the things people do most, right under the greeting.
export default function QuickActions() {
  const timer = useTimerState()
  const focus = useFocusRun()
  const navigate = useNavigate()

  const chip = 'dash-chip'
  return (
    <div className="dash-actions scroll-x" aria-label="Quick actions">
      <button
        className={`${chip} primary`}
        onClick={() => {
          if (timer.running) toggleTimerRunning()
          else if (timer.seconds > 0) toggleTimerRunning()
          else startTimer({ description: '', projectId: timer.projectId, category: timer.category })
          triggerScreenRipple()
        }}
      >
        {timer.running ? <StopIcon size={13} color="currentColor" /> : <PlayIcon size={12} color="currentColor" />}
        {timer.running ? 'Pause timer' : timer.seconds > 0 ? 'Resume timer' : 'Start timer'}
      </button>
      <Link to="/time" className={chip}>
        <ClockIcon size={14} color="currentColor" /> Log time
      </Link>
      <button
        className={chip}
        onClick={() => {
          if (focus.status === 'idle') startFocus()
          navigate('/focus')
        }}
      >
        <TargetIcon size={14} color="currentColor" /> {focus.status === 'idle' ? 'Start focus' : 'Open focus'}
      </button>
      <Link to="/hr/leave" className={chip}>
        <CalendarIcon size={14} color="currentColor" /> Request leave
      </Link>
      <Link to="/challenges" className={chip}>
        <TrophyIcon size={14} color="currentColor" /> Challenges
      </Link>
    </div>
  )
}
