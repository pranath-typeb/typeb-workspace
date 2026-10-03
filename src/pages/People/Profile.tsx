import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { OrgChartIcon, PeopleIcon, ChevronLeftIcon, ChevronRightIcon, CakeIcon, DownloadIcon, HistoryIcon, TrendingUpIcon, DollarIcon, FlagIcon } from '../../components/icons'
import { people, personById, localTimeFor, CURRENT_USER_ID } from '../../data/people'
import { statusBadgeClass, usePayrollPeriods } from '../../data/payroll'
import { useHistoryFor, typeBadgeClass, type HistoryEvent, type HistoryEventType } from '../../data/employeeHistory'
import { avatarContent } from '../../components/Avatar'

function historyHeadline(e: HistoryEvent): string {
  if (e.type === 'Hire') return `Joined as ${e.title}`
  if (e.type === 'Promotion') return `Promoted to ${e.title}`
  if (e.type === 'Title Change') return `Title changed to ${e.title}`
  if (e.type === 'Transfer') return `Transferred to ${e.department ?? e.title}`
  return `Salary updated to $${(e.salary ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}/mo`
}

function historyIconFor(type: HistoryEventType) {
  if (type === 'Promotion') return <TrendingUpIcon size={16} color="var(--brand-text)" />
  if (type === 'Salary Change') return <DollarIcon size={16} color="#cc3a00" />
  if (type === 'Hire') return <FlagIcon size={16} color="var(--brand-text)" />
  return <HistoryIcon size={16} color="var(--muted-label)" />
}

function historyIconBg(type: HistoryEventType): string {
  if (type === 'Promotion') return 'var(--brand-soft-bg)'
  if (type === 'Salary Change') return 'var(--warn-bg)'
  if (type === 'Hire') return 'var(--brand-soft-bg)'
  return '#ebebeb'
}

function tenureFrom(startDate: string): string {
  const start = new Date(startDate)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 1) return '< 1 mo'
  if (months < 12) return `${months} mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem ? `${years}y ${rem}m` : `${years}y`
}

function tenureLong(startDate: string): string {
  const start = new Date(startDate)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 1) return 'Less than a month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  const yearPart = `${years} year${years === 1 ? '' : 's'}`
  return rem ? `${yearPart}, ${rem} month${rem === 1 ? '' : 's'}` : yearPart
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function anniversaryProgress(startDate: string) {
  const start = new Date(startDate)
  const now = new Date()
  let yearsElapsed = now.getFullYear() - start.getFullYear()
  const anniversaryThisYear = new Date(start)
  anniversaryThisYear.setFullYear(start.getFullYear() + yearsElapsed)
  if (anniversaryThisYear > now) yearsElapsed -= 1

  const prevAnniversary = new Date(start)
  prevAnniversary.setFullYear(start.getFullYear() + yearsElapsed)
  const nextAnniversary = new Date(start)
  nextAnniversary.setFullYear(start.getFullYear() + yearsElapsed + 1)

  const totalMs = nextAnniversary.getTime() - prevAnniversary.getTime()
  const elapsedMs = now.getTime() - prevAnniversary.getTime()
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 0
  const daysRemaining = Math.max(0, Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  return {
    fromYear: yearsElapsed,
    toYear: yearsElapsed + 1,
    progress,
    daysRemaining,
    nextAnniversary,
  }
}

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const person = id ? personById(id) : undefined
  const manager = person?.managerId ? personById(person.managerId) : undefined
  const reports = person ? people.filter((p) => p.managerId === person.id) : []
  const allPeriods = usePayrollPeriods()
  const periods = person ? allPeriods.filter((p) => p.personId === person.id) : []
  const currentPeriod = periods[0]
  const history = useHistoryFor(person?.id)

  if (!person) {
    return (
      <AppShell
        appIcon={<PeopleIcon size={16} color="var(--color-text-secondary)" />}
        appLabel="People"
        appHref="/people"
        sidebar={<PeopleSidebar active="directory" />}
      >
        <div className="page-title">Profile</div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that person.</div>
          <Link to="/people" className="btn-outline">Back to directory</Link>
        </div>
      </AppShell>
    )
  }

  const journey = anniversaryProgress(person.startDate)
  const yearSpanPct = journey.toYear === 0 ? 100 : Math.round(journey.progress * 100)

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="directory" />}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate('/people')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeftIcon color="var(--color-text-secondary)" /> Directory
        </button>
        <Link to="/people/org-chart" className="btn-outline">
          <OrgChartIcon size={14} color="var(--color-text-primary)" /> Show in org chart
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div className="avatar" style={{ width: 88, height: 88, fontSize: 26, borderRadius: 44, flexShrink: 0 }}>{avatarContent(person)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 24, letterSpacing: '-1.2px' }}>{person.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{person.email}</span>
            {person.title && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d4d4d4', display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{person.title}</span>
              </>
            )}
            {person.department && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d4d4d4', display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{person.department}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--brand-soft-bg)', padding: '3px 10px', borderRadius: 9999, flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-deep)', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-text)' }}>Active</span>
        </div>
      </div>

      <div className="stat-strip" style={{ display: 'flex', background: 'var(--color-background-page)', border: '1px solid var(--color-border-default)', borderRadius: 14 }}>
        <StatCell label="Tenure" value={tenureFrom(person.startDate)} sub={`Since ${fmtDate(person.startDate)}`} />
        <StatCell label="Next anniversary" value={`${journey.daysRemaining}d`} sub={journey.nextAnniversary.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />
        <StatCell label="Current pay period" value={currentPeriod?.label ?? '—'} sub={currentPeriod?.cycle ?? 'No periods yet'} />
        <StatCell label="Last payslip" value={currentPeriod ? `$${currentPeriod.grossPay.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '—'} sub={currentPeriod ? `Paid ${currentPeriod.label}` : '—'} last />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Your journey</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <Field label="Start date" value={fmtDate(person.startDate)} />
            <Field label="Time at company" value={tenureLong(person.startDate)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ background: 'var(--color-background-muted)', borderRadius: 9999, height: 6, overflow: 'hidden' }}>
              <div style={{ background: 'var(--brand-mid)', height: 6, borderRadius: 9999, width: `${yearSpanPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Year {journey.fromYear}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Year {journey.toYear}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--brand-soft-bg)', borderRadius: 10, padding: '10px 14px' }}>
            <CakeIcon size={20} color="var(--brand-text)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-text)' }}>
              Your {journey.toYear}-year anniversary is in {journey.daysRemaining} days ({journey.nextAnniversary.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })})
            </span>
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Emergency contact</div>
          {person.emergencyContact ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <Field label="Name" value={person.emergencyContact.name} />
                <Field label="Relationship" value={person.emergencyContact.relationship} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <Field label="Email" value={person.emergencyContact.email} />
                <Field label="Contact no." value={person.emergencyContact.phone} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No emergency contact on file.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Personal details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Field label="Contact number" value={person.phone ?? '—'} />
              <Field label="Birthday" value={person.birthday ? fmtDate(person.birthday) : '—'} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Field label="Country" value={person.jurisdiction ?? '—'} />
              <Field label="City" value={person.city ?? '—'} />
            </div>
            <Field label="Mail" value={person.personalEmail ?? '—'} />
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Employment details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Field label="Department" value={person.department ?? '—'} />
              <Field label="Role" value={person.title || '—'} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Field label="Manager" value={manager?.name ?? '—'} />
              <Field label="Employment status" value="Active" />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Field label="Start date" value={fmtDate(person.startDate)} />
              <Field label="Employee ID" value={person.employeeId ?? '—'} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Employment history</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', padding: '10px 0' }}>No history on file yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((e, i) => {
              const delta = e.salary !== undefined && e.previousSalary !== undefined ? e.salary - e.previousSalary : undefined
              return (
                <div
                  key={e.id}
                  style={{ display: 'flex', gap: 12, padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid var(--table-row-border)' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: historyIconBg(e.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {historyIconFor(e.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{historyHeadline(e)}</span>
                      <span className={`badge ${typeBadgeClass(e.type)}`} style={{ fontSize: 10 }}>{e.type}</span>
                      {delta !== undefined && delta !== 0 && (
                        <span className={`badge ${delta > 0 ? 'b-pine' : 'b-danger'}`} style={{ fontSize: 10 }}>
                          {delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 0 })}/mo
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{fmtDate(e.date)}</div>
                    {e.note && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{e.note}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Payslip history</div>
          {person.id === CURRENT_USER_ID && (
            <Link to="/payroll/my" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              View All <ChevronRightIcon size={12} color="var(--color-text-primary)" />
            </Link>
          )}
        </div>
        {periods.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', padding: '10px 0' }}>No payslips on file yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {periods.map((p, i) => (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--table-row-border)' }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand-soft-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PayslipFileIcon />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{p.cycle}</div>
                </div>
                <span className={`badge ${statusBadgeClass(p.status)}`}>{p.status}</span>
                <span style={{ fontSize: 14, fontWeight: 500, width: 90, textAlign: 'right' }}>${p.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                {p.status === 'Timesheet pending' ? (
                  <span style={{ display: 'flex', padding: 4 }} title="Payslip not available until submitted">
                    <DownloadIcon size={14} color="var(--color-text-tertiary)" />
                  </span>
                ) : (
                  <Link to={`/payroll/payslip/${p.id}`} aria-label={`Download payslip for ${p.label}`} style={{ display: 'flex', padding: 4 }}>
                    <DownloadIcon size={14} color="var(--color-text-tertiary)" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Current pay cycle</div>
          {person.id === CURRENT_USER_ID && (
            <Link to="/payroll/my" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              View Payroll <ChevronRightIcon size={12} color="var(--color-text-primary)" />
            </Link>
          )}
        </div>
        {currentPeriod ? (
          <>
            <div style={{ background: '#171717', borderRadius: 12, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#d4d4d4', letterSpacing: '0.3px' }}>{currentPeriod.label.toUpperCase()}</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#fff', marginTop: 4, letterSpacing: '-0.48px' }}>{currentPeriod.cycle}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '5px 12px', borderRadius: 9999 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: currentPeriod.status === 'Timesheet pending' ? '#ff4800' : '#66aba9', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{currentPeriod.status}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <Field label="Days remaining" value={String(journey.daysRemaining)} />
              <Field label="Hours logged" value={`${currentPeriod.actualHours} / ${currentPeriod.targetHours}`} />
              <Field label="Est. gross pay" value={`$${currentPeriod.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No pay cycle data yet.</div>
        )}
      </div>

      {(manager || reports.length > 0) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {manager && (
            <div className="card" style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Reporting line</div>
              <Link to={`/people/${manager.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(manager)}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{manager.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{manager.title || manager.email}</div>
                </div>
              </Link>
            </div>
          )}
          {reports.length > 0 && (
            <div className="card" style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Direct reports ({reports.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reports.map((r) => (
                  <Link to={`/people/${r.id}`} key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{avatarContent(r)}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{r.title || r.email}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{localTimeFor(person.timezone)} local · {person.timezone}</div>
    </AppShell>
  )
}

function StatCell({ label, value, sub, last }: { label: string; value: string; sub: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '16px 20px', borderRight: last ? 'none' : '1px solid var(--color-border-subtle)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, marginTop: 8, letterSpacing: '-0.48px' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-label)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function PayslipFileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-text)" strokeWidth="1.8">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  )
}
