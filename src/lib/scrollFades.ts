// Edge-fade affordance for horizontally scrollable areas: a soft fade on whichever
// side still has content hidden, so people can tell the row/table scrolls.
// CSS (see "scroll fades" in index.css) reads data-fade-start / data-fade-end.

const SELECTOR = [
  '.scroll-x',
  '.sidebar-inner',
  '.bn-bar-center',
  '.cal-scroller',
  '.card:has(> table)',
  '[style*="overflow-x: auto"]',
].join(',')

const EDGE_TOLERANCE = 2
const tracked = new WeakSet<Element>()
let observer: ResizeObserver | null = null

function update(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth
  const scrollable = max > EDGE_TOLERANCE
  el.toggleAttribute('data-fade-start', scrollable && el.scrollLeft > EDGE_TOLERANCE)
  el.toggleAttribute('data-fade-end', scrollable && el.scrollLeft < max - EDGE_TOLERANCE)
}

function track(el: HTMLElement) {
  if (tracked.has(el)) return
  tracked.add(el)
  el.addEventListener('scroll', () => update(el), { passive: true })
  observer?.observe(el)
  Array.from(el.children).forEach((c) => observer?.observe(c))
  update(el)
}

function scan() {
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach(track)
  document.querySelectorAll<HTMLElement>('[data-fade-start],[data-fade-end]').forEach(update)
}

export function initScrollFades() {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver((entries) => {
    entries.forEach((e) => {
      const host = (e.target.matches(SELECTOR) ? e.target : e.target.parentElement) as HTMLElement | null
      if (host) update(host)
    })
  })

  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      scan()
    })
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', schedule)
  schedule()
}
