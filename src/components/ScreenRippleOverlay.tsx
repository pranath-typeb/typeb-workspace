import { useEffect, useRef, useState } from 'react'
import { subscribeScreenRipple } from '../data/screenRipple'

export default function ScreenRippleOverlay() {
  const [playKey, setPlayKey] = useState(0)
  const [active, setActive] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () =>
      subscribeScreenRipple(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setPlayKey((k) => k + 1)
        setActive(true)
        timeoutRef.current = setTimeout(() => setActive(false), 450)
      }),
    [],
  )

  if (!active) return null
  return <div key={playKey} className="screen-ripple" />
}
