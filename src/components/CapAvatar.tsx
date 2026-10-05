import { useId, useState } from 'react'

// The founder's line-art avatar with a playful loop: every few seconds he tips his cap, and now
// and then takes it off, holds it up, and puts it back on. The single PNG is split into two SVG
// layers (cap / everything else) and a matching dome of hair is drawn where the cap sat.
// Respects prefers-reduced-motion (stays still).

// Cap silhouette in the artwork's 755×755 space (crown, back strap, brim) — a hair outside the
// outline so the full black stroke travels with the cap.
export const CAP_PATH =
  'M 149 326 C 150 337 176 341 202 340 L 246 335 L 247 285 L 338 277 L 440 262 L 542 263 C 549 250 549 232 546 222 C 536 156 468 104 386 104 C 330 104 282 130 254 172 C 236 202 234 236 240 264 L 238 270 L 152 317 Z'

// Scalp/hair revealed when the cap is off (same black fill + outline style as the artwork).
const DOME_PATH = 'M 247 272 C 238 214 292 160 386 160 C 476 160 536 206 540 270 Z'

const INK = '#111'

// Surprises that pop up from under the cap while it is off — a different one each time round.
function GagArt({ kind }: { kind: number }) {
  if (kind === 0) {
    // rubber duck (the developer's debugging buddy)
    return (
      <g className="gag-art gag-duck" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M -38 0 C -46 -16 -40 -28 -26 -30 L -20 -22 C -4 -32 20 -30 30 -14 C 30 -4 22 0 8 0 Z" fill="#ffd23f" />
        <circle cx="14" cy="-46" r="17" fill="#ffd23f" />
        <path d="M 29 -50 C 42 -52 48 -44 46 -40 C 40 -36 32 -38 29 -41 Z" fill="#ff8a1f" />
        <circle cx="20" cy="-52" r="3.4" fill="#fff" />
        <circle cx="21" cy="-52" r="1.7" fill={INK} stroke="none" />
        <path d="M -14 -12 C -4 -22 10 -20 14 -10" fill="none" />
      </g>
    )
  }
  if (kind === 1) {
    // steaming coffee
    return (
      <g className="gag-art gag-mug" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path className="steam s1" d="M -12 -54 q -7 -8 0 -15 q 7 -7 0 -15" fill="none" />
        <path className="steam s2" d="M 2 -54 q -7 -8 0 -15 q 7 -7 0 -15" fill="none" />
        <path className="steam s3" d="M 16 -54 q -7 -8 0 -15 q 7 -7 0 -15" fill="none" />
        <rect x="-26" y="-46" width="50" height="46" rx="7" fill="#fff" />
        <path d="M 24 -36 C 44 -36 44 -12 24 -12" fill="none" />
        <path d="M -26 -37 H 24" fill="none" />
        <path d="M -5 -22 c -6 -6 -1 -11 2 -8 c 3 -3 8 2 2 8 l -2 2 Z" fill="#e53935" strokeWidth="2.4" />
      </g>
    )
  }
  // ladybug — "found the bug!"
  return (
    <g className="gag-art gag-bug" stroke={INK} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M -10 -34 q -8 -16 -20 -16" fill="none" />
      <path d="M 10 -34 q 8 -16 20 -16" fill="none" />
      <path d="M -13 -30 a 13 13 0 0 1 26 0 Z" fill={INK} />
      <path d="M -36 0 A 36 36 0 0 1 36 0 Z" fill="#e53935" />
      <path d="M 0 -35 V 0" fill="none" />
      <circle cx="-19" cy="-12" r="5.5" fill={INK} stroke="none" />
      <circle cx="19" cy="-12" r="5.5" fill={INK} stroke="none" />
      <circle cx="-10" cy="-26" r="4.5" fill={INK} stroke="none" />
      <circle cx="10" cy="-26" r="4.5" fill={INK} stroke="none" />
    </g>
  )
}

export default function CapAvatar({ src, className = '' }: { src: string; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const gagClipId = `cap-gag-${uid}`
  // Start on a random surprise, then rotate to the next one every time the loop restarts.
  const [gag, setGag] = useState(() => Math.floor(Math.random() * 3))
  const maskId = `cap-mask-${uid}`
  const clipId = `cap-clip-${uid}`

  return (
    <svg className={`cap-avatar ${className}`} viewBox="0 0 755 755" role="img" aria-label="Avatar" preserveAspectRatio="xMidYMid slice">
      <defs>
        <clipPath id={gagClipId}>
          <rect x="300" y="0" width="300" height="180" />
        </clipPath>
        <clipPath id={clipId}>
          <path d={CAP_PATH} />
        </clipPath>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="755" height="755">
          <rect width="755" height="755" fill="white" />
          <path d={CAP_PATH} fill="black" />
        </mask>
      </defs>

      <g className="cap-sway">
      {/* everything except the cap */}
      <g mask={`url(#${maskId})`}>
        <image href={src} width="755" height="755" />
      </g>
      {/* patch the hole with the artwork's own background grey so it vanishes */}
      <path d={CAP_PATH} fill="#f6f6f6" />
      {/* hair under the cap */}
      <path d={DOME_PATH} fill="#0a0a0a" />
      {/* the cap */}
      <g className="cap-layer" clipPath={`url(#${clipId})`} onAnimationIteration={(e) => e.animationName === 'cap-loop' && setGag((g) => (g + 1) % 3)}>
        <image href={src} width="755" height="755" />
      </g>
      {/* a surprise hiding under the cap — pops up while it is off */}
      <g clipPath={`url(#${gagClipId})`}>
        <g transform="translate(448 178) scale(2.2)">
          <g className="gag-pop">
            <g className="gag-wiggle">
              <GagArt kind={gag} />
            </g>
          </g>
        </g>
      </g>
      </g>
    </svg>
  )
}
