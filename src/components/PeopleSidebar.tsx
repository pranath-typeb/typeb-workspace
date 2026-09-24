import { NavItem, NavGroupLabel, NavSep } from './NavItem'
import { GridIcon, OrgChartIcon, PeopleIcon, InsightsIcon, RecordsIcon } from './icons'

export type PeopleSection = 'directory' | 'org-chart' | 'my-team' | 'insights' | 'records'

export default function PeopleSidebar({ active }: { active: PeopleSection }) {
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
