import { NavItem, NavGroupLabel } from './NavItem'
import { PayrollFileIcon } from './icons'

export type PayrollSection = 'dashboard' | 'reviews' | 'my-payroll'

export default function PayrollSidebar({ active }: { active: PayrollSection }) {
  return (
    <>
      <NavGroupLabel label="General" />
      <NavItem to="/payroll" icon={<PayrollFileIcon color={active === 'dashboard' ? '#fafafa' : undefined} />} label="Dashboard" active={active === 'dashboard'} />
      <NavItem to="/payroll/reviews" icon={<PayrollFileIcon color={active === 'reviews' ? '#fafafa' : undefined} />} label="Reviews" active={active === 'reviews'} />
      <NavItem to="/payroll/my" icon={<PayrollFileIcon color={active === 'my-payroll' ? '#fafafa' : undefined} />} label="My Payroll" active={active === 'my-payroll'} />
    </>
  )
}
