import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PauseIcon, StopIcon, TargetIcon, VolumeIcon, VolumeOffIcon } from './icons'
import { formatClock, pauseFocus, resetFocus, resumeFocus, toggleAmbientSound, useAmbientPlaying, useFocusRun, useFocusSettings } from '../data/focus'

const POS_KEY = 'typeb-hr.focus-mini-pos.v1'
const DRAG_THRESHOLD = 4

interface Pos {
  x: number
  y: number
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) return JSON.parse(raw) as Pos
  } catch {
    // ignore
  }
  return null
}

// Keeps a running focus session visible while you navigate elsewhere. Drag it anywhere — the spot
// is remembered. It also has mute and stop so you never have to go back to the Focus page.
export default function FocusMini() {
  const run = useFocusRun()
  const settings = useFocusSettings()
  const playing = useAmbientPlaying()
  const { pathname } = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos | null>(loadPos)
  const [dragging, setDragging] = useState(false)
  const suppressClick = useRef(false)
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null)

  const clamp = (p: Pos): Pos => {
    const el = rootRef.current
    const w = el?.offsetWidth ?? 200
    const h = el?.offsetHeight ?? 44
    return { x: Math.min(Math.max(8, p.x), window.innerWidth - w - 8), y: Math.min(Math.max(8, p.y), window.innerHeight - h - 8) }
  }

  // Keep it on screen if the window shrinks.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (run.status === 'idle' || pathname === '/focus') return null
  const running = run.status === 'running'
  const soundOn = settings.sound !== 'off'

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return // let the buttons be buttons
    const rect = rootRef.current!.getBoundingClientRect()
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, sx: e.clientX, sy: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return
    d.moved = true
    setDragging(true)
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }))
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (d?.moved) {
      // The click that follows a drag must not navigate to /focus.
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    if (d?.moved && rootRef.current) {
      const r = rootRef.current.getBoundingClientRect()
      const p = clamp({ x: r.left, y: r.top })
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(p))
      } catch {
        // ignore
      }
    }
  }

  return (
    <div
      ref={rootRef}
      className={`focus-mini${running ? '' : ' paused'}${dragging ? ' dragging' : ''}${pos ? ' placed' : ''}`}
      style={pos ? { left: pos.x, top: pos.y, bottom: 'auto' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        // Double-click the pill's body to send it back to its default corner.
        if ((e.target as HTMLElement).closest('button')) return
        setPos(null)
        try {
          localStorage.removeItem(POS_KEY)
        } catch {
          // ignore
        }
      }}
    >
      <Link
        to="/focus"
        className="focus-mini-link"
        aria-label="Open Focus"
        draggable={false}
        onClickCapture={(e) => {
          if (suppressClick.current) e.preventDefault()
        }}
      >
        <TargetIcon size={14} color="currentColor" />
        <span className="mono">{formatClock(run.remainingSec)}</span>
        <span className="focus-mini-label">{run.phase === 'focus' ? run.task || 'Focus' : 'Break'}</span>
      </Link>

      {soundOn && run.phase === 'focus' && (
        <button className="focus-mini-btn" aria-label={playing ? 'Mute sound' : 'Unmute sound'} title={playing ? 'Mute sound' : 'Play sound'} onClick={toggleAmbientSound}>
          {playing ? <VolumeIcon size={14} color="currentColor" /> : <VolumeOffIcon size={14} color="currentColor" />}
        </button>
      )}
      <button className="focus-mini-btn" aria-label={running ? 'Pause focus' : 'Resume focus'} title={running ? 'Pause' : 'Resume'} onClick={() => (running ? pauseFocus() : resumeFocus())}>
        {running ? <PauseIcon size={12} color="currentColor" /> : <span style={{ fontSize: 11, marginLeft: 1 }}>▶</span>}
      </button>
      <button className="focus-mini-btn stop" aria-label="Stop focus session" title="Stop session" onClick={resetFocus}>
        <StopIcon size={12} color="currentColor" />
      </button>
    </div>
  )
}
