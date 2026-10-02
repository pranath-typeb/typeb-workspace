import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  DatabaseIcon,
  DollarSignIcon,
  GridIcon,
  LogOutIcon,
  MessageIcon,
  MonitorIcon,
  MoonIcon,
  PeopleIcon,
  PinIcon,
  PlayIcon,
  PresentationIcon,
  SearchIcon,
  SettingsGearIcon,
  StopIcon,
  SunIcon,
  TagIcon,
  TimerActivityIcon,
  WalletIcon,
} from './icons'
import { avatarContent } from './Avatar'
import { CURRENT_USER_ID, usePeople } from '../data/people'
import { useProjects } from '../data/projects'
import { CATEGORIES } from '../data/timeEntries'
import { showToast } from '../data/toast'
import { useNavPinned, useNavPosition, type NavPosition } from '../data/navPosition'
import { togglePinnedApp, usePinnedApps } from '../data/pinnedApps'
import { setTimerBillable, setTimerCategory, setTimerDescription, setTimerProjectId, stopAndSaveTimer, toggleTimerRunning, useTimerState } from '../data/timer'
import { triggerScreenRipple } from '../data/screenRipple'
import { setTheme, useTheme, type Theme } from '../data/theme'

interface AppDef {
  key: string
  label: string
  description: string
  to: string
  icon: (color: string) => JSX.Element
}

const apps: AppDef[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Your day at a glance', to: '/', icon: (c) => <GridIcon size={16} color={c} /> },
  { key: 'time', label: 'Time', description: 'Track hours and timesheets', to: '/time', icon: (c) => <ClockIcon size={16} color={c} /> },
  { key: 'hr', label: 'HR', description: 'Leave, policies, people ops', to: '/hr/leave', icon: (c) => <BellIcon size={16} color={c} /> },
  { key: 'payroll', label: 'Payroll', description: 'Runs, payslips and reviews', to: '/payroll', icon: (c) => <WalletIcon size={16} color={c} /> },
  { key: 'projects', label: 'Projects', description: 'Delivery and staffing', to: '/projects', icon: (c) => <PresentationIcon size={16} color={c} /> },
  { key: 'people', label: 'People', description: 'Directory and org', to: '/people', icon: (c) => <PeopleIcon size={16} color={c} /> },
  { key: 'calendar', label: 'Calendar', description: 'Company-wide', to: '/calendar', icon: (c) => <CalendarIcon size={16} color={c} /> },
  { key: 'analytics', label: 'Analytics', description: 'Capacity and utilisation', to: '/analytics', icon: (c) => <ChartIcon size={16} color={c} /> },
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

// Computes where a popover should open relative to its trigger, given the current
// bar position. alignH/alignV describe the trigger's natural corner within a
// horizontal (top/bottom) vs vertical (left/right) bar so the popover doesn't run offscreen.
function popoverStyle(navPos: NavPosition, alignH: 'left' | 'right', alignV: 'top' | 'bottom'): CSSProperties {
  if (navPos === 'left') return alignV === 'top' ? { left: 44, top: 0 } : { left: 44, bottom: 0, top: 'auto' }
  if (navPos === 'right') return alignV === 'top' ? { right: 44, left: 'auto', top: 0 } : { right: 44, left: 'auto', bottom: 0, top: 'auto' }
  if (navPos === 'top') return alignH === 'left' ? { top: 44, left: 0 } : { top: 44, right: 0, left: 'auto' }
  return alignH === 'left' ? { bottom: 44, left: 0 } : { bottom: 44, right: 0, left: 'auto' }
}

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeAppKey(location.pathname)
  const navPos = useNavPosition()
  const navPinned = useNavPinned()
  const [revealed, setRevealed] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const people = usePeople()
  const currentUser = people.find((p) => p.id === CURRENT_USER_ID)!
  const projects = useProjects()
  const pinnedApps = usePinnedApps()

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
  const { running, seconds, description: timerDescription, projectId: timerProjectId, category: timerCategory, billable: timerBillable } = useTimerState()
  const theme = useTheme()
  const [feedbackText, setFeedbackText] = useState('')

  const notifRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.setAttribute('data-navpos', navPos)
  }, [navPos])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (timerRef.current && !timerRef.current.contains(e.target as Node)) setTimerPopupOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (feedbackRef.current && !feedbackRef.current.contains(e.target as Node)) setFeedbackOpen(false)
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

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  function showNav() {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setRevealed(true)
  }

  function scheduleHideNav() {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => setRevealed(false), 250)
  }

  const anyPopoverOpen = appSwitcherOpen || searchOpen || notifOpen || timerPopupOpen || profileOpen || feedbackOpen
  const navVisible = navPinned || revealed || anyPopoverOpen

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return people
      .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, people])

  const filteredApps = useMemo(() => {
    const q = appFilter.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((a) => a.label.toLowerCase().includes(q))
  }, [appFilter])

  const searchedApps = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return apps.filter((a) => a.label.toLowerCase().includes(q))
  }, [query])

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
    if (stopAndSaveTimer()) {
      setTimerPopupOpen(false)
      triggerScreenRipple()
    }
  }

  function chooseTheme(next: Theme) {
    setTheme(next)
  }

  function signOut() {
    setProfileOpen(false)
    navigate('/login')
  }

  function submitFeedback() {
    if (!feedbackText.trim()) return
    showToast("Thanks for the feedback — it shapes what we build next", 'success')
    setFeedbackText('')
    setFeedbackOpen(false)
  }

  return (
    <>
      {!navPinned && (
        <div
          className={`bn-hot-edge bn-hot-edge-${navPos}`}
          onMouseEnter={showNav}
        />
      )}
      <nav
        className={`bottom-nav pos-${navPos}${!navPinned ? ' auto-hide' : ''}${navVisible ? ' revealed' : ''}`}
        onMouseEnter={navPinned ? undefined : showNav}
        onMouseLeave={navPinned ? undefined : scheduleHideNav}
      >
        {/* Left segment */}
        <div className="bn-segment bn-segment-left">
          <div className="bn-bar bn-bar-left">
            <Link to="/" className="bn-brand">
              <span className="bn-brand-mark">B</span>
              <span className="bn-brand-text">Type B OS</span>
            </Link>

            <button
              className="bn-icon-btn"
              aria-label="All apps"
              data-tooltip="All apps"
              aria-expanded={appSwitcherOpen}
              onClick={() => setAppSwitcherOpen(true)}
            >
              <GridIcon size={16} color="var(--nav-fg-muted)" />
            </button>

            <button className="bn-icon-btn" aria-label="Search" data-tooltip="Search" onClick={() => setSearchOpen(true)}>
              <SearchIcon size={16} color="var(--nav-fg-muted)" />
            </button>
          </div>
        </div>

        {/* Center segment */}
        <div className="bn-segment bn-segment-center">
          <div className="bn-bar bn-bar-center">
            {apps.filter((a) => pinnedApps.includes(a.key)).map((a) => {
              const isActive = a.key === active
              return (
                <Link
                  key={a.key}
                  to={a.to}
                  className={`bn-app-item${isActive ? ' active' : ''}`}
                  aria-label={isActive ? undefined : a.label}
                  data-tooltip={isActive ? undefined : a.label}
                >
                  {a.icon('currentColor')}
                  <span className="bn-app-item-label">{a.label}</span>
                </Link>
              )
            })}
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
                data-tooltip="Timer"
                onClick={() => setTimerPopupOpen((v) => !v)}
              >
                {running ? <TimerActivityIcon size={14} color="var(--nav-surface-fg)" /> : <ClockIcon size={14} color="var(--nav-surface-fg)" />}
                <span className="mono">{formatStopwatch(seconds)}</span>
                <button
                  className="bn-timer-toggle"
                  aria-label={running ? 'Pause timer' : 'Start timer'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTimerRunning()
                    triggerScreenRipple()
                  }}
                >
                  {running ? <StopIcon size={16} color="var(--nav-surface-fg)" /> : <PlayIcon size={16} color="var(--nav-surface-fg)" />}
                </button>
              </div>
              {timerPopupOpen && (
                <div className="bn-popover bn-popover-up" style={popoverStyle(navPos, 'right', 'bottom')}>
                  <div className="bn-timer-popup">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {running && <TimerActivityIcon size={16} color="#00b3a6" />}
                        <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--nav-fg)' }}>{formatStopwatch(seconds)}</span>
                      </span>
                      <button
                        onClick={() => {
                          toggleTimerRunning()
                          triggerScreenRipple()
                        }}
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label className="bn-timer-field-label">Project</label>
                        <select className="bn-timer-input" value={timerProjectId} onChange={(e) => setTimerProjectId(e.target.value)}>
                          <option value="">Select…</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ position: 'relative', width: 40, height: 36, flexShrink: 0 }}>
                        <select
                          className="bn-timer-input"
                          value={timerCategory}
                          onChange={(e) => setTimerCategory(e.target.value)}
                          aria-label="Category"
                          title={`Category: ${timerCategory}`}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', padding: 0 }}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <div style={{ width: 40, height: 36, borderRadius: 10, background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <TagIcon size={16} color="#ebebeb" />
                        </div>
                      </div>
                      <button
                        onClick={() => setTimerBillable(!timerBillable)}
                        aria-label="Billable"
                        title={timerBillable ? 'Billable' : 'Non-billable'}
                        style={{ width: 40, height: 36, borderRadius: 10, flexShrink: 0, background: timerBillable ? '#005c59' : '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.15s ease' }}
                      >
                        <DollarSignIcon size={16} color="#ebebeb" />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #262626', paddingTop: 10 }}>
                      <Link
                        to="/time"
                        onClick={() => setTimerPopupOpen(false)}
                        className="bn-icon-btn"
                        style={{ width: 'auto', height: 32, padding: '0 12px', fontSize: 13, fontWeight: 600, color: 'var(--nav-fg)' }}
                      >
                        Open Time
                      </Link>
                      <button
                        onClick={stopAndSave}
                        style={{ background: 'var(--nav-hover-strong)', color: 'var(--nav-fg)', fontSize: 13, fontWeight: 600, padding: '0 12px', height: 32, borderRadius: 8 }}
                      >
                        Stop & save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link to="/settings" className="bn-icon-btn" aria-label="Settings" data-tooltip="Settings">
              <SettingsGearIcon size={16} color="var(--nav-fg-muted)" />
            </Link>

            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="bn-icon-btn"
                aria-label="Notifications"
                data-tooltip="Notifications"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((v) => !v)}
                style={{ position: 'relative' }}
              >
                <BellIcon size={16} color="var(--nav-fg-muted)" />
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
                <div className="bn-popover bn-popover-up" style={{ ...popoverStyle(navPos, 'right', 'bottom'), width: 300 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="bn-popover-title">Notifications</div>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ fontSize: 12, fontWeight: 600, color: 'var(--nav-fg-muted)' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {notifications.map((n) => (
                      <div key={n.id} className="bn-notif-row">
                        <span className={`bn-notif-dot${unread.has(n.id) ? '' : ' read'}`} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--nav-fg)' }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--nav-fg-subtle)', marginTop: 2 }}>{n.body}</div>
                          <div style={{ fontSize: 10, color: 'var(--nav-fg-faint-2)', marginTop: 4 }}>{n.timeAgo}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div ref={feedbackRef} style={{ position: 'relative' }}>
              <button
                className="bn-icon-btn"
                aria-label="Feedback"
                data-tooltip="Feedback"
                aria-expanded={feedbackOpen}
                onClick={() => setFeedbackOpen((v) => !v)}
              >
                <MessageIcon size={16} color="var(--nav-fg-muted)" />
              </button>
              {feedbackOpen && (
                <div className="bn-popover bn-popover-up" style={{ ...popoverStyle(navPos, 'right', 'bottom'), width: 340, padding: 16 }}>
                  <div className="bn-feedback-popup">
                    <textarea
                      autoFocus
                      className="bn-feedback-textarea"
                      placeholder="Type your feedback here."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--nav-fg-subtle)' }}>
                        We don't respond individually, but your feedback shapes what we build next.
                      </div>
                      <button
                        style={{
                          flexShrink: 0,
                          height: 36,
                          padding: '0 16px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          background: 'var(--nav-fg)',
                          color: 'var(--nav-popover-bg)',
                          opacity: feedbackText.trim() ? 1 : 0.45,
                          cursor: feedbackText.trim() ? 'pointer' : 'not-allowed',
                        }}
                        disabled={!feedbackText.trim()}
                        onClick={submitFeedback}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                className="bn-avatar"
                aria-label="My profile"
                data-tooltip={currentUser.name}
                onClick={() => setProfileOpen((v) => !v)}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {avatarContent(currentUser)}
              </button>
              {profileOpen && (
                <div className="bn-popover bn-popover-up" style={{ ...popoverStyle(navPos, 'right', 'bottom'), width: 260 }}>
                  <Link to={`/people/${currentUser.id}`} className="bn-profile-header" onClick={() => setProfileOpen(false)}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(currentUser)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--nav-fg)' }}>{currentUser.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--nav-fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</div>
                    </div>
                  </Link>

                  <Link to="/settings" className="bn-popover-row" onClick={() => setProfileOpen(false)}>
                    <SettingsGearIcon size={16} color="var(--nav-fg-muted)" /> Settings
                  </Link>
                  <button
                    className="bn-popover-row"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setProfileOpen(false)
                      showToast("Data export/import isn't wired up in this build", 'info')
                    }}
                  >
                    <DatabaseIcon size={16} color="var(--nav-fg-muted)" /> Data
                  </button>
                  <button
                    className="bn-popover-row"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setProfileOpen(false)
                      setFeedbackOpen(true)
                    }}
                  >
                    <MessageIcon size={16} color="var(--nav-fg-muted)" /> Send feedback
                  </button>
                  <button className="bn-popover-row" style={{ width: '100%' }} onClick={signOut}>
                    <LogOutIcon size={16} color="var(--nav-fg-muted)" /> Sign out
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

      {appSwitcherOpen && (
        <div
          className="modal-backdrop search-backdrop"
          onClick={() => {
            setAppSwitcherOpen(false)
            setAppFilter('')
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 768, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#a1a1a1' }}>Apps</div>
              <input
                autoFocus
                value={appFilter}
                onChange={(e) => setAppFilter(e.target.value)}
                placeholder="Type to filter apps..."
                style={{
                  width: '100%',
                  height: 51,
                  border: '1px solid #ebebeb',
                  borderRadius: 16,
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#1b1b1f',
                  fontFamily: 'Manrope, sans-serif',
                  letterSpacing: '-0.28px',
                  background: '#ffffff',
                  outline: 'none',
                  boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px #0f172a',
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {filteredApps.map((a) => {
                const pinned = pinnedApps.includes(a.key)
                return (
                  <Link
                    key={a.key}
                    to={a.to}
                    onClick={() => {
                      setAppSwitcherOpen(false)
                      setAppFilter('')
                    }}
                    className="app-overlay-tile"
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                      <div className="app-overlay-tile-icon">{a.icon('#1b1b1f')}</div>
                      <button
                        className={`app-overlay-tile-pin${pinned ? ' pinned' : ''}`}
                        aria-label={pinned ? `Unpin ${a.label}` : `Pin ${a.label}`}
                        aria-pressed={pinned}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          togglePinnedApp(a.key)
                        }}
                      >
                        <PinIcon size={13} filled={pinned} color={pinned ? '#00736f' : '#a1a1a1'} />
                      </button>
                    </div>
                    <span className="app-overlay-tile-label">{a.label}</span>
                  </Link>
                )
              })}
              {filteredApps.length === 0 && (
                <div style={{ gridColumn: '1 / -1', fontSize: 13, color: '#7e8085', padding: '8px 4px' }}>No apps match.</div>
              )}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#7e8085', letterSpacing: '-0.12px' }}>Esc to close · type to filter</div>
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="modal-backdrop search-backdrop" onClick={() => setSearchOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 576,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 48px)',
              background: '#ffffff',
              border: '1px solid #ebebeb',
              borderRadius: 12,
              boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.06), 0px 12px 32px 0px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ borderBottom: '1px solid #ebebeb', padding: '10px 14px', flexShrink: 0 }}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps, people, projects, policies…"
                style={{
                  width: '100%',
                  height: 40,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#1b1b1f',
                  fontFamily: 'Manrope, sans-serif',
                  letterSpacing: '-0.28px',
                }}
              />
            </div>
            <div style={{ padding: 6, overflowY: 'auto' }}>
              {!query.trim() ? (
                <div>
                  <div className="search-section-label">Apps</div>
                  {apps.map((a) => (
                    <Link key={a.key} to={a.to} onClick={() => setSearchOpen(false)} className="search-row">
                      {a.icon('#1b1b1f')}
                      <span className="search-row-title">{a.label}</span>
                      <span className="search-row-desc">{a.description}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <>
                  {searchedApps.length > 0 && (
                    <div>
                      <div className="search-section-label">Apps</div>
                      {searchedApps.map((a) => (
                        <Link key={a.key} to={a.to} onClick={() => setSearchOpen(false)} className="search-row">
                          {a.icon('#1b1b1f')}
                          <span className="search-row-title">{a.label}</span>
                          <span className="search-row-desc">{a.description}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {results.length > 0 && (
                    <div>
                      <div className="search-section-label">People</div>
                      {results.map((p) => (
                        <button key={p.id} onClick={() => goToSearchResult(p.id)} className="search-row">
                          <div className="avatar" style={{ width: 20, height: 20, fontSize: 9, flexShrink: 0 }}>{avatarContent(p)}</div>
                          <span className="search-row-title">{p.name}</span>
                          <span className="search-row-desc">{p.title ? `${p.title} · ${p.department ?? ''}`.replace(/ · $/, '') : p.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchedApps.length === 0 && results.length === 0 && (
                    <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 12, color: 'rgba(0,0,17,0.53)' }}>
                      Nothing matched to &ldquo;{query.trim()}&rdquo;
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  )
}
