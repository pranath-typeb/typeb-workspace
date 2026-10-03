import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BellIcon,
  ChevronRightIcon,
  GridIcon,
  LogOutIcon,
  MessageIcon,
  MonitorIcon,
  MoonIcon,
  PlayIcon,
  SearchIcon,
  SettingsGearIcon,
  StopIcon,
  SunIcon,
  TimerActivityIcon,
} from './icons'
import { avatarContent } from './Avatar'
import { CURRENT_USER_ID, usePeople } from '../data/people'
import { toggleTimerRunning, useTimerState } from '../data/timer'
import { triggerScreenRipple } from '../data/screenRipple'
import { setTheme, useTheme } from '../data/theme'
import { showToast } from '../data/toast'

interface MobileApp {
  key: string
  label: string
  to: string
  icon: (color: string) => JSX.Element
}

interface MobileNotification {
  id: string
  title: string
  body: string
  timeAgo: string
}

interface Props {
  apps: MobileApp[]
  pinnedKeys: string[]
  activeKey: string
  notifications: MobileNotification[]
  unread: Set<string>
  onMarkAllRead: () => void
  onOpenSearch: () => void
}

const MAX_TABS = 4

function formatStopwatch(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

// Phone-width navigation: a docked tab bar with labelled primary destinations plus a
// "More" sheet that holds everything the desktop dock spreads across three segments
// (all apps, search, notifications, settings, theme, profile). Hidden above 640px via CSS.
export default function MobileNav({ apps, pinnedKeys, activeKey, notifications, unread, onMarkAllRead, onOpenSearch }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const people = usePeople()
  const currentUser = people.find((p) => p.id === CURRENT_USER_ID)!
  const { running, seconds } = useTimerState()
  const theme = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  const tabs = apps.filter((a) => pinnedKeys.includes(a.key)).slice(0, MAX_TABS)
  const activeInTabs = tabs.some((t) => t.key === activeKey)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) {
      setNotifsOpen(false)
      setFeedbackOpen(false)
    }
  }, [moreOpen])

  useEffect(() => {
    if (!moreOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [moreOpen])

  function openThen(fn: () => void) {
    setMoreOpen(false)
    fn()
  }

  const themeOptions: Array<{ value: 'light' | 'dark' | 'auto'; label: string; icon: ReactNode }> = [
    { value: 'light', label: 'Light', icon: <SunIcon color="currentColor" /> },
    { value: 'dark', label: 'Dark', icon: <MoonIcon color="currentColor" /> },
    { value: 'auto', label: 'Auto', icon: <MonitorIcon color="currentColor" /> },
  ]

  return (
    <div className="mn-root">
      {running && !moreOpen && (
        <div className="mn-timer-pill">
          <Link to="/time" className="mn-timer-link" aria-label="Open Time">
            <TimerActivityIcon size={14} color="currentColor" />
            <span className="mono">{formatStopwatch(seconds)}</span>
          </Link>
          <button
            className="mn-timer-stop"
            aria-label="Pause timer"
            onClick={() => {
              toggleTimerRunning()
              triggerScreenRipple()
            }}
          >
            <StopIcon size={14} color="currentColor" />
          </button>
        </div>
      )}

      <nav className="mn-bar" aria-label="Primary">
        {tabs.map((a) => {
          const isActive = a.key === activeKey
          return (
            <Link key={a.key} to={a.to} className={`mn-tab${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined}>
              <span className="mn-tab-icon">{a.icon('currentColor')}</span>
              <span className="mn-tab-label">{a.label}</span>
            </Link>
          )
        })}
        <button
          className={`mn-tab${moreOpen || (!activeInTabs && activeKey) ? ' active' : ''}`}
          aria-expanded={moreOpen}
          aria-label="More"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="mn-tab-icon">
            <GridIcon size={16} color="currentColor" />
            {unread.size > 0 && <span className="mn-dot" />}
          </span>
          <span className="mn-tab-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="mn-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="mn-sheet" role="dialog" aria-label="More">
            <div className="mn-grabber" />

            <Link to={`/people/${currentUser.id}`} className="mn-profile">
              <div className="avatar" style={{ width: 40, height: 40, fontSize: 13 }}>{avatarContent(currentUser)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mn-profile-name">{currentUser.name}</div>
                <div className="mn-profile-sub">{currentUser.email}</div>
              </div>
              <ChevronRightIcon size={16} color="var(--nav-fg-faint)" />
            </Link>

            <div className="mn-section-title">Apps</div>
            <div className="mn-apps">
              {apps.map((a) => (
                <Link key={a.key} to={a.to} className={`mn-app${a.key === activeKey ? ' active' : ''}`}>
                  <span className="mn-app-icon">{a.icon('currentColor')}</span>
                  <span className="mn-app-label">{a.label}</span>
                </Link>
              ))}
            </div>

            <div className="mn-rows">
              <button className="mn-row" onClick={() => openThen(onOpenSearch)}>
                <SearchIcon size={18} color="var(--nav-fg-muted)" />
                <span>Search people and apps</span>
              </button>

              <button className="mn-row" aria-expanded={notifsOpen} onClick={() => setNotifsOpen((v) => !v)}>
                <BellIcon size={18} color="var(--nav-fg-muted)" />
                <span style={{ flex: 1 }}>Notifications</span>
                {unread.size > 0 && <span className="mn-count">{unread.size}</span>}
              </button>
              {notifsOpen && (
                <div className="mn-notifs">
                  {unread.size > 0 && (
                    <button className="mn-link-btn" onClick={onMarkAllRead}>Mark all as read</button>
                  )}
                  {notifications.map((n) => (
                    <div key={n.id} className="mn-notif">
                      <div className="mn-notif-title">
                        {unread.has(n.id) && <span className="mn-notif-dot" />}
                        {n.title}
                      </div>
                      <div className="mn-notif-body">{n.body}</div>
                      <div className="mn-notif-time">{n.timeAgo}</div>
                    </div>
                  ))}
                </div>
              )}

              <Link to="/settings" className="mn-row">
                <SettingsGearIcon size={18} color="var(--nav-fg-muted)" />
                <span>Settings</span>
              </Link>
              <button className="mn-row" aria-expanded={feedbackOpen} onClick={() => setFeedbackOpen((v) => !v)}>
                <MessageIcon size={18} color="var(--nav-fg-muted)" />
                <span>Send feedback</span>
              </button>
              {feedbackOpen && (
                <div className="mn-feedback">
                  <textarea
                    className="mn-feedback-input"
                    placeholder="Type your feedback here."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  <button
                    className="mn-submit"
                    disabled={!feedbackText.trim()}
                    onClick={() => {
                      showToast('Thanks for the feedback — it shapes what we build next', 'success')
                      setFeedbackText('')
                      setFeedbackOpen(false)
                      setMoreOpen(false)
                    }}
                  >
                    Submit
                  </button>
                </div>
              )}
              {!running && (
                <button
                  className="mn-row"
                  onClick={() => {
                    toggleTimerRunning()
                    triggerScreenRipple()
                    setMoreOpen(false)
                  }}
                >
                  <PlayIcon size={18} color="var(--nav-fg-muted)" />
                  <span>Start timer</span>
                </button>
              )}
            </div>

            <div className="mn-section-title">Theme</div>
            <div className="mn-theme">
              {themeOptions.map((o) => (
                <button key={o.value} className={`mn-theme-btn${theme === o.value ? ' active' : ''}`} onClick={() => setTheme(o.value)}>
                  {o.icon} {o.label}
                </button>
              ))}
            </div>

            <button className="mn-row mn-signout" onClick={() => navigate('/login')}>
              <LogOutIcon size={18} color="currentColor" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
