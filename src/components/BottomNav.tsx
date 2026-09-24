import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  DollarIcon,
  GridIcon,
  MessageIcon,
  PeopleIcon,
  PlayIcon,
  PresentationIcon,
  SearchIcon,
  SettingsGearIcon,
  StopIcon,
} from './icons'
import { CURRENT_USER_ID, people } from '../data/people'

interface AppDef {
  key: string
  label: string
  to: string
  icon: (color: string) => JSX.Element
}

const apps: AppDef[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: (c) => <GridIcon size={16} color={c} /> },
  { key: 'time', label: 'Time', to: '/time', icon: (c) => <ClockIcon size={16} color={c} /> },
  { key: 'hr', label: 'HR', to: '/hr/leave', icon: (c) => <BellIcon size={16} color={c} /> },
  { key: 'payroll', label: 'Payroll', to: '/payroll', icon: (c) => <DollarIcon size={16} color={c} /> },
  { key: 'projects', label: 'Projects', to: '/projects', icon: (c) => <PresentationIcon size={16} color={c} /> },
  { key: 'people', label: 'People', to: '/people', icon: (c) => <PeopleIcon size={16} color={c} /> },
  { key: 'calendar', label: 'Calendar', to: '/calendar', icon: (c) => <CalendarIcon size={16} color={c} /> },
  { key: 'analytics', label: 'Analytics', to: '/analytics', icon: (c) => <ChartIcon size={16} color={c} /> },
]

function activeAppKey(pathname: string): string {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/hr')) return 'hr'
  if (pathname.startsWith('/people')) return 'people'
  if (pathname.startsWith('/time')) return 'time'
  if (pathname.startsWith('/payroll')) return 'payroll'
  if (pathname.startsWith('/projects')) return 'projects'
  if (pathname.startsWith('/calendar')) return 'calendar'
  if (pathname.startsWith('/analytics')) return 'analytics'
  return ''
}

function formatStopwatch(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeAppKey(location.pathname)
  const currentUser = people.find((p) => p.id === CURRENT_USER_ID)!

  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(true)
  const [seconds, setSeconds] = useState(0)

  const switcherRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setAppSwitcherOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return people
      .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query])

  function goToSearchResult(id: string) {
    setSearchOpen(false)
    setQuery('')
    navigate(`/people/${id}`)
  }

  return (
    <>
      <nav className="bottom-nav">
        {/* Left segment */}
        <div className="bn-segment bn-segment-left">
          <div className="bn-bar bn-bar-left">
            <Link to="/" className="bn-brand">
              <span className="bn-brand-mark">B</span>
              <span className="bn-brand-text">Type B OS</span>
            </Link>

            <div ref={switcherRef} style={{ position: 'relative' }}>
              <button
                className="bn-icon-btn"
                aria-label="All apps"
                aria-expanded={appSwitcherOpen}
                onClick={() => setAppSwitcherOpen((v) => !v)}
              >
                <GridIcon size={16} color="rgba(255,255,255,0.7)" />
              </button>
              {appSwitcherOpen && (
                <div className="bn-popover bn-popover-up" style={{ left: 0 }}>
                  <div className="bn-popover-title">All apps</div>
                  {apps.map((a) => (
                    <Link
                      key={a.key}
                      to={a.to}
                      className="bn-popover-row"
                      onClick={() => setAppSwitcherOpen(false)}
                    >
                      {a.icon('rgba(255,255,255,0.75)')}
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button className="bn-icon-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
              <SearchIcon size={16} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
        </div>

        {/* Center segment */}
        <div className="bn-segment bn-segment-center">
          <div className="bn-bar bn-bar-center">
            {apps.map((a) =>
              a.key === active ? (
                <Link key={a.key} to={a.to} className="bn-app-active">
                  {a.icon('#0f0f10')}
                  {a.label}
                </Link>
              ) : (
                <Link key={a.key} to={a.to} className="bn-icon-btn" aria-label={a.label} title={a.label}>
                  {a.icon('rgba(255,255,255,0.7)')}
                </Link>
              ),
            )}
          </div>
        </div>

        {/* Right segment */}
        <div className="bn-segment bn-segment-right">
          <div className="bn-bar bn-bar-right">
            <div className="bn-timer">
              <ClockIcon size={14} color="#171717" />
              <span className="mono">{formatStopwatch(seconds)}</span>
              <button
                className="bn-timer-toggle"
                aria-label={running ? 'Pause timer' : 'Start timer'}
                onClick={() => setRunning((r) => !r)}
              >
                {running ? <StopIcon size={13} color="#171717" /> : <PlayIcon size={13} color="#171717" />}
              </button>
            </div>

            <Link to="/settings" className="bn-icon-btn" aria-label="Settings" title="Settings">
              <SettingsGearIcon size={16} color="rgba(255,255,255,0.7)" />
            </Link>

            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="bn-icon-btn"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((v) => !v)}
              >
                <BellIcon size={16} color="rgba(255,255,255,0.7)" />
              </button>
              {notifOpen && (
                <div className="bn-popover bn-popover-up" style={{ right: 0, left: 'auto', width: 220 }}>
                  <div className="bn-popover-title">Notifications</div>
                  <div style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                    You're all caught up.
                  </div>
                </div>
              )}
            </div>

            <Link to="/messages" className="bn-icon-btn" aria-label="Messages" title="Messages">
              <MessageIcon size={16} color="rgba(255,255,255,0.7)" />
            </Link>

            <Link to={`/people/${currentUser.id}`} className="bn-avatar" aria-label="My profile" title={currentUser.name}>
              {currentUser.initials}
            </Link>
          </div>
        </div>
      </nav>

      {searchOpen && (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
            <input
              autoFocus
              className="input"
              placeholder="Search people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goToSearchResult(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', textAlign: 'left', borderRadius: 8 }}
                >
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{p.initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.53)' }}>{p.title || p.email}</div>
                  </div>
                </button>
              ))}
              {query.trim() && results.length === 0 && (
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '8px 6px' }}>No matches.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
