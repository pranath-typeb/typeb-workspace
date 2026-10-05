import { useEffect, useMemo, useState } from 'react'
import DatePicker from '../components/DatePicker'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeftIcon, CloseIcon, FlameIcon, FootprintsIcon, TrophyIcon } from '../components/icons'
import { avatarContent } from '../components/Avatar'
import { Select } from '../components/SearchableSelect'
import { CURRENT_USER_ID, usePeople, type Person } from '../data/people'
import { addDays, todayLocal, weekStartFor } from '../data/timeEntries'
import {
  PROVIDERS,
  connectProvider,
  createChallenge,
  daysLeft,
  daysUntilStart,
  isJoined,
  joinChallenge,
  leaveChallenge,
  logSteps,
  SYNC_IS_DEMO,
  syncNow,
  myStreak,
  setDailyGoal,
  setTodaySteps,
  standings,
  statusOf,
  stepsFor,
  suggestedInvitees,
  undoLastLog,
  useChallengeState,
  type Challenge,
  type ChallengeStatus,
  type GoalType,
  type Standing,
} from '../data/challenges'

const nf = new Intl.NumberFormat('en-US')
const fmt = (n: number) => nf.format(Math.round(n))
const MEDAL = ['#e8b931', '#b4bcc6', '#c8864a']

function fmtRange(c: Challenge): string {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${new Date(c.startDate + 'T00:00:00').toLocaleDateString('en-US', o)} – ${new Date(c.endDate + 'T00:00:00').toLocaleDateString('en-US', o)}`
}

function Avatar({ person, size = 36 }: { person: Person; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34, flexShrink: 0 }}>
      {avatarContent(person)}
    </div>
  )
}

function Podium({ rows, byId, goalType }: { rows: Standing[]; byId: Map<string, Person>; goalType: GoalType }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return null
  // 2nd, 1st, 3rd so the winner sits in the middle.
  const order = [top[1], top[0], top[2]].filter(Boolean)
  return (
    <div className="ch-podium">
      {order.map((r) => {
        const p = byId.get(r.personId)
        if (!p) return null
        const isFirst = r.rank === 1
        return (
          <div key={r.personId} className={`ch-podium-col${isFirst ? ' first' : ''}`}>
            <div className="ch-podium-avatar" style={{ boxShadow: `0 0 0 3px ${MEDAL[r.rank - 1]}` }}>
              <Avatar person={p} size={isFirst ? 64 : 52} />
              <span className="ch-medal" style={{ background: MEDAL[r.rank - 1] }}>{r.rank}</span>
            </div>
            <div className="ch-podium-name">{r.personId === CURRENT_USER_ID ? 'You' : p.name.split(' ')[0]}</div>
            <div className="mono ch-podium-steps">{fmt(r.total)}</div>
            <div className="ch-podium-sub">{goalType === 'daily' ? 'steps' : 'steps'}</div>
          </div>
        )
      })}
    </div>
  )
}

function MyDay({ goal, provider, connectedAt }: { goal: number; provider: string | null; connectedAt?: string | null }) {
  const today = todayLocal()
  const steps = stepsFor(CURRENT_USER_ID, today)
  const [custom, setCustom] = useState('')
  const streak = myStreak()
  const pct = Math.min(1, steps / goal)
  const size = 168
  const stroke = 14
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r

  const monday = weekStartFor(today)
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    return { date, label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1), steps: stepsFor(CURRENT_USER_ID, date), today: date === today }
  })
  const weekMax = Math.max(goal, ...week.map((d) => d.steps))

  function saveCustom() {
    const n = Number(custom.replace(/,/g, ''))
    if (!Number.isFinite(n) || n < 0) return
    setTodaySteps(n)
    setCustom('')
  }

  return (
    <div className="card">
      <div className="focus-card-title">
        <FootprintsIcon size={16} color="var(--color-text-secondary)" /> Your day
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div className="focus-ring" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border-default)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={pct >= 1 ? 'var(--warn-fg)' : 'var(--brand-mid)'}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="focus-ring-center">
            <div className="mono" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px' }}>{fmt(steps)}</div>
            <div className="focus-phase-label">of {fmt(goal)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {steps >= goal ? 'Goal smashed — nice work!' : `${fmt(goal - steps)} to go today`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <FlameIcon size={15} color={streak > 0 ? 'var(--warn-fg)' : 'var(--color-text-tertiary)'} />
            {streak > 0 ? `${streak}-day goal streak` : 'Hit your goal to start a streak'}
          </div>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            Daily goal
            <input
              className="input"
              type="number"
              min={1000}
              step={500}
              value={goal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              style={{ width: 92, height: 28, fontSize: 12 }}
            />
          </label>
        </div>
      </div>

      {provider ? (
        <div className="ch-sync">
          <span className="ch-sync-dot" />
          <span>
            Synced from {PROVIDERS.find((p) => p.key === provider)?.label ?? 'your app'}
            {connectedAt ? ` · ${syncedAgo(connectedAt)}` : ''}
            {SYNC_IS_DEMO ? ' · demo data' : ''}
          </span>
          <button onClick={syncNow}>Sync now</button>
        </div>
      ) : (
        <div className="ch-connect-cta">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Track steps automatically</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>Connect a health app and your steps appear here — no typing.</div>
          </div>
          <button className="btn-dark" onClick={() => document.getElementById('step-source')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Connect
          </button>
        </div>
      )}

      <details className="ch-manual">
        <summary>Enter steps manually instead</summary>
        <div className="ch-quick">
          {[500, 1000, 2500].map((n) => (
            <button key={n} onClick={() => logSteps(n)}>
              +{fmt(n)}
            </button>
          ))}
          <button onClick={undoLastLog} className="ghost">Undo</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Set today's total (e.g. 8,400)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveCustom()}
          />
          <button className="btn-dark" onClick={saveCustom} disabled={!custom.trim()}>Save</button>
        </div>
      </details>

      <div className="ch-week">
        {week.map((d) => (
          <div key={d.date} className={d.today ? 'today' : ''} title={`${fmt(d.steps)} steps`}>
            <div className="bar">
              <span style={{ height: `${Math.max(d.steps > 0 ? 6 : 0, (d.steps / weekMax) * 100)}%`, background: d.steps >= goal ? 'var(--warn-fg)' : undefined }} />
              <i style={{ bottom: `${(goal / weekMax) * 100}%` }} />
            </div>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function syncedAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)}h ago`
}

function HealthSource({ provider, connectedAt }: { provider: string | null; connectedAt?: string | null }) {
  const active = PROVIDERS.find((p) => p.key === provider)
  const [connecting, setConnecting] = useState<string | null>(null)

  function connect(key: (typeof PROVIDERS)[number]['key']) {
    setConnecting(key)
    // Stand-in for the provider's sign-in + consent screen.
    setTimeout(() => {
      connectProvider(key)
      setConnecting(null)
    }, 1100)
  }

  return (
    <div className="card" id="step-source">
      <div className="focus-card-title">Step source</div>

      {active ? (
        <div className="ch-connected">
          <span className="ch-connected-badge">Connected</span>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{active.label}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Your daily steps sync automatically{connectedAt ? ` · last synced ${syncedAgo(connectedAt)}` : ''}.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-outline" onClick={syncNow}>Sync now</button>
            <button className="btn-outline" onClick={() => connectProvider(null)}>Disconnect</button>
          </div>
        </div>
      ) : (
        <div className="ch-providers">
          {PROVIDERS.map((p) => (
            <button key={p.key} disabled={connecting !== null} onClick={() => connect(p.key)}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{connecting === p.key ? 'Connecting…' : p.platform}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ch-note">
        {SYNC_IS_DEMO
          ? 'Demo mode: connecting simulates the sync with sample step data. Live sync with Apple Health, Health Connect, Fitbit and Garmin needs the backend integration — only your daily step total is ever shared with the challenge.'
          : 'Only your daily step total is shared with the challenge. You can disconnect any time.'}
      </div>
    </div>
  )
}

function NewChallengeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Challenge) => void }) {
  const people = usePeople()
  const today = todayLocal()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('daily')
  const [goalSteps, setGoalSteps] = useState(10000)
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(addDays(today, 6))
  const [everyone, setEveryone] = useState(true)

  const valid = title.trim().length > 1 && goalSteps >= 1000 && end >= start

  function submit() {
    if (!valid) return
    const invitees = suggestedInvitees(people, everyone ? 14 : 5)
    onCreated(createChallenge({ title, description, goalType, goalSteps, startDate: start, endDate: end }, invitees))
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.6px' }}>New challenge</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon color="var(--color-text-secondary)" />
          </button>
        </div>

        <div>
          <div className="field-label">Name</div>
          <input className="input" placeholder="e.g. Step Up Week" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div>
          <div className="field-label">Description (optional)</div>
          <textarea className="input" style={{ height: 64, padding: 10, resize: 'none' }} placeholder="What's the prize? Any rules?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div className="field-label">Goal type</div>
            <Select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
              <option value="daily">Daily step goal</option>
              <option value="total">Total for the period</option>
            </Select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div className="field-label">{goalType === 'daily' ? 'Steps per day' : 'Total steps'}</div>
            <input className="input" type="number" min={1000} step={500} value={goalSteps} onChange={(e) => setGoalSteps(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div className="field-label">Starts</div>
            <DatePicker value={start} onChange={setStart} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div className="field-label">Ends</div>
            <DatePicker min={start} value={end} onChange={setEnd} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
          <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          Invite the whole company
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-dark" disabled={!valid} onClick={submit}>Create challenge</button>
        </div>
      </div>
    </div>
  )
}

export default function Challenges() {
  const { challenges, store } = useChallengeState()
  const people = usePeople()
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const [tab, setTab] = useState<ChallengeStatus>('active')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
  }, [hash])

  const grouped = {
    active: challenges.filter((c) => statusOf(c) === 'active'),
    upcoming: challenges.filter((c) => statusOf(c) === 'upcoming'),
    past: challenges.filter((c) => statusOf(c) === 'past'),
  }
  const inTab = grouped[tab]
  const selected = inTab.find((c) => c.id === selectedId) ?? inTab[0] ?? null

  const rows = selected ? standings(selected) : []
  const me = rows.find((r) => r.personId === CURRENT_USER_ID)
  const leader = rows[0]
  const joined = selected ? isJoined(selected) : false
  const status = selected ? statusOf(selected) : 'active'
  const maxTotal = Math.max(1, leader?.total ?? 1)
  const target = selected ? (selected.goalType === 'total' ? selected.goalSteps : selected.goalSteps * (selected.endDate >= selected.startDate ? Math.round((new Date(selected.endDate).getTime() - new Date(selected.startDate).getTime()) / 86400000) + 1 : 1)) : 0
  const behind = me && leader && me.rank > 1 ? leader.total - me.total : 0
  const movers = useMemo(() => [...rows].sort((a, b) => b.today - a.today).slice(0, 5), [rows])

  return (
    <section className="stage">
      <div className="canvas">
        <div className="topbar">
          <div className="topbar-app">
            <TrophyIcon size={16} color="var(--color-text-secondary)" />
            <span className="topbar-app-label">Challenges</span>
          </div>
          <Link to="/" style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close">
            <ChevronLeftIcon color="var(--color-text-secondary)" />
          </Link>
        </div>

        <div style={{ padding: '24px 24px 140px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="page-title" style={{ border: 'none', paddingBottom: 0 }}>Challenges</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>Move together. Friendly step competitions with your team.</div>
            </div>
            <button className="btn-dark" onClick={() => setCreating(true)}>
              <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span> New challenge
            </button>
          </div>

          <div className="focus-chips scroll-x" style={{ marginTop: 0 }}>
            {(['active', 'upcoming', 'past'] as ChallengeStatus[]).map((s) => (
              <button
                key={s}
                className={tab === s ? 'active' : ''}
                onClick={() => {
                  setTab(s)
                  setSelectedId(null)
                }}
              >
                {s[0].toUpperCase() + s.slice(1)} <span className="mono">{grouped[s].length}</span>
              </button>
            ))}
            {inTab.length > 1 && <span style={{ width: 1, background: 'var(--color-border-default)', margin: '2px 4px' }} />}
            {inTab.length > 1 &&
              inTab.map((c) => (
                <button key={c.id} className={selected?.id === c.id ? 'active' : ''} onClick={() => setSelectedId(c.id)}>
                  {c.title}
                </button>
              ))}
          </div>

          {!selected && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
              <TrophyIcon size={28} color="var(--color-text-tertiary)" />
              <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--color-text-primary)' }}>Nothing here yet</div>
              <div style={{ fontSize: 13, marginTop: 2 }}>Start one and invite your team.</div>
            </div>
          )}

          {selected && (
            <>
              <div className="card ch-hero">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${status === 'active' ? 'b-pine' : status === 'upcoming' ? 'b-ember' : 'b-neutral'}`}>
                      {status === 'active' ? `${daysLeft(selected)} ${daysLeft(selected) === 1 ? 'day' : 'days'} left` : status === 'upcoming' ? `Starts in ${daysUntilStart(selected)}d` : 'Finished'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{fmtRange(selected)}</span>
                  </div>
                  <div className="serif" style={{ fontSize: 26, letterSpacing: '-1px', marginTop: 8 }}>{selected.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4, maxWidth: 560 }}>{selected.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
                    <div className="ch-avatars">
                      {rows.slice(0, 6).map((r) => {
                        const p = byId.get(r.personId)
                        return p ? <Avatar key={r.personId} person={p} size={28} /> : null
                      })}
                      {rows.length > 6 && <span className="ch-more">+{rows.length - 6}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {rows.length} {rows.length === 1 ? 'person' : 'people'} · goal {selected.goalType === 'daily' ? `${fmt(selected.goalSteps)} steps/day` : `${fmt(selected.goalSteps)} steps total`}
                    </span>
                  </div>
                </div>
                <div className="ch-hero-actions">
                  {status !== 'past' &&
                    (joined ? (
                      <button className="btn-outline" onClick={() => leaveChallenge(selected)}>Leave challenge</button>
                    ) : (
                      <button className="btn-dark" onClick={() => joinChallenge(selected)}>Join challenge</button>
                    ))}
                  {joined && me && (
                    <div className="ch-rank">
                      <span className="mono">#{me.rank}</span>
                      <small>your rank</small>
                    </div>
                  )}
                </div>
              </div>

              <div className="focus-layout">
                <div className="card" style={{ minWidth: 0 }}>
                  <div className="focus-card-title">
                    <TrophyIcon size={16} color="var(--color-text-secondary)" /> Leaderboard
                  </div>

                  {rows.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', padding: '12px 0' }}>No one has joined yet — be the first.</div>
                  ) : (
                    <>
                      {status !== 'upcoming' && <Podium rows={rows} byId={byId} goalType={selected.goalType} />}
                      {joined && me && status === 'active' && (
                        <div className="ch-gap">
                          {behind > 0 ? (
                            <>You&apos;re <b>{fmt(behind)}</b> steps behind #1 — about {Math.max(1, Math.ceil(behind / 1300))} min of walking away.</>
                          ) : (
                            <>You&apos;re leading the pack. Keep going!</>
                          )}
                        </div>
                      )}
                      <div className="ch-list">
                        {rows.map((r) => {
                          const p = byId.get(r.personId)
                          if (!p) return null
                          const isMe = r.personId === CURRENT_USER_ID
                          return (
                            <div key={r.personId} className={`ch-row${isMe ? ' me' : ''}`}>
                              <span className="mono ch-rank-num">{r.rank}</span>
                              <Avatar person={p} size={34} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="ch-name">{isMe ? 'You' : p.name}</span>
                                  {r.change !== 0 && (
                                    <span className="ch-change" style={{ color: r.change > 0 ? 'var(--brand-text)' : 'var(--danger-fg)' }}>
                                      {r.change > 0 ? '▲' : '▼'}{Math.abs(r.change)}
                                    </span>
                                  )}
                                </div>
                                <div className="ch-bar">
                                  <span style={{ width: `${Math.min(100, (r.total / maxTotal) * 100)}%` }} />
                                  {selected.goalType === 'total' && target > 0 && <i style={{ left: `${Math.min(100, (target / maxTotal) * 100)}%` }} />}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(r.total)}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{fmt(r.today)} today</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="focus-side">
                  {status !== 'past' && <MyDay goal={store.dailyGoal} provider={store.provider} connectedAt={store.connectedAt} />}
                  <HealthSource provider={store.provider} connectedAt={store.connectedAt} />
                  {movers.length > 0 && status === 'active' && (
                    <div className="card">
                      <div className="focus-card-title">Today&apos;s movers</div>
                      {movers.map((r) => {
                        const p = byId.get(r.personId)
                        if (!p) return null
                        return (
                          <div key={r.personId} className="focus-log" style={{ borderTop: 'none', marginTop: 0 }}>
                            <div style={{ alignItems: 'center' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar person={p} size={24} />
                                {r.personId === CURRENT_USER_ID ? 'You' : p.name}
                              </span>
                              <span className="mono">{fmt(r.today)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {creating && (
        <NewChallengeModal
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setTab(statusOf(c))
            setSelectedId(c.id)
          }}
        />
      )}
    </section>
  )
}
