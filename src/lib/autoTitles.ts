// Anywhere text is cut off with an ellipsis ("Beacon Ongoing Sup…"), hovering it reveals the full text
// as a native tooltip. One delegated listener — no per-component work, and nothing is added to text
// that already fits or already has its own title.

const SKIP = 'input, textarea, select, [data-no-autotitle]'

function truncatedAncestor(start: Element | null): HTMLElement | null {
  let el = start as HTMLElement | null
  for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
    if (el.matches(SKIP)) return null
    const cs = getComputedStyle(el)
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) return el
    // multi-line clamp (-webkit-line-clamp) cut-off
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) return el
  }
  return null
}

export function initAutoTitles() {
  if (typeof document === 'undefined') return
  document.addEventListener(
    'mouseover',
    (e) => {
      const el = truncatedAncestor(e.target instanceof Element ? e.target : null)
      if (!el || el.hasAttribute('title')) return
      const text = (el.textContent ?? '').trim()
      if (text) el.setAttribute('title', text)
    },
    { passive: true },
  )
}
