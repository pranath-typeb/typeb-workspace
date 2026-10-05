import { useEffect, useState } from 'react'
import { ChevronUpIcon } from './icons'

// A small floating "back to top" button — hidden near the top of a page, fades in
// once you've scrolled down a bit, and smooth-scrolls the window back to 0 on click.
const SHOW_AFTER_PX = 400

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      className={`scroll-to-top-btn${visible ? ' visible' : ''}`}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUpIcon size={18} color="var(--color-text-inverse)" />
    </button>
  )
}
