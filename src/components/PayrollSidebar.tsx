import { NavItem, NavGroupLabel } from './NavItem'
import { PayrollFileIcon } from './icons'
import { usePayrollPeriods } from '../data/payroll'

export type PayrollSection = 'dashboard' | 'reviews' | 'my-payroll'

export default function PayrollSidebar({ active }: { active: PayrollSection }) {
  const periods = usePayrollPeriods()
  const needsAttention = periods.filter((p) => p.status === 'Under review' || p.status === 'Update needed').length

  return (
    <>
      <NavGroupLabel label="General" />
      <NavItem to="/payroll" icon={<PayrollFileIcon color={active === 'dashboard' ? 'var(--color-text-inverse)' : undefined} />} label="Dashboard" active={active === 'dashboard'} />
      <NavItem to="/payroll/reviews" icon={<PayrollFileIcon color={active === 'reviews' ? 'var(--color-text-inverse)' : undefined} />} label="Reviews" active={active === 'reviews'} badge={needsAttention} />
      <NavItem to="/payroll/my" icon={<PayrollFileIcon color={active === 'my-payroll' ? 'var(--color-text-inverse)' : undefined} />} label="My Payroll" active={active === 'my-payroll'} />
    </>
  )
}
