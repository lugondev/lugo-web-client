import type { TalkState } from '../audio/conversation'
import './LugoMark.css'

// Dấu nhận diện Lugo — cùng ngôn ngữ với brand sheet (lugo-branding): vòng HỞ là
// LUGO, chấm cam là BẠN chèn vào khe hở. Khác landing ở chỗ App có âm thật: chấm
// nở theo giọng bạn (listening) và vòng thở theo tiếng Lugo (speaking) qua `level`,
// không phải chuyển động CSS giả. Thêm hai trạng thái App-only: connecting, error.

const R = 38
const CIRC = 2 * Math.PI * R // 238.76
const GAP = 34 // độ dài khoảng hở trên chu vi -> ~51 độ. Hở vừa đủ để chấm CHÈN
// vào, không phải khe rộng khiến chấm trông như lơ lửng bên ngoài.
const DASH = CIRC - GAP

// Chấm NẰM TRÊN chính đường tròn của vòng: cùng tâm (50,50), cùng bán kính R, tại
// góc -45 độ (hướng 1:30, trên-phải). Nhờ đó chấm bịt kín khoảng hở, không trôi ra.
const DOT_ANGLE = -45
const DOT_X = 50 + R * Math.cos((DOT_ANGLE * Math.PI) / 180)
const DOT_Y = 50 + R * Math.sin((DOT_ANGLE * Math.PI) / 180)

// <circle> vẽ từ 3 giờ, thuận chiều kim đồng hồ; với dasharray này TÂM khoảng hở
// nằm ở GAP_CENTER độ. Xoay đúng bằng ROT để tâm khe trùng góc chấm, nên chấm luôn
// ngồi CHÍNH GIỮA khe. Đổi R hay GAP thì ROT tự tính lại. (~-19.4)
const GAP_CENTER = ((DASH / CIRC) * 360 + 360) / 2
const ROT = 360 + DOT_ANGLE - GAP_CENTER

export function LugoMark({ state, level }: { state: TalkState; level: number }) {
  // Chấm là BẠN: nở theo giọng bạn khi bạn đang nói.
  const dotScale = state === 'listening' ? 1 + level * 0.85 : 1
  // Vòng là LUGO: thở nhẹ theo tiếng nó khi nó đang nói (kèm mấp máy "miệng" bằng CSS).
  const ringScale = state === 'speaking' ? 1 + level * 0.06 : 1

  return (
    <svg className="mark" data-state={state} viewBox="0 0 100 100" role="img" aria-hidden="true">
      <defs>
        {/* Đường cam→trắng cho trạng thái thinking (màu branding). */}
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

      {/* Đường cam→trắng TỰ VẼ quanh vòng khi Lugo nghĩ (thanh tiến trình tròn).
          Cùng cung với vòng nền, chừa đúng khoảng hở ở chấm; vẽ dần bằng CSS. Nằm
          DƯỚI chấm nên chấm "bạn" luôn ở trên. Chỉ hiện ở state thinking. */}
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
