import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Directory from './pages/People/Directory'
import Profile from './pages/People/Profile'
import MyLeave from './pages/HR/MyLeave'
import ProjectsList from './pages/Projects/List'
import ProjectDetail from './pages/Projects/Detail'
import Clients from './pages/Projects/Clients'
import ComingSoon from './pages/ComingSoon'
import StandaloneComingSoon from './pages/StandaloneComingSoon'
import BottomNav from './components/BottomNav'
import { NavItem, NavGroupLabel, NavSep } from './components/NavItem'
import {
  GridIcon,
  OrgChartIcon,
  PeopleIcon,
  InsightsIcon,
  RecordsIcon,
  ClockIcon,
  LetterIcon,
  PolicyIcon,
  BenefitsIcon,
  ProjectsIcon,
  StaffingIcon,
  BuildingIcon,
} from './components/icons'

function PeopleSidebar({ active }: { active: string }) {
  return (
    <>
      <NavItem to="/people" icon={<GridIcon color={active === 'directory' ? '#fafafa' : undefined} />} label="Directory" active={active === 'directory'} />
      <NavItem to="/people/org-chart" icon={<OrgChartIcon color={active === 'org-chart' ? '#fafafa' : undefined} />} label="Org chart" active={active === 'org-chart'} />
      <NavItem to="/people/my-team" icon={<PeopleIcon color={active === 'my-team' ? '#fafafa' : undefined} />} label="My team" active={active === 'my-team'} />
      <NavItem to="/people/insights" icon={<InsightsIcon color={active === 'insights' ? '#fafafa' : undefined} />} label="Insights" active={active === 'insights'} />
      <NavSep />
      <NavGroupLabel label="Manage" />
      <NavItem to="/people/records" icon={<RecordsIcon color={active === 'records' ? '#fafafa' : undefined} />} label="Employee records" active={active === 'records'} />
    </>
  )
}

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

function ProjectsSidebar({ active }: { active: string }) {
  return (
    <>
      <NavGroupLabel label="General" />
      <NavItem to="/projects" icon={<ProjectsIcon color={active === 'projects' ? '#fafafa' : undefined} />} label="Projects" active={active === 'projects'} />
      <NavItem to="/projects/staffing" icon={<StaffingIcon color={active === 'staffing' ? '#fafafa' : undefined} />} label="Staffing" active={active === 'staffing'} />
      <NavItem to="/projects/clients" icon={<BuildingIcon color={active === 'clients' ? '#fafafa' : undefined} />} label="Clients" active={active === 'clients'} />
    </>
  )
}

const peopleAppProps = { appIcon: <PeopleIcon size={16} color="rgba(0,0,0,0.53)" />, appLabel: 'People', appHref: '/people' }
const hrAppProps = { appIcon: <ClockIcon size={16} color="rgba(0,0,0,0.53)" />, appLabel: 'HR', appHref: '/hr/leave' }
const projectsAppProps = { appIcon: <ProjectsIcon size={16} color="rgba(0,0,0,0.53)" />, appLabel: 'Projects', appHref: '/projects' }

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/people" element={<Directory />} />
      <Route path="/people/:id" element={<Profile />} />
      <Route
        path="/people/org-chart"
        element={<ComingSoon {...peopleAppProps} sidebar={<PeopleSidebar active="org-chart" />} title="Org chart" />}
      />
      <Route
        path="/people/my-team"
        element={<ComingSoon {...peopleAppProps} sidebar={<PeopleSidebar active="my-team" />} title="My team" />}
      />
      <Route
        path="/people/insights"
        element={<ComingSoon {...peopleAppProps} sidebar={<PeopleSidebar active="insights" />} title="Insights" />}
      />
      <Route
        path="/people/records"
        element={<ComingSoon {...peopleAppProps} sidebar={<PeopleSidebar active="records" />} title="Employee records" />}
      />

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

      <Route
        path="/time"
        element={<StandaloneComingSoon title="Time" description="Timesheets, calendar, and reporting aren't wired up yet in this build." />}
      />
      <Route
        path="/payroll"
        element={<StandaloneComingSoon title="Payroll" description="Payroll dashboard and reviews aren't wired up yet in this build." />}
      />

      <Route path="/projects" element={<ProjectsList />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/projects/clients" element={<Clients />} />
      <Route
        path="/projects/staffing"
        element={<ComingSoon {...projectsAppProps} sidebar={<ProjectsSidebar active="staffing" />} title="Staffing" />}
      />

      <Route
        path="/calendar"
        element={<StandaloneComingSoon title="Calendar" description="Month/list views and event creation aren't wired up yet in this build." />}
      />
      <Route
        path="/analytics"
        element={<StandaloneComingSoon title="Analytics" description="Company analytics and overview charts aren't wired up yet in this build." />}
      />
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
    </>
  )
}
