import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Page filters live in the URL (?dept=Growth&q=ana) so the back button, a refresh or a shared link
// keeps them. Defaults are left out of the URL. Writes replace the current history entry (no entry per
// keystroke) and read the live location, so several setters fired together (e.g. "Clear all") all land.
function write(navigate: ReturnType<typeof useNavigate>, key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (value === null) params.delete(key)
  else params.set(key, value)
  const qs = params.toString()
  navigate({ pathname: window.location.pathname, search: qs ? `?${qs}` : '', hash: window.location.hash }, { replace: true })
}

export function useUrlParam<T extends string = string>(key: string, fallback: string): [T, (value: T) => void] {
  const location = useLocation()
  const navigate = useNavigate()
  const value = (new URLSearchParams(location.search).get(key) ?? fallback) as T
  const set = useCallback((v: T) => write(navigate, key, v === fallback || v === '' ? null : v), [navigate, key, fallback])
  return [value, set]
}

export function useUrlFlag(key: string): [boolean, (value: boolean) => void] {
  const location = useLocation()
  const navigate = useNavigate()
  const value = new URLSearchParams(location.search).get(key) === '1'
  const set = useCallback((v: boolean) => write(navigate, key, v ? '1' : null), [navigate, key])
  return [value, set]
}
