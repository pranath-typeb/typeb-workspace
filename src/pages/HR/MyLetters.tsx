import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { NavItem, NavGroupLabel, NavSep } from '../../components/NavItem'
import { ClockIcon, GridIcon, LetterIcon, PolicyIcon, BenefitsIcon, EyeIcon, TrashIcon, PlusIcon } from '../../components/icons'
import RequestLetterModal from '../../components/RequestLetterModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useLetterRequests, deleteLetterRequest, type LetterRequest } from '../../data/letters'
import { CURRENT_USER_ID } from '../../data/people'

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyLetters() {
  const [requesting, setRequesting] = useState(false)
  const [deleting, setDeleting] = useState<LetterRequest | null>(null)
  const requests = useLetterRequests().filter((r) => r.requestedBy === CURRENT_USER_ID)

  return (
    <AppShell
      appIcon={<ClockIcon size={16} color="var(--color-text-secondary)" />}
      appLabel="HR"
      appHref="/hr/leave"
      sidebar={
        <>
          <NavItem to="/hr/overview" icon={<GridIcon />} label="Overview" />
          <NavSep />
          <NavGroupLabel label="Me" />
          <NavItem to="/hr/leave" icon={<ClockIcon />} label="My Leave" />
          <NavItem to="/hr/letters" icon={<LetterIcon color="var(--color-text-inverse)" />} label="My Letters" active />
          <NavItem to="/hr/policies" icon={<PolicyIcon />} label="Policies" />
          <NavItem to="/hr/benefits" icon={<BenefitsIcon />} label="Benefits" />
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="page-title">
        <span>My Letters</span>
      </div>

      <div className="card" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Request an official letter — it's generated instantly and ready to download as a PDF.
      </div>

      <div>
        <button className="btn-dark" onClick={() => setRequesting(true)}>
          <PlusIcon size={14} color="var(--color-text-inverse)" /> Request a letter
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th className="th2">Type</th>
              <th className="th2">Requested</th>
              <th className="th2">Purpose</th>
              <th className="th2"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="td2">{r.type}</td>
                <td className="td2">{fmtDate(r.requestedAt)}</td>
                <td className="td2 wrap">{r.purpose ?? '—'}</td>
                <td className="td2">
                  <div className="row-actions">
                    <Link to={`/hr/letters/${r.id}`} className="row-action-btn" aria-label="View" title="View">
                      <EyeIcon size={14} color="var(--color-text-secondary)" />
                    </Link>
                    <button className="row-action-btn" onClick={() => setDeleting(r)} aria-label="Delete" title="Delete">
                      <TrashIcon size={14} color="var(--color-status-danger)" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td className="td2" colSpan={4} style={{ color: 'var(--color-text-secondary)' }}>No letters requested yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {requesting && (
        <RequestLetterModal requestedBy={CURRENT_USER_ID} onClose={() => setRequesting(false)} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this letter?"
          message={`This will remove the ${deleting.type} requested on ${fmtDate(deleting.requestedAt)}.`}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteLetterRequest(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </AppShell>
  )
}
