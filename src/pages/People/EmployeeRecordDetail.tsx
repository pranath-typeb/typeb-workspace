import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PeopleSidebar from '../../components/PeopleSidebar'
import { ChevronLeftIcon, OrgChartIcon, PeopleIcon, RefreshIcon } from '../../components/icons'
import { people, resyncPerson, updatePerson, usePeople, type Department, type EmploymentType } from '../../data/people'

const departments: Department[] = ['Technology', 'Growth', 'Strategy', 'Operations', 'People']
const employmentTypes: EmploymentType[] = ['full_time', 'part_time', 'contract']

function reportingChain(personId: string) {
  const chain = []
  let current = people.find((p) => p.id === personId)
  while (current) {
    chain.unshift(current)
    current = current.managerId ? people.find((p) => p.id === current!.managerId) : undefined
  }
  return chain
}

export default function EmployeeRecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const allPeople = usePeople()
  const person = allPeople.find((p) => p.id === id)

  const [managerId, setManagerId] = useState(person?.managerId ?? '')
  const [department, setDepartment] = useState<Department | ''>(person?.department ?? '')
  const [jurisdiction, setJurisdiction] = useState(person?.jurisdiction ?? '')
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>(person?.employmentType ?? '')
  const [payrollExcluded, setPayrollExcluded] = useState(person?.payrollExcluded ?? false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!person) return
    setManagerId(person.managerId ?? '')
    setDepartment(person.department ?? '')
    setJurisdiction(person.jurisdiction ?? '')
    setEmploymentType(person.employmentType ?? '')
    setPayrollExcluded(person.payrollExcluded)
    setDirty(false)
  }, [person?.id])

  if (!person) {
    return (
      <AppShell
        appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
        appLabel="People"
        appHref="/people"
        sidebar={<PeopleSidebar active="records" />}
      >
        <div className="page-title">Employee Record Detail</div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>We couldn't find that record.</div>
          <Link to="/people/records" className="btn-outline">Back to records</Link>
        </div>
      </AppShell>
    )
  }

  const chain = reportingChain(person.id)

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setDirty(true)
    }
  }

  function save() {
    updatePerson(person!.id, {
      managerId: managerId || null,
      department: (department || null) as Department | null,
      jurisdiction: jurisdiction || null,
      employmentType: (employmentType || null) as EmploymentType | null,
      payrollExcluded,
    })
    setDirty(false)
  }

  return (
    <AppShell
      appIcon={<PeopleIcon size={16} color="rgba(0,0,0,0.53)" />}
      appLabel="People"
      appHref="/people"
      sidebar={<PeopleSidebar active="records" />}
    >
      <div className="page-title">Employee Record Detail</div>

      <button
        onClick={() => navigate('/people/records')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.53)' }}
      >
        <ChevronLeftIcon color="rgba(0,0,0,0.53)" /> Directory
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.8px' }}>{person.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', marginTop: 2 }}>{person.email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge b-ember">Synced {person.syncedDaysAgo}d ago</span>
          <button className="btn-outline" onClick={() => resyncPerson(person.id)}><RefreshIcon color="#0f0f10" /> Re-sync</button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.53)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {chain.map((p, i) => (
          <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: 'rgba(0,0,0,0.3)' }}>›</span>}
            {i === chain.length - 1 ? <b>{p.name}</b> : p.name}
          </span>
        ))}
        <Link to="/people/org-chart" style={{ marginLeft: 8, color: '#004543', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <OrgChartIcon size={13} color="#004543" /> View in org chart
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, borderBottom: '2px solid #171717' }}>Placement</div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Placement (Nucleus)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Manager</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>Sets this person's position in the org chart</div>
            <select className="input" value={managerId} onChange={(e) => markDirty(setManagerId)(e.target.value)}>
              <option value="">No manager</option>
              {people.filter((p) => p.id !== person.id).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Department</div>
            <div style={{ height: 20 }} />
            <select className="input" value={department} onChange={(e) => markDirty(setDepartment)(e.target.value as Department | '')}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Jurisdiction</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.53)', marginBottom: 6 }}>Drives holiday applicability in payroll</div>
            <input className="input" value={jurisdiction} onChange={(e) => markDirty(setJurisdiction)(e.target.value)} placeholder="e.g. Sri Lanka" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Employment type</div>
            <div style={{ height: 20 }} />
            <select className="input" value={employmentType} onChange={(e) => markDirty(setEmploymentType)(e.target.value as EmploymentType | '')}>
              <option value="">Unset</option>
              {employmentTypes.map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Timezone</div>
            <div style={{ height: 20 }} />
            <div className="input" style={{ color: 'rgba(0,0,0,0.53)' }}>{person.timezone}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <input
            type="checkbox"
            id="payroll-excluded"
            checked={payrollExcluded}
            onChange={(e) => markDirty(setPayrollExcluded)(e.target.checked)}
          />
          <label htmlFor="payroll-excluded" style={{ fontSize: 14 }}>External (contractor / partner) — excluded from payroll</label>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 6 }}>Compensation is managed in the HR app.</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn-dark" disabled={!dirty} onClick={save}>Save changes</button>
        </div>
      </div>
    </AppShell>
  )
}
