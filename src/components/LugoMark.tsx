import type { TalkState } from '../audio/conversation'
import './LugoMark.css'

const R = 38
const CIRC = 2 * Math.PI * R // 238.76
const GAP = 46 // độ dài khoảng hở trên chu vi -> ~70 độ
const DASH = CIRC - GAP

// Chấm nằm giữa khoảng hở: góc -45 độ, bán kính R.
const DOT_X = 50 + R * Math.cos(-Math.PI / 4)
const DOT_Y = 50 + R * Math.sin(-Math.PI / 4)

// Vì sao rotate(-10) chứ không phải số khác: <circle> trong SVG bắt đầu vẽ từ
// 3 giờ và đi thuận chiều kim đồng hồ. Với dasharray này, nét phủ 0..290.6 độ
// nên khoảng hở đã tự nằm ở tâm ~-35 độ (trên-phải). Xoay thêm -10 đưa tâm
// khoảng hở về đúng -45 độ, trùng vị trí chấm. Đổi R hay GAP thì phải tính lại.

export function LugoMark({ state, level }: { state: TalkState; level: number }) {
  // Chấm là BẠN: nở theo giọng bạn khi bạn đang nói.
  const dotScale = state === 'listening' ? 1 + level * 0.85 : 1
  // Vòng là LUGO: thở theo tiếng nó khi nó đang nói.
  const ringScale = state === 'speaking' ? 1 + level * 0.06 : 1

  return (
    <svg
      className="mark"
      data-state={state}
      viewBox="0 0 100 100"
      role="img"
      aria-hidden="true"
    >
      <g style={{ transform: `scale(${ringScale})`, transformOrigin: '50px 50px' }}>
        <circle
          className="mark__ring"
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${DASH} ${GAP}`}
          transform="rotate(-10 50 50)"
        />
      </g>
      <circle
        className="mark__dot"
        cx={DOT_X}
        cy={DOT_Y}
        r="7"
        style={{ transform: `scale(${dotScale})`, transformOrigin: `${DOT_X}px ${DOT_Y}px` }}
      />
    </svg>
  )
}
