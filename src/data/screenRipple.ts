// Tiny pub-sub to trigger a one-off full-screen ripple effect from anywhere —
// currently just the timer widget's play/pause/stop buttons, as a quick visual test.
let listeners: Array<() => void> = []

export function triggerScreenRipple() {
  listeners.forEach((l) => l())
}

export function subscribeScreenRipple(fn: () => void) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
