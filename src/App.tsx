import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Directory from './pages/People/Directory'
import Profile from './pages/People/Profile'
import OrgChart from './pages/People/OrgChart'
import MyTeam from './pages/People/MyTeam'
import Insights from './pages/People/Insights'
import EmployeeRecords from './pages/People/EmployeeRecords'
import EmployeeRecordDetail from './pages/People/EmployeeRecordDetail'
import MyLeave from './pages/HR/MyLeave'
import ProjectsList from './pages/Projects/List'
import ProjectDetail from './pages/Projects/Detail'
import Clients from './pages/Projects/Clients'
import ClientDetail from './pages/Projects/ClientDetail'
import Staffing from './pages/Projects/Staffing'
import MyTime from './pages/Time/MyTime'
import Timesheets from './pages/Time/Timesheets'
import TimeCalendar from './pages/Time/Calendar'
import Reporting from './pages/Time/Reporting'
import Approvals from './pages/Time/Approvals'
import PayrollDashboard from './pages/Payroll/Dashboard'
import PayrollReviews from './pages/Payroll/Reviews'
import MyPayroll from './pages/Payroll/MyPayroll'
import CompanyCalendar from './pages/Calendar'
import Analytics from './pages/Analytics'
import ComingSoon from './pages/ComingSoon'
import StandaloneComingSoon from './pages/StandaloneComingSoon'
import BottomNav from './components/BottomNav'
import ToastContainer from './components/ToastContainer'
import { NavItem, NavGroupLabel, NavSep } from './components/NavItem'
import { GridIcon, ClockIcon, LetterIcon, PolicyIcon, BenefitsIcon } from './components/icons'

function HrSidebar({ active }: { active: string }) {
  return (
    <>
      <NavItem to="/hr/overview" icon={<GridIcon color={active === 'overview' ? '#fafafa' : undefined} />} label="Overview" active={active === 'overview'} />
      <NavSep />
      <NavGroupLabel label="Me" />
      <NavItem to="/hr/leave" icon={<ClockIcon color={active === 'leave' ? '#fafafa' : undefined} />} label="My Leave" active={active === 'leave'} />
      <NavItem to="/hr/letters" icon={<LetterIcon color={active === 'letters' ? '#fafafa' : undefined} />} label="My Letters" active={active === 'letters'} />
      <NavItem to="/hr/policies" icon={<PolicyIcon color={active === 'policies' ? '#fafafa' : undefined} />} label="Policies" active={active === 'policies'} />
      <NavItem to="/hr/benefits" icon={<BenefitsIcon color={active === 'benefits' ? '#fafafa' : undefined} />} label="Benefits" active={active === 'benefits'} />
    </>
  )
}

const hrAppProps = { appIcon: <ClockIcon size={16} color="rgba(0,0,0,0.53)" />, appLabel: 'HR', appHref: '/hr/leave' }

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/people" element={<Directory />} />
      <Route path="/people/org-chart" element={<OrgChart />} />
      <Route path="/people/my-team" element={<MyTeam />} />
      <Route path="/people/insights" element={<Insights />} />
      <Route path="/people/records" element={<EmployeeRecords />} />
      <Route path="/people/records/:id" element={<EmployeeRecordDetail />} />
      <Route path="/people/:id" element={<Profile />} />

      <Route path="/hr/leave" element={<MyLeave />} />
      <Route
        path="/hr/overview"
        element={<ComingSoon {...hrAppProps} sidebar={<HrSidebar active="overview" />} title="HR Overview" />}
      />
      <Route
        path="/hr/letters"
        element={<ComingSoon {...hrAppProps} sidebar={<HrSidebar active="letters" />} title="My Letters" />}
      />
      <Route
        path="/hr/policies"
        element={<ComingSoon {...hrAppProps} sidebar={<HrSidebar active="policies" />} title="Policies" />}
      />
      <Route
        path="/hr/benefits"
        element={<ComingSoon {...hrAppProps} sidebar={<HrSidebar active="benefits" />} title="Benefits" />}
      />

      <Route path="/time" element={<MyTime />} />
      <Route path="/time/timesheets" element={<Timesheets />} />
      <Route path="/time/calendar" element={<TimeCalendar />} />
      <Route path="/time/reporting" element={<Reporting />} />
      <Route path="/time/approvals" element={<Approvals />} />

      <Route path="/payroll" element={<PayrollDashboard />} />
      <Route path="/payroll/reviews" element={<PayrollReviews />} />
      <Route path="/payroll/my" element={<MyPayroll />} />

      <Route path="/projects" element={<ProjectsList />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/projects/clients" element={<Clients />} />
      <Route path="/projects/clients/:name" element={<ClientDetail />} />
      <Route path="/projects/staffing" element={<Staffing />} />

      <Route path="/calendar" element={<CompanyCalendar />} />
      <Route path="/analytics" element={<Analytics />} />

      <Route
        path="/settings"
        element={<StandaloneComingSoon title="Settings" description="Workspace settings aren't wired up yet in this build." />}
      />
      <Route
        path="/messages"
        element={<StandaloneComingSoon title="Messages" description="Messaging isn't wired up yet in this build." />}
      />

      <Route path="*" element={<Home />} />
    </Routes>
    <BottomNav />
    <ToastContainer />
    </>
  )
}
