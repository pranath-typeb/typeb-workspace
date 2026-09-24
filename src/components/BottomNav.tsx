import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  CloseIcon,
  DatabaseIcon,
  DollarIcon,
  GridIcon,
  LogOutIcon,
  MessageIcon,
  MonitorIcon,
  MoonIcon,
  PeopleIcon,
  PlayIcon,
  PresentationIcon,
  SearchIcon,
  SettingsGearIcon,
  StopIcon,
  SunIcon,
} from './icons'
import { CURRENT_USER_ID, people } from '../data/people'
import { useProjects } from '../data/projects'
import { showToast } from '../data/toast'

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

interface NotificationDef {
  id: string
  title: string
  body: string
  timeAgo: string
}

const initialNotifications: NotificationDef[] = [
  { id: 'n1', title: 'Submit your week', body: 'Friday reminder — submit any weeks still awaiting submission.', timeAgo: '34 minutes ago' },
  { id: 'n2', title: 'Timesheet sent back', body: 'Hashan Wijesinghe asked for changes to one of your weeks.', timeAgo: '1 day ago' },
  { id: 'n3', title: 'New policy to acknowledge', body: 'Remote & Hybrid Work v4.2 needs your acknowledgement.', timeAgo: '2 days ago' },
  { id: 'n4', title: 'Timesheet approved', body: 'Your timesheet for Aug 26 – Sep 1 has been approved.', timeAgo: '3 days ago' },
  { id: 'n5', title: 'Leave request updated', body: 'Your PTO request was approved.', timeAgo: '4 days ago' },
  { id: 'n6', title: 'Benefits enrollment open', body: 'Annual benefits enrollment is now open — review your options by Sep 30.', timeAgo: '1 week ago' },
]

type Theme = 'light' | 'dark' | 'auto'
const THEME_KEY = 'typeb-hr.theme.v1'

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

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme === 'auto' ? 'light' : theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeAppKey(location.pathname)
  const currentUser = people.find((p) => p.id === CURRENT_USER_ID)!
  const projects = useProjects()

  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [timerPopupOpen, setTimerPopupOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const [appFilter, setAppFilter] = useState('')
  const [query, setQuery] = useState('')
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unread, setUnread] = useState<Set<string>>(new Set(initialNotifications.map((n) => n.id)))
  const [running, setRunning] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [timerDescription, setTimerDescription] = useState('')
  const [timerProjectId, setTimerProjectId] = useState('')
  const [theme, setTheme] = useState<Theme>('light')
  const [feedbackText, setFeedbackText] = useState('')

  const switcherRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let saved: Theme = 'light'
    try {
      saved = (localStorage.getItem(THEME_KEY) as Theme) || 'light'
    } catch {
      // ignore
    }
    setTheme(saved)
    applyTheme(saved)
  }, [])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setAppSwitcherOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (timerRef.current && !timerRef.current.contains(e.target as Node)) setTimerPopupOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setAppSwitcherOpen(false)
      setNotifOpen(false)
      setTimerPopupOpen(false)
      setProfileOpen(false)
      setSearchOpen(false)
      setFeedbackOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return people
      .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query])

  const filteredApps = useMemo(() => {
    const q = appFilter.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((a) => a.label.toLowerCase().includes(q))
  }, [appFilter])

  const unreadCount = unread.size

  function goToSearchResult(id: string) {
    setSearchOpen(false)
    setQuery('')
    navigate(`/people/${id}`)
  }

  function markAllRead() {
    setUnread(new Set())
    showToast('All notifications marked as read', 'success')
  }

  function stopAndSave() {
    const project = projects.find((p) => p.id === timerProjectId)
    const label = timerDescription.trim() || 'Untitled entry'
    showToast(`Saved ${formatStopwatch(seconds)} — ${label}${project ? ` on ${project.name}` : ''}`, 'success')
    setRunning(false)
    setSeconds(0)
    setTimerDescription('')
    setTimerProjectId('')
    setTimerPopupOpen(false)
  }

  function chooseTheme(next: Theme) {
    setTheme(next)
    applyTheme(next)
    if (next === 'light') {
      showToast('Light theme applied', 'success')
    } else {
      showToast(`${next === 'dark' ? 'Dark' : 'Auto'} theme is a partial preview in this build — most screens stay light`, 'info')
    }
  }

  function signOut() {
    setProfileOpen(false)
    showToast('Signed out (demo only — this build has no real auth)', 'info')
  }

  function submitFeedback() {
    if (!feedbackText.trim()) return
    showToast("Thanks for the feedback — it shapes what we build next", 'success')
    setFeedbackText('')
    setFeedbackOpen(false)
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
                <div className="bn-popover bn-popover-up" style={{ left: 0, width: 300 }}>
                  <input
                    autoFocus
                    className="bn-popover-input"
                    placeholder="Type to filter apps…"
                    value={appFilter}
                    onChange={(e) => setAppFilter(e.target.value)}
                  />
                  <div className="bn-app-grid">
                    {filteredApps.map((a) => (
                      <Link
                        key={a.key}
                        to={a.to}
                        className="bn-app-tile"
                        onClick={() => {
                          setAppSwitcherOpen(false)
                          setAppFilter('')
                        }}
                      >
                        <div className="bn-app-tile-icon">{a.icon('rgba(255,255,255,0.8)')}</div>
                        <span className="bn-app-tile-label">{a.label}</span>
                      </Link>
                    ))}
                    {filteredApps.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '8px 4px' }}>No apps match.</div>
                    )}
                  </div>
                  <div className="bn-popover-hint">Esc to close · type to filter</div>
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
            <div ref={timerRef} style={{ position: 'relative' }}>
              <div
                className="bn-timer"
                role="button"
                tabIndex={0}
                aria-expanded={timerPopupOpen}
                onClick={() => setTimerPopupOpen((v) => !v)}
              >
                <ClockIcon size={14} color="#171717" />
                <span className="mono">{formatStopwatch(seconds)}</span>
                <button
                  className="bn-timer-toggle"
                  aria-label={running ? 'Pause timer' : 'Start timer'}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRunning((r) => !r)
                  }}
                >
                  {running ? <StopIcon size={13} color="#171717" /> : <PlayIcon size={13} color="#171717" />}
                </button>
              </div>
              {timerPopupOpen && (
                <div className="bn-popover bn-popover-up" style={{ right: 0, left: 'auto' }}>
                  <div className="bn-timer-popup">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: '#fafafa' }}>{formatStopwatch(seconds)}</span>
                      <button
                        onClick={() => setRunning((r) => !r)}
                        style={{ background: '#005c59', color: '#ebebeb', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8 }}
                      >
                        {running ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                    <div>
                      <label className="bn-timer-field-label">Description</label>
                      <input
                        className="bn-timer-input"
                        placeholder="What are you working on?"
                        value={timerDescription}
                        onChange={(e) => setTimerDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="bn-timer-field-label">Project</label>
                      <select className="bn-timer-input" value={timerProjectId} onChange={(e) => setTimerProjectId(e.target.value)}>
                        <option value="">Select…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #262626', paddingTop: 10 }}>
                      <Link
                        to="/time"
                        onClick={() => setTimerPopupOpen(false)}
                        className="bn-icon-btn"
                        style={{ width: 'auto', height: 32, padding: '0 12px', fontSize: 13, fontWeight: 600, color: '#fafafa' }}
                      >
                        Open Time
                      </Link>
                      <button
                        onClick={stopAndSave}
                        style={{ background: '#0f0f10', color: '#ebebeb', fontSize: 13, fontWeight: 600, padding: '0 12px', height: 32, borderRadius: 8 }}
                      >
                        Stop & save
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                style={{ position: 'relative' }}
              >
                <BellIcon size={16} color="rgba(255,255,255,0.7)" />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ff4800',
                      border: '2px solid #0a0a0a',
                    }}
                  />
                )}
              </button>
              {notifOpen && (
                <div className="bn-popover bn-popover-up" style={{ right: 0, left: 'auto', width: 300 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="bn-popover-title">Notifications</div>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {notifications.map((n) => (
                      <div key={n.id} className="bn-notif-row">
                        <span className={`bn-notif-dot${unread.has(n.id) ? '' : ' read'}`} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{n.body}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{n.timeAgo}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link to="/messages" className="bn-icon-btn" aria-label="Messages" title="Messages">
              <MessageIcon size={16} color="rgba(255,255,255,0.7)" />
            </Link>

            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                className="bn-avatar"
                aria-label="My profile"
                title={currentUser.name}
                onClick={() => setProfileOpen((v) => !v)}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {currentUser.initials}
              </button>
              {profileOpen && (
                <div className="bn-popover bn-popover-up" style={{ right: 0, left: 'auto', width: 260 }}>
                  <Link to={`/people/${currentUser.id}`} className="bn-profile-header" onClick={() => setProfileOpen(false)}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{currentUser.initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{currentUser.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</div>
                    </div>
                  </Link>

                  <Link to="/settings" className="bn-popover-row" onClick={() => setProfileOpen(false)}>
                    <SettingsGearIcon size={16} color="rgba(255,255,255,0.75)" /> Settings
                  </Link>
                  <button
                    className="bn-popover-row"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setProfileOpen(false)
                      showToast("Data export/import isn't wired up in this build", 'info')
                    }}
                  >
                    <DatabaseIcon size={16} color="rgba(255,255,255,0.75)" /> Data
                  </button>
                  <button
                    className="bn-popover-row"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setProfileOpen(false)
                      setFeedbackOpen(true)
                    }}
                  >
                    <MessageIcon size={16} color="rgba(255,255,255,0.75)" /> Send feedback
                  </button>
                  <button className="bn-popover-row" style={{ width: '100%' }} onClick={signOut}>
                    <LogOutIcon size={16} color="rgba(255,255,255,0.75)" /> Sign out
                  </button>

                  <div style={{ borderTop: '1px solid #262626', marginTop: 6, paddingTop: 10 }}>
                    <div className="bn-popover-title" style={{ padding: '0 8px 6px' }}>Theme</div>
                    <div className="bn-theme-row">
                      <button className={`bn-theme-pill${theme === 'light' ? ' active' : ''}`} onClick={() => chooseTheme('light')}>
                        <SunIcon color="currentColor" /> Light
                      </button>
                      <button className={`bn-theme-pill${theme === 'dark' ? ' active' : ''}`} onClick={() => chooseTheme('dark')}>
                        <MoonIcon color="currentColor" /> Dark
                      </button>
                      <button className={`bn-theme-pill${theme === 'auto' ? ' active' : ''}`} onClick={() => chooseTheme('auto')}>
                        <MonitorIcon color="currentColor" /> Auto
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {searchOpen && (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
            <input
              autoFocus
              className="input"
              placeholder="Search apps, people, projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {!query.trim() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="field-label" style={{ margin: '4px 0 2px' }}>Apps</div>
                {apps.map((a) => (
                  <Link
                    key={a.key}
                    to={a.to}
                    onClick={() => setSearchOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 8 }}
                  >
                    {a.icon('#0f0f10')}
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</span>
                  </Link>
                ))}
              </div>
            ) : (
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
                {results.length === 0 && (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', padding: '8px 6px' }}>No matches.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {feedbackOpen && (
        <div className="modal-backdrop" onClick={() => setFeedbackOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="serif" style={{ fontSize: 18, letterSpacing: '-0.5px' }}>Send feedback</div>
              <button onClick={() => setFeedbackOpen(false)} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloseIcon color="rgba(0,0,0,0.53)" />
              </button>
            </div>
            <textarea
              autoFocus
              className="input"
              style={{ height: 90, alignItems: 'flex-start', paddingTop: 10, resize: 'vertical' }}
              placeholder="Type your feedback here."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>We don't respond individually, but this shapes what we build next.</div>
              <button className="btn-dark" disabled={!feedbackText.trim()} onClick={submitFeedback}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
