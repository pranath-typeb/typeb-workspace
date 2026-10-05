// Haptic feedback. Honest scope:
//  • Android (Chrome/Edge/Firefox): real vibration via navigator.vibrate().
//  • iPhone/iPad Safari 17.4+: no vibrate API, but toggling a native <input type="checkbox" switch>
//    inside a user gesture fires the system tick — a known workaround, so it is a single tick per
//    segment and only inside a tap.
//  • Laptops/desktops: browsers expose no trackpad haptics, so this is silently a no-op.

export type HapticKind = 'tap' | 'nav' | 'toggle' | 'select' | 'open' | 'close' | 'success' | 'error' | 'notify' | 'delete'

// vibrate() pattern: [on, off, on, …] in ms.
const PATTERNS: Record<HapticKind, number[]> = {
  tap: [8],
  nav: [6],
  toggle: [12],
  select: [10],
  open: [8],
  close: [6],
  success: [12, 50, 24],
  error: [30, 40, 30],
  notify: [14, 45, 14],
  delete: [45, 35, 70], // heavier double-thump so it feels consequential
}

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
const isIOS = /iP(hone|ad|od)/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// Desktop Chrome exposes vibrate() but has no motor — only count it on touch/Android devices.
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && (/Android/i.test(ua) || navigator.maxTouchPoints > 0)

export function hapticsSupported(): boolean {
  return canVibrate || isIOS
}

export function hapticsSupportLabel(): string {
  if (canVibrate) return 'Supported on this device'
  if (isIOS) return 'Supported on this iPhone/iPad (system tick)'
  return 'Not available on this device — works on phones and tablets (laptops get a visual shake on delete)'
}

let iosLabel: HTMLLabelElement | null = null

function iosTick() {
  if (typeof document === 'undefined') return
  if (!iosLabel) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;'
    label.appendChild(input)
    document.body.appendChild(label)
    iosLabel = label
  }
  iosLabel.click()
}

export function haptic(kind: HapticKind) {
  const pattern = PATTERNS[kind]
  if (canVibrate) {
    navigator.vibrate(pattern)
    return
  }
  if (isIOS) {
    // One system tick per "on" segment; later ticks are best-effort (iOS only allows them in a gesture).
    pattern.forEach((ms, i) => {
      if (i % 2 === 0) setTimeout(iosTick, i === 0 ? 0 : pattern.slice(0, i).reduce((a, b) => a + b, 0))
    })
  }
}
