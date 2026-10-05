import { Link } from 'react-router-dom'
import { ChevronRightIcon } from './icons'

export interface BreadcrumbItem {
  label: string
  to?: string // omit for the current page (last item is never a link, even with `to` set)
}

// Replaces a plain "← Back" link on detail/sub-pages with a real trail back through the
// hierarchy — each crumb is an actual link to that page, not browser-history-dependent like
// navigate(-1), so it still makes sense if you arrived here via a direct link or a different
// parent than usual (e.g. a timesheet reached from Approvals instead of My Time).
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {i > 0 && <ChevronRightIcon size={11} color="var(--color-text-tertiary)" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                style={{ color: 'var(--color-text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                style={{
                  color: isLast ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isLast ? 600 : 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
