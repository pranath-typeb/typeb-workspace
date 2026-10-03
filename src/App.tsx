import { Routes, Route, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Directory from './pages/People/Directory'
import Profile from './pages/People/Profile'
import OrgChart from './pages/People/OrgChart'
import MyTeam from './pages/People/MyTeam'
import Insights from './pages/People/Insights'
import EmployeeRecords from './pages/People/EmployeeRecords'
import EmployeeRecordDetail from './pages/People/EmployeeRecordDetail'
import MyLeave from './pages/HR/MyLeave'
import MyLetters from './pages/HR/MyLetters'
import LetterPreview from './pages/HR/LetterPreview'
import ProjectsList from './pages/Projects/List'
import ProjectDetail from './pages/Projects/Detail'
import Clients from './pages/Projects/Clients'
import ClientDetail from './pages/Projects/ClientDetail'
import Staffing from './pages/Projects/Staffing'
import MyTime from './pages/Time/MyTime'
import Timesheets from './pages/Time/Timesheets'
import TimesheetDetail from './pages/Time/TimesheetDetail'
import TimeCalendar from './pages/Time/Calendar'
import Reporting from './pages/Time/Reporting'
import Approvals from './pages/Time/Approvals'
import PayrollDashboard from './pages/Payroll/Dashboard'
import PayrollReviews from './pages/Payroll/Reviews'
import MyPayroll from './pages/Payroll/MyPayroll'
import PayrollPeriodDetail from './pages/Payroll/PeriodDetail'
import Payslip from './pages/Payroll/Payslip'
import CompanyCalendar from './pages/Calendar'
import Analytics from './pages/Analytics'
import ComingSoon from './pages/ComingSoon'
import StandaloneComingSoon from './pages/StandaloneComingSoon'
import SignIn from './pages/Auth/SignIn'
import SignUp from './pages/Auth/SignUp'
import ForgotPassword from './pages/Auth/ForgotPassword'
import CheckEmail from './pages/Auth/CheckEmail'
import ResetPassword from './pages/Auth/ResetPassword'
import Settings from './pages/Settings'
import BottomNav from './components/BottomNav'
import ToastContainer from './components/ToastContainer'
import ScrollToTopButton from './components/ScrollToTopButton'
import TimerLiveWidget from './components/TimerLiveWidget'
import ScreenRippleOverlay from './components/ScreenRippleOverlay'
import { NavItem, NavGroupLabel, NavSep } from './components/NavItem'
import { GridIcon, ClockIcon, LetterIcon, PolicyIcon, BenefitsIcon } from './components/icons'
import Focus from './pages/Focus'
import Challenges from './pages/Challenges'
import MoveReminder from './components/MoveReminder'
import FocusMini from './components/FocusMini'

function HrSidebar({ active }: { active: string }) {
  return (
    <>
      <NavItem to="/hr/overview" icon={<GridIcon color={active === 'overview' ? 'var(--color-text-inverse)' : undefined} />} label="Overview" active={active === 'overview'} />
      <NavSep />
      <NavGroupLabel label="Me" />
      <NavItem to="/hr/leave" icon={<ClockIcon color={active === 'leave' ? 'var(--color-text-inverse)' : undefined} />} label="My Leave" active={active === 'leave'} />
      <NavItem to="/hr/letters" icon={<LetterIcon color={active === 'letters' ? 'var(--color-text-inverse)' : undefined} />} label="My Letters" active={active === 'letters'} />
      <NavItem to="/hr/policies" icon={<PolicyIcon color={active === 'policies' ? 'var(--color-text-inverse)' : undefined} />} label="Policies" active={active === 'policies'} />
      <NavItem to="/hr/benefits" icon={<BenefitsIcon color={active === 'benefits' ? 'var(--color-text-inverse)' : undefined} />} label="Benefits" active={active === 'benefits'} />
    </>
  )
}

const hrAppProps = { appIcon: <ClockIcon size={16} color="var(--color-text-secondary)" />, appLabel: 'HR', appHref: '/hr/leave' }

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/check-email', '/reset-password']

export default function App() {
  const location = useLocation()
  const isAuthRoute = AUTH_ROUTES.includes(location.pathname)

  return (
    <>
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/login" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/check-email" element={<CheckEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
      <Route path="/hr/letters" element={<MyLetters />} />
      <Route path="/hr/letters/:id" element={<LetterPreview />} />
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
      <Route path="/time/timesheets/:personId/:weekStart" element={<TimesheetDetail />} />
      <Route path="/time/calendar" element={<TimeCalendar />} />
      <Route path="/time/reporting" element={<Reporting />} />
      <Route path="/time/approvals" element={<Approvals />} />

      <Route path="/payroll" element={<PayrollDashboard />} />
      <Route path="/payroll/reviews" element={<PayrollReviews />} />
      <Route path="/payroll/reviews/:periodId" element={<PayrollPeriodDetail mode="admin" />} />
      <Route path="/payroll/my" element={<MyPayroll />} />
      <Route path="/payroll/my/:periodId" element={<PayrollPeriodDetail mode="self" />} />
      <Route path="/payroll/payslip/:periodId" element={<Payslip />} />

      <Route path="/projects" element={<ProjectsList />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/projects/clients" element={<Clients />} />
      <Route path="/projects/clients/:name" element={<ClientDetail />} />
      <Route path="/projects/staffing" element={<Staffing />} />

      <Route path="/focus" element={<Focus />} />
      <Route path="/challenges" element={<Challenges />} />
      <Route path="/calendar" element={<CompanyCalendar />} />
      <Route path="/analytics" element={<Analytics />} />

      <Route path="/settings" element={<Settings />} />
      <Route
        path="/messages"
        element={<StandaloneComingSoon title="Messages" description="Messaging isn't wired up yet in this build." />}
      />

      <Route path="*" element={<Home />} />
    </Routes>
    {!isAuthRoute && <BottomNav />}
    {!isAuthRoute && <ScrollToTopButton />}
    {!isAuthRoute && <TimerLiveWidget />}
    {!isAuthRoute && <FocusMini />}
    {!isAuthRoute && <MoveReminder />}
    <ScreenRippleOverlay />
    <ToastContainer />
    </>
  )
}
