import type { TalkState } from '../audio/conversation'
import './LugoMark.css'

// Lugo brand mark — same language as the brand sheet (lugo-branding): the OPEN ring
// is LUGO, the orange dot is YOU slotting into the gap. Unlike the landing page, the
// App has real audio: the dot swells with your voice (listening) and the ring breathes
// with Lugo's voice (speaking) via `level`, not fake CSS motion. Two App-only states
// added: connecting, error.

const R = 38
const CIRC = 2 * Math.PI * R // 238.76
const GAP = 34 // gap length along the circumference -> ~51 degrees. Wide enough for the
// dot to SLOT in, not so wide the dot looks like it's floating outside.
const DASH = CIRC - GAP

// The dot SITS ON the ring's own circle: same center (50,50), same radius R, at angle
// -45 degrees (1:30 o'clock, upper-right). This lets the dot seal the gap without drifting.
const DOT_ANGLE = -45
const DOT_X = 50 + R * Math.cos((DOT_ANGLE * Math.PI) / 180)
const DOT_Y = 50 + R * Math.sin((DOT_ANGLE * Math.PI) / 180)

// <circle> is drawn from 3 o'clock, clockwise; with this dasharray the CENTER of the gap
// lands at GAP_CENTER degrees. Rotate by exactly ROT so the gap center aligns with the dot
// angle, keeping the dot DEAD CENTER in the gap. Change R or GAP and ROT recomputes. (~-19.4)
const GAP_CENTER = ((DASH / CIRC) * 360 + 360) / 2
const ROT = 360 + DOT_ANGLE - GAP_CENTER

export function LugoMark({ state, level }: { state: TalkState; level: number }) {
  // The dot is YOU: swells with your voice when you're speaking.
  const dotScale = state === 'listening' ? 1 + level * 0.85 : 1
  // The ring is LUGO: breathes gently with its voice when it's speaking (with a "mouth" flicker in CSS).
  const ringScale = state === 'speaking' ? 1 + level * 0.06 : 1

  return (
    <svg className="mark" data-state={state} viewBox="0 0 100 100" role="img" aria-hidden="true">
      <defs>
        {/* Orange→white stroke for the thinking state (branding colors). */}
        <linearGradient id="lugo-runner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a00" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      <g className="mark__ringwrap" style={{ transform: `scale(${ringScale})`, transformOrigin: '50px 50px' }}>
        <circle
          className="mark__ring"
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${DASH} ${GAP}`}
          transform={`rotate(${ROT} 50 50)`}
        />
      </g>

      {/* Orange→white stroke that DRAWS ITSELF around the ring while Lugo thinks (circular
          progress bar). Same arc as the base ring, leaving exactly the gap at the dot; drawn
          gradually in CSS. Sits BELOW the dot so "your" dot stays on top. Only shows in the
          thinking state. */}
      <circle
        className="mark__runner"
        cx="50"
        cy="50"
        r={R}
        fill="none"
        stroke="url(#lugo-runner)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${DASH} ${GAP}`}
        transform={`rotate(${ROT} 50 50)`}
      />

      <circle
        className="mark__dot"
        cx={DOT_X}
        cy={DOT_Y}
        r="6"
        style={{ transform: `scale(${dotScale})`, transformOrigin: `${DOT_X}px ${DOT_Y}px` }}
      />
    </svg>
  )
}
