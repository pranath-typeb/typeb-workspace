import { NavItem, NavGroupLabel, NavSep } from './NavItem'
import { ApprovalIcon, CalendarIcon, ChartIcon, ClockIcon, TimesheetIcon } from './icons'
import { CURRENT_USER_ID } from '../data/people'
import { overdueWeekCount, useSubmissions, useTimeEntries } from '../data/timeEntries'

export type TimeSection = 'my-time' | 'timesheets' | 'calendar' | 'reporting' | 'approvals'

export default function TimeSidebar({ active }: { active: TimeSection }) {
  const entries = useTimeEntries()
  const submissions = useSubmissions()
  const overdue = overdueWeekCount(entries, submissions, CURRENT_USER_ID)

  return (
    <>
      <NavGroupLabel label="General" />
      <NavItem to="/time" icon={<ClockIcon color={active === 'my-time' ? '#fafafa' : undefined} />} label="My time" active={active === 'my-time'} />
      <NavItem to="/time/timesheets" icon={<TimesheetIcon color={active === 'timesheets' ? '#fafafa' : undefined} />} label="Timesheets" active={active === 'timesheets'} badge={overdue} />
      <NavItem to="/time/calendar" icon={<CalendarIcon color={active === 'calendar' ? '#fafafa' : undefined} />} label="Calendar" active={active === 'calendar'} />
      <NavItem to="/time/reporting" icon={<ChartIcon color={active === 'reporting' ? '#fafafa' : undefined} />} label="Reporting" active={active === 'reporting'} />
      <NavSep />
      <NavGroupLabel label="Review" />
      <NavItem to="/time/approvals" icon={<ApprovalIcon color={active === 'approvals' ? '#fafafa' : undefined} />} label="Approvals" active={active === 'approvals'} />
    </>
  )
}
