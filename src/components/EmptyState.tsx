import { useLocation, useNavigate } from 'react-router-dom'
import { SearchIcon } from './icons'

// "Nothing matches" block for filtered lists. Filters live in the URL (see lib/useUrlState), so
// "Clear filters" just drops every query param except the ones that pick a view (e.g. a tab).
export default function EmptyState({
  title,
  body,
  keep = [],
  compact,
}: {
  title: string
  body?: string
  // URL params that aren't filters and should survive "Clear filters" (e.g. 'tab', 'cycle').
  keep?: string[]
  compact?: boolean
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const filterKeys = [...params.keys()].filter((k) => !keep.includes(k))

  function clear() {
    const next = new URLSearchParams()
    keep.forEach((k) => params.get(k) !== null && next.set(k, params.get(k)!))
    const qs = next.toString()
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
  }

  return (
    <div className={`empty-state${compact ? ' compact' : ''}`}>
      <span className="empty-state-icon">
        <SearchIcon size={18} color="var(--color-text-tertiary)" />
      </span>
      <div className="empty-state-title">{title}</div>
      {(body || filterKeys.length > 0) && (
        <div className="empty-state-body">{body ?? 'Try a different search or remove a filter.'}</div>
      )}
      {filterKeys.length > 0 && (
        <button type="button" className="btn-outline" style={{ height: 34, marginTop: 4 }} onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}
