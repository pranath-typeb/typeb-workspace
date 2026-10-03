import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon, DownloadIcon } from '../../components/icons'
import { personById } from '../../data/people'
import { letterRequestById, useLetterRequests } from '../../data/letters'

const COMPANY_NAME = 'Type B Digital (Pvt) Ltd'
const COMPANY_ADDRESS = '14 Level Road, Colombo 03, Sri Lanka'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LetterPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useLetterRequests() // subscribe so this re-renders if the request list changes
  const letter = id ? letterRequestById(id) : undefined
  const person = letter ? personById(letter.requestedBy) : undefined

  if (!letter || !person) {
    return (
      <section className="stage">
        <div className="canvas" style={{ maxWidth: 700, padding: 24 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that letter.</div>
            <Link to="/hr/letters" className="btn-outline">Back to My Letters</Link>
          </div>
        </div>
      </section>
    )
  }

  const today = fmtDate(letter.requestedAt)
  const tenureStart = fmtDateShort(person.startDate)

  return (
    <section className="stage" style={{ background: 'var(--color-background-subtle)' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: '24px 16px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}
          >
            <ChevronLeftIcon color="var(--color-text-secondary)" /> Back
          </button>
          <button className="btn-dark" onClick={() => window.print()}>
            <DownloadIcon size={14} color="var(--color-text-inverse)" /> Download PDF
          </button>
        </div>

        <div className="doc-page" style={{ background: '#fff', color: '#0f0f10', borderRadius: 14, border: '1px solid #ececee', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="serif" style={{ fontSize: 18, letterSpacing: '-0.4px' }}>{COMPANY_NAME}</div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>{COMPANY_ADDRESS}</div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', textAlign: 'right' }}>{today}</div>
          </div>

          <div style={{ borderTop: '1px solid #ececee' }} />

          <div className="serif" style={{ fontSize: 20, letterSpacing: '-0.5px' }}>{letter.type}</div>

          {letter.addressedTo && (
            <div style={{ fontSize: 13 }}>
              To,<br />
              {letter.addressedTo}
            </div>
          )}

          <LetterBody type={letter.type} person={person} tenureStart={tenureStart} purpose={letter.purpose} />

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13 }}>Sincerely,</div>
            <div style={{ marginTop: 40, fontSize: 13, fontWeight: 600 }}>People Operations</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)' }}>{COMPANY_NAME}</div>
          </div>

          <div style={{ borderTop: '1px solid #ececee', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)' }}>This is a system-generated letter and does not require a physical signature.</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.35)' }}>TYPE B</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function LetterBody({
  type,
  person,
  tenureStart,
  purpose,
}: {
  type: string
  person: NonNullable<ReturnType<typeof personById>>
  tenureStart: string
  purpose?: string
}) {
  const purposeLine = purpose ? ` for the purpose of ${purpose}` : ''

  if (type === 'Salary Confirmation Letter') {
    return (
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
        This is to confirm that <strong>{person.name}</strong> (Employee ID: {person.employeeId ?? '—'}) is currently
        employed at {COMPANY_NAME} as <strong>{person.title}</strong>{person.department ? ` in the ${person.department} department` : ''},
        since {tenureStart}. This letter is issued upon the employee's request{purposeLine}.
      </div>
    )
  }

  if (type === 'Visa Officer Letter') {
    return (
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
        This is to confirm that <strong>{person.name}</strong> (Employee ID: {person.employeeId ?? '—'}) has been a full-time
        employee of {COMPANY_NAME} since {tenureStart}, currently holding the position of <strong>{person.title}</strong>.
        This letter is issued in support of a visa application{purposeLine}, and the employee is expected to return to their
        role at the end of their travel.
      </div>
    )
  }

  // Service Letter (default)
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
      This is to certify that <strong>{person.name}</strong> (Employee ID: {person.employeeId ?? '—'}) has been employed at
      {' '}{COMPANY_NAME} as <strong>{person.title}</strong>{person.department ? ` in the ${person.department} department` : ''},
      since {tenureStart}, and continues to be in active employment as of the date of this letter. This letter is issued
      upon the employee's request{purposeLine}.
    </div>
  )
}
