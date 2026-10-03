import { useEffect, useState } from 'react'
import { haptic, hapticsSupported, type HapticKind } from './haptics'

// Subtle interface sounds, synthesised with the Web Audio API (no audio files). One delegated
// listener classifies each interaction and plays a different, very short sound for it. Everything
// is opt-out: Settings → Appearance → Interface sounds.

export type UiSoundKind = 'delete' | 'tap' | 'nav' | 'toggle-on' | 'toggle-off' | 'select' | 'open' | 'close' | 'success' | 'error' | 'notify'

export interface UiSoundSettings {
  enabled: boolean
  volume: number // 0–1
  haptics: boolean
}

const KEY = 'typeb-hr.ui-sounds.v1'
const DEFAULTS: UiSoundSettings = { enabled: true, volume: 0.5, haptics: true }

function load(): UiSoundSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULTS
}

let settings = load()
let listeners: Array<() => void> = []

export function updateUiSoundSettings(patch: Partial<UiSoundSettings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

export function useUiSoundSettings(): UiSoundSettings {
  const [v, setV] = useState(settings)
  useEffect(() => {
    const l = () => setV(settings)
    listeners.push(l)
    l()
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])
  return v
}

// ---- synthesis -----------------------------------------------------------------------------
let ctx: AudioContext | null = null
let bus: GainNode | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    bus = ctx.createGain()
    const soften = ctx.createBiquadFilter()
    soften.type = 'lowpass'
    soften.frequency.value = 5200
    bus.connect(soften)
    soften.connect(ctx.destination)
  }
  return ctx
}

interface Blip {
  freq: number
  to?: number // glide target
  dur: number
  gain: number
  at?: number // start offset (s)
  type?: OscillatorType
}

function play(blips: Blip[]) {
  const c = getCtx()
  if (!c || !bus) return
  if (c.state === 'suspended') void c.resume()
  bus.gain.value = settings.volume * settings.volume * 1.6 // squared: low settings are genuinely quiet
  const base = c.currentTime
  for (const b of blips) {
    const t = base + (b.at ?? 0)
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = b.type ?? 'sine'
    o.frequency.setValueAtTime(b.freq, t)
    if (b.to) o.frequency.exponentialRampToValueAtTime(b.to, t + b.dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(b.gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + b.dur)
    o.connect(g).connect(bus)
    o.start(t)
    o.stop(t + b.dur + 0.02)
  }
}

const SOUNDS: Record<UiSoundKind, Blip[]> = {
  tap: [{ freq: 1180, to: 820, dur: 0.035, gain: 0.07, type: 'triangle' }],
  nav: [{ freq: 540, to: 460, dur: 0.055, gain: 0.07 }],
  'toggle-on': [
    { freq: 620, dur: 0.05, gain: 0.07 },
    { freq: 930, dur: 0.08, gain: 0.07, at: 0.045 },
  ],
  'toggle-off': [
    { freq: 900, dur: 0.05, gain: 0.07 },
    { freq: 600, dur: 0.08, gain: 0.06, at: 0.045 },
  ],
  select: [
    { freq: 780, dur: 0.06, gain: 0.07 },
    { freq: 1170, dur: 0.045, gain: 0.025, at: 0.02 },
  ],
  delete: [
    { freq: 300, to: 130, dur: 0.12, gain: 0.1, type: 'triangle' },
    { freq: 180, to: 90, dur: 0.16, gain: 0.07, at: 0.05, type: 'triangle' },
  ],
  open: [{ freq: 380, to: 640, dur: 0.12, gain: 0.05 }],
  close: [{ freq: 600, to: 360, dur: 0.1, gain: 0.045 }],
  success: [
    { freq: 660, dur: 0.12, gain: 0.08 },
    { freq: 880, dur: 0.18, gain: 0.08, at: 0.08 },
    { freq: 1320, dur: 0.2, gain: 0.025, at: 0.1 },
  ],
  error: [
    { freq: 210, to: 150, dur: 0.14, gain: 0.1, type: 'triangle' },
    { freq: 180, to: 130, dur: 0.16, gain: 0.08, at: 0.12, type: 'triangle' },
  ],
  notify: [
    { freq: 988, dur: 0.1, gain: 0.07 },
    { freq: 1318, dur: 0.16, gain: 0.07, at: 0.08 },
  ],
}

let lastAt = 0

export function playUiSound(kind: UiSoundKind, force = false) {
  if (!force && !settings.enabled) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  const now = performance.now()
  if (!force && now - lastAt < 22) return
  lastAt = now
  play(SOUNDS[kind])
}

const HAPTIC_FOR: Record<UiSoundKind, HapticKind> = {
  tap: 'tap',
  nav: 'nav',
  'toggle-on': 'toggle',
  'toggle-off': 'toggle',
  select: 'select',
  open: 'open',
  close: 'close',
  success: 'success',
  error: 'error',
  notify: 'notify',
  delete: 'delete',
}

let lastTarget: HTMLElement | null = null

// Devices with no vibration motor (laptops) get a visual stand-in for the heavy delete "thump":
// the control gives a quick, small shake.
function visualThump(el: HTMLElement | null) {
  if (!el || !el.isConnected) return
  el.classList.remove('fx-shake')
  void el.offsetWidth // restart the animation if it's already running
  el.classList.add('fx-shake')
  setTimeout(() => el.classList.remove('fx-shake'), 320)
}

// One call for both senses; each respects its own setting.
export function feedback(kind: UiSoundKind, force = false) {
  playUiSound(kind, force)
  if (!(force || settings.haptics)) return
  if (hapticsSupported()) haptic(HAPTIC_FOR[kind])
  else if (kind === 'delete') visualThump(lastTarget)
}

// ---- interaction classifier ----------------------------------------------------------------
const NAV_SELECTOR = '[role="tab"], .mn-tab, .bn-app-item, .navitem, .navitem-sm, .focus-seg button, .focus-chips button'
const TAP_SELECTOR = 'button, a[href], [role="button"], summary, [role="switch"], [role="checkbox"]'

// Delete/remove-style actions: an explicit marker, a trash icon, or an obvious label.
const DESTRUCTIVE_LABEL = /\b(delete|remove|discard|trash)\b/i
function isDestructive(el: HTMLElement): boolean {
  if (el.hasAttribute('data-destructive') || el.querySelector('[data-icon="trash"]')) return true
  const label = `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''} ${el.textContent ?? ''}`
  return DESTRUCTIVE_LABEL.test(label) && label.length < 60
}

function onClick(e: MouseEvent) {
  if (!settings.enabled && !settings.haptics) return
  const el = e.target instanceof Element ? e.target : null
  if (!el || el.closest('[data-no-sound], .ss-option, .ss-backdrop, .modal-backdrop > :not(.modal)')) return

  const sw = el.closest<HTMLElement>('[role="switch"]')
  if (sw) {
    // React hasn't re-rendered yet, so aria-checked still holds the *old* value.
    feedback(sw.getAttribute('aria-checked') === 'true' ? 'toggle-off' : 'toggle-on')
    return
  }
  const cb = el.closest<HTMLInputElement>('input[type="checkbox"], input[type="radio"]')
  if (cb) {
    feedback(cb.checked ? 'toggle-on' : 'toggle-off')
    return
  }
  if (el.closest(NAV_SELECTOR)) {
    feedback('nav')
    return
  }
  const target = el.closest<HTMLElement>(TAP_SELECTOR)
  lastTarget = target
  if (target && !(target as HTMLButtonElement).disabled && target.getAttribute('aria-disabled') !== 'true') feedback(isDestructive(target) ? 'delete' : 'tap')
}

// Modals, sheets and cards sliding in/out get a soft open/close.
const SURFACE = '.modal-backdrop, .mn-sheet, .ss-sheet, .move-card'

function watchSurfaces() {
  const isSurface = (n: Node) => n instanceof Element && (n.matches(SURFACE) || !!n.querySelector(SURFACE))
  new MutationObserver((records) => {
    let opened = false
    let closed = false
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (isSurface(n)) opened = true
      })
      r.removedNodes.forEach((n) => {
        if (isSurface(n)) closed = true
      })
    }
    // Slightly after the tap that caused it, so the two sounds layer instead of colliding.
    if (opened) setTimeout(() => feedback('open'), 55)
    else if (closed) setTimeout(() => feedback('close'), 55)
  }).observe(document.body, { childList: true, subtree: true })
}

let started = false
export function initUiSounds() {
  if (started || typeof window === 'undefined') return
  started = true
  document.addEventListener('click', onClick, true)
  // Prime the audio context on the first gesture so later sounds are instant.
  const prime = () => {
    getCtx()
    window.removeEventListener('pointerdown', prime, true)
  }
  window.addEventListener('pointerdown', prime, true)
  watchSurfaces()
}
