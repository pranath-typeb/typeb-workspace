// Ambient focus sounds, synthesised with the Web Audio API so there are no audio files to
// ship or license. Everything starts from a user gesture (the Start button) which is what
// browsers require before audio can play.

export type SoundKey = 'off' | 'rain' | 'ocean' | 'cafe' | 'brown' | 'white' | 'tone'

export interface SoundDef {
  key: SoundKey
  label: string
  description: string
  // Two-stop gradient for the picker tile.
  from: string
  to: string
}

export const SOUNDS: SoundDef[] = [
  { key: 'off', label: 'Silence', description: 'No sound', from: '#3a3a3f', to: '#1c1c1f' },
  { key: 'rain', label: 'Rain', description: 'Soft steady rainfall', from: '#3a8f8c', to: '#0f3d3b' },
  { key: 'ocean', label: 'Ocean', description: 'Slow rolling waves', from: '#3b82f6', to: '#12306b' },
  { key: 'cafe', label: 'Café', description: 'Distant murmur', from: '#c9893a', to: '#5a3410' },
  { key: 'brown', label: 'Brown noise', description: 'Deep, warm rumble', from: '#8b5e3c', to: '#2d1b0e' },
  { key: 'white', label: 'White noise', description: 'Crisp, even hiss', from: '#9aa0a6', to: '#3c4043' },
  { key: 'tone', label: 'Focus tone', description: '10 Hz alpha binaural (headphones)', from: '#c084fc', to: '#4a1d7a' },
]

let ctx: AudioContext | null = null
let master: GainNode | null = null
let analyser: AnalyserNode | null = null
let nodes: AudioNode[] = []
let current: SoundKey = 'off'
let volume = 0.5
let playing = false
let playListeners: Array<() => void> = []
let gen = 0 // bumps on every start/stop so a delayed teardown never kills a newer sound

function setPlaying(v: boolean) {
  if (playing === v) return
  playing = v
  playListeners.forEach((l) => l())
}

export function isAmbientPlaying(): boolean {
  return playing
}

export function subscribeAmbient(l: () => void): () => void {
  playListeners.push(l)
  return () => {
    playListeners = playListeners.filter((x) => x !== l)
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    master.connect(analyser)
  }
  return ctx
}

function noiseBuffer(c: AudioContext, kind: 'white' | 'pink' | 'brown', seconds = 6): AudioBuffer {
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') {
        d[i] = w * 0.6
      } else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.969 * b2 + w * 0.153852
        b3 = 0.8665 * b3 + w * 0.3104856
        b4 = 0.55 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.016898
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      } else {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.2
      }
    }
  }
  return buf
}

function loopSource(c: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, kind)
  src.loop = true
  src.start()
  nodes.push(src)
  return src
}

function chain(c: AudioContext, src: AudioNode, ...rest: AudioNode[]): AudioNode {
  let prev: AudioNode = src
  for (const n of rest) {
    prev.connect(n)
    prev = n
    // The shared master bus outlives every sound — never track it for teardown.
    if (n !== master) nodes.push(n)
  }
  return prev
}

function filter(c: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  return f
}

function lfo(c: AudioContext, rate: number, depth: number, target: AudioParam) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.value = rate
  g.gain.value = depth
  o.connect(g)
  g.connect(target)
  o.start()
  nodes.push(o, g)
}

function build(c: AudioContext, key: SoundKey, out: AudioNode) {
  if (key === 'white') {
    chain(c, loopSource(c, 'white'), filter(c, 'lowpass', 9000), out)
  } else if (key === 'brown') {
    chain(c, loopSource(c, 'brown'), filter(c, 'lowpass', 900), out)
  } else if (key === 'rain') {
    const bed = c.createGain()
    bed.gain.value = 0.9
    chain(c, loopSource(c, 'pink'), filter(c, 'highpass', 500), filter(c, 'lowpass', 8500), bed, out)
    const drops = c.createGain()
    drops.gain.value = 0.35
    chain(c, loopSource(c, 'white'), filter(c, 'bandpass', 3800, 1.4), drops, out)
    lfo(c, 0.35, 0.18, drops.gain)
  } else if (key === 'ocean') {
    const swell = c.createGain()
    swell.gain.value = 0.55
    chain(c, loopSource(c, 'brown'), filter(c, 'lowpass', 650), swell, out)
    lfo(c, 0.09, 0.4, swell.gain)
    const foam = c.createGain()
    foam.gain.value = 0.12
    chain(c, loopSource(c, 'pink'), filter(c, 'bandpass', 1800, 0.5), foam, out)
    lfo(c, 0.09, 0.1, foam.gain)
  } else if (key === 'cafe') {
    const murmur = c.createGain()
    murmur.gain.value = 0.7
    chain(c, loopSource(c, 'pink'), filter(c, 'bandpass', 700, 0.7), filter(c, 'lowpass', 2600), murmur, out)
    lfo(c, 0.23, 0.22, murmur.gain)
    const clatter = c.createGain()
    clatter.gain.value = 0.05
    chain(c, loopSource(c, 'white'), filter(c, 'bandpass', 2400, 2), clatter, out)
    lfo(c, 0.7, 0.04, clatter.gain)
  } else if (key === 'tone') {
    const merger = c.createChannelMerger(2)
    const left = c.createOscillator()
    const right = c.createOscillator()
    left.frequency.value = 200
    right.frequency.value = 210
    const gl = c.createGain()
    const gr = c.createGain()
    gl.gain.value = 0.22
    gr.gain.value = 0.22
    left.connect(gl).connect(merger, 0, 0)
    right.connect(gr).connect(merger, 0, 1)
    left.start()
    right.start()
    merger.connect(out)
    nodes.push(left, right, gl, gr, merger)
    const pad = c.createGain()
    pad.gain.value = 0.3
    chain(c, loopSource(c, 'brown'), filter(c, 'lowpass', 300), pad, out)
  }
}

function teardown() {
  nodes.forEach((n) => {
    try {
      ;(n as AudioScheduledSourceNode).stop?.()
    } catch {
      // already stopped
    }
    try {
      n.disconnect()
    } catch {
      // already disconnected
    }
  })
  nodes = []
}

export function getAmbient(): SoundKey {
  return current
}

export function startAmbient(key: SoundKey, vol = volume) {
  volume = vol
  const c = getCtx()
  if (!c || !master) return
  const g = ++gen
  setPlaying(key !== 'off')
  void c.resume()
  const now = c.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setTargetAtTime(0, now, 0.15)
  window.setTimeout(() => {
    if (g !== gen) return
    teardown()
    current = key
    if (key === 'off' || !ctx || !master) return
    build(ctx, key, master)
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setTargetAtTime(volume, t, 0.5)
  }, 220)
}

export function stopAmbient() {
  if (!ctx || !master) return
  const g = ++gen
  setPlaying(false)
  const now = ctx.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setTargetAtTime(0, now, 0.25)
  window.setTimeout(() => {
    if (g === gen) teardown()
  }, 900)
}

export function resumeAmbient() {
  if (current === 'off') return
  startAmbient(current, volume)
}

export function setAmbientVolume(vol: number) {
  volume = vol
  if (!ctx || !master || current === 'off') return
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(vol, ctx.currentTime, 0.1)
}

// A soft two-note bell for phase changes — separate from the ambient bus.
export function playChime(kind: 'focus-end' | 'break-end' = 'focus-end') {
  const c = getCtx()
  if (!c) return
  void c.resume()
  const notes = kind === 'focus-end' ? [659.25, 880, 1318.5] : [880, 659.25]
  notes.forEach((freq, i) => {
    const o = c.createOscillator()
    const g = c.createGain()
    const t = c.currentTime + i * 0.22
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + 1.5)
  })
}

// Current output level, 0–1 (RMS of the master bus). Handy for a visualiser and for verifying playback.
export function getAmbientLevel(): number {
  if (!analyser) return 0
  const buf = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function getAmbientState(): string {
  return ctx ? ctx.state : 'no-context'
}

// Dev-only handle so playback can be verified from the console: __ambient.level() > 0 means sound is flowing.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __ambient: unknown }).__ambient = { level: getAmbientLevel, state: getAmbientState, playing: isAmbientPlaying }
}
