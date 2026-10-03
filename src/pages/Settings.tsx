import { useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { avatarContent } from '../components/Avatar'
import { CURRENT_USER_ID, updatePerson, usePeople } from '../data/people'
import { setTheme, useTheme, type Theme } from '../data/theme'
import { showToast } from '../data/toast'
import Toggle from '../components/Toggle'
import { hapticsSupportLabel } from '../data/haptics'
import { feedback, playUiSound, updateUiSoundSettings, useUiSoundSettings, type UiSoundKind } from '../data/uiSounds'
import { useNavPosition, setNavPosition, useNavPinned, setNavPinned, type NavPosition } from '../data/navPosition'
import {
  BellIcon,
  EditIcon,
  LockIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PeopleIcon,
  SettingsGearIcon,
  SunIcon,
} from '../components/icons'

const NAV_POSITIONS: { key: NavPosition; label: string }[] = [
  { key: 'bottom', label: 'Bottom' },
  { key: 'top', label: 'Top' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
]

function NavPositionIcon({ position, active }: { position: NavPosition; active: boolean }) {
  const barStyle = { background: active ? 'var(--color-text-primary)' : 'var(--color-border-subtle)' }
  return (
    <svg width={40} height={28} viewBox="0 0 40 28" style={{ display: 'block' }}>
      <rect x="0.5" y="0.5" width="39" height="27" rx="4" fill="none" stroke="var(--color-border-subtle)" />
      {position === 'bottom' && <rect x="4" y="21" width="32" height="4" rx="2" style={barStyle} />}
      {position === 'top' && <rect x="4" y="3" width="32" height="4" rx="2" style={barStyle} />}
      {position === 'left' && <rect x="3" y="4" width="4" height="20" rx="2" style={barStyle} />}
      {position === 'right' && <rect x="33" y="4" width="4" height="20" rx="2" style={barStyle} />}
    </svg>
  )
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch${on ? ' on' : ''}`}
      onClick={onToggle}
    >
      <span className="switch-knob" />
    </button>
  )
}

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: PeopleIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
  { key: 'appearance', label: 'Appearance', icon: PaletteIcon },
  { key: 'security', label: 'Security', icon: LockIcon },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

function SettingsSidebar({ active, onChange }: { active: SectionKey; onChange: (k: SectionKey) => void }) {
  return (
    <>
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          className={active === s.key ? 'navitem' : 'navitem-sm'}
          style={{ width: '100%', textAlign: 'left' }}
          onClick={() => onChange(s.key)}
        >
          <s.icon size={16} color={active === s.key ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'} />
          <span className="navitem-label">{s.label}</span>
        </button>
      ))}
    </>
  )
}

export default function Settings() {
  const uiSound = useUiSoundSettings()
  const [section, setSection] = useState<SectionKey>('profile')
  const person = usePeople().find((p) => p.id === CURRENT_USER_ID)!

  const [name, setName] = useState(person.name)
  const [phone, setPhone] = useState(person.phone ?? '')
  const [city, setCity] = useState(person.city ?? '')
  const [timezone, setTimezone] = useState(person.timezone)

  const [emailDigest, setEmailDigest] = useState(true)
  const [timesheetReminders, setTimesheetReminders] = useState(true)
  const [mentions, setMentions] = useState(true)
  const [productUpdates, setProductUpdates] = useState(false)

  const navPos = useNavPosition()
  const navPinned = useNavPinned()

  const theme = useTheme()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const photoInputRef = useRef<HTMLInputElement>(null)

  function choosePhoto() {
    photoInputRef.current?.click()
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'danger')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updatePerson(CURRENT_USER_ID, { avatarUrl: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  const profileDirty =
    name.trim() !== person.name || phone.trim() !== (person.phone ?? '') || city.trim() !== (person.city ?? '') || timezone.trim() !== person.timezone

  function saveProfile() {
    updatePerson(CURRENT_USER_ID, { name: name.trim() || person.name, phone: phone.trim() || null, city: city.trim() || null, timezone: timezone.trim() || person.timezone })
    showToast('Profile updated', 'success')
  }

  function chooseTheme(next: Theme) {
    setTheme(next)
  }

  function chooseNavPosition(pos: NavPosition) {
    setNavPosition(pos)
    showToast(`Nav bar moved to ${pos}`, 'success')
  }

  function toggleNavPinned() {
    const next = !navPinned
    setNavPinned(next)
    showToast(next ? 'Nav bar pinned' : 'Nav bar will auto-hide', 'success')
  }

  function updatePassword() {
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation don't match", 'danger')
      return
    }
    showToast("Password updates aren't wired up in this build — no real auth here", 'info')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <AppShell appIcon={<SettingsGearIcon size={16} color="var(--color-text-secondary)" />} appLabel="Settings" appHref="/settings" sidebar={<SettingsSidebar active={section} onChange={setSection} />}>
      {section === 'profile' && (
        <>
          <div className="page-title">Profile</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                <div className="avatar" style={{ width: 48, height: 48, fontSize: 15 }}>{avatarContent(person)}</div>
                <button
                  onClick={choosePhoto}
                  aria-label="Change profile photo"
                  title="Change profile photo"
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--color-background-inverse)',
                    border: '2px solid var(--color-background-page)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <EditIcon size={10} color="var(--color-text-inverse)" />
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoSelected} style={{ display: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{person.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{person.title}</div>
              </div>
            </div>

            <div>
              <div className="field-label">Full name</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="field-label">Email</div>
              <input className="input" value={person.email} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <div className="field-label">Phone</div>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <div className="field-label">City</div>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>
            <div>
              <div className="field-label">Timezone</div>
              <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-dark" disabled={!profileDirty} onClick={saveProfile}>Save changes</button>
            </div>
          </div>
        </>
      )}

      {section === 'notifications' && (
        <>
          <div className="page-title">Notifications</div>
          <div className="card" style={{ maxWidth: 480 }}>
            <div className="settings-row">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Weekly email digest</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>A summary of your week, sent every Monday.</div>
              </div>
              <Switch on={emailDigest} onToggle={() => setEmailDigest((v) => !v)} />
            </div>
            <div className="settings-row">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Timesheet reminders</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Nudge me if a week is unsubmitted by Friday.</div>
              </div>
              <Switch on={timesheetReminders} onToggle={() => setTimesheetReminders((v) => !v)} />
            </div>
            <div className="settings-row">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Mentions & comments</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>When someone mentions you or comments on your work.</div>
              </div>
              <Switch on={mentions} onToggle={() => setMentions((v) => !v)} />
            </div>
            <div className="settings-row">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Product updates</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Occasional news about new features.</div>
              </div>
              <Switch on={productUpdates} onToggle={() => setProductUpdates((v) => !v)} />
            </div>
          </div>
        </>
      )}

      {section === 'appearance' && (
        <>
          <div className="page-title">Appearance</div>
          <div className="card" style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field-label">Theme</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={theme === 'light' ? 'btn-dark' : 'btn-outline'}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => chooseTheme('light')}
              >
                <SunIcon color="currentColor" /> Light
              </button>
              <button
                className={theme === 'dark' ? 'btn-dark' : 'btn-outline'}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => chooseTheme('dark')}
              >
                <MoonIcon color="currentColor" /> Dark
              </button>
              <button
                className={theme === 'auto' ? 'btn-dark' : 'btn-outline'}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => chooseTheme('auto')}
              >
                <MonitorIcon color="currentColor" /> Auto
              </button>
            </div>
          </div>

          <div className="card" style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 2 }}>Nav bar position</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Choose which edge of the screen the navigation bar docks to.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {NAV_POSITIONS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => chooseNavPosition(p.key)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 6px',
                    borderRadius: 10,
                    border: navPos === p.key ? '1px solid var(--color-text-primary)' : '1px solid var(--color-border-subtle)',
                    background: navPos === p.key ? 'var(--color-background-muted)' : 'var(--color-background-page)',
                  }}
                >
                  <NavPositionIcon position={p.key} active={navPos === p.key} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: navPos === p.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{p.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4, borderTop: '1px solid var(--color-border-subtle)', marginTop: 4 }}>
              <div style={{ paddingTop: 8 }}>
                <div className="field-label" style={{ marginBottom: 2 }}>Pin nav bar</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {navPinned ? 'Always visible at its docked edge.' : 'Hidden until you move the cursor to that edge.'}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={navPinned}
                aria-label="Pin nav bar"
                onClick={toggleNavPinned}
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 24,
                  borderRadius: 999,
                  padding: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: navPinned ? 'flex-end' : 'flex-start',
                  background: navPinned ? 'var(--color-background-inverse)' : 'var(--color-background-muted)',
                  border: '1px solid var(--color-border-default)',
                  transition: 'justify-content 0.15s ease, background 0.15s ease',
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: navPinned ? 'var(--color-text-inverse)' : 'var(--color-background-page)', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
              </button>
            </div>

            <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 2 }}>Interface sounds</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Soft clicks as you tap, toggle, pick and get notified — each interaction has its own sound.
                  </div>
                </div>
                <Toggle label="Interface sounds" checked={uiSound.enabled} onChange={(v) => { updateUiSoundSettings({ enabled: v }); if (v) playUiSound('toggle-on', true) }} />
              </div>
              {uiSound.enabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: 52 }}>Volume</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={uiSound.volume}
                      onChange={(e) => updateUiSoundSettings({ volume: Number(e.target.value) })}
                      onPointerUp={() => playUiSound('tap', true)}
                      aria-label="Interface sound volume"
                      style={{ flex: 1, accentColor: 'var(--brand-mid)' }}
                    />
                    <span className="mono" style={{ width: 34, textAlign: 'right', fontSize: 12, color: 'var(--color-text-secondary)' }}>{Math.round(uiSound.volume * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([
                      ['Tap', 'tap'],
                      ['Navigate', 'nav'],
                      ['Switch on', 'toggle-on'],
                      ['Switch off', 'toggle-off'],
                      ['Select', 'select'],
                      ['Open', 'open'],
                      ['Success', 'success'],
                      ['Alert', 'error'],
                      ['Delete', 'delete'],
                    ] as Array<[string, UiSoundKind]>).map(([label, kind]) => (
                      <button key={kind} data-no-sound className="btn-outline" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => feedback(kind, true)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 2 }}>Haptic feedback</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    A tiny vibration on taps — stronger for deletes. {hapticsSupportLabel()}.
                  </div>
                </div>
                <Toggle
                  label="Haptic feedback"
                  checked={uiSound.haptics}
                  onChange={(v) => {
                    updateUiSoundSettings({ haptics: v })
                    if (v) feedback('toggle-on', true)
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {section === 'security' && (
        <>
          <div className="page-title">Security</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
            <div>
              <div className="field-label">Current password</div>
              <input className="input" type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <div className="field-label">New password</div>
              <input className="input" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <div className="field-label">Confirm new password</div>
              <input className="input" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-dark" disabled={!currentPassword || !newPassword} onClick={updatePassword}>Update password</button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
