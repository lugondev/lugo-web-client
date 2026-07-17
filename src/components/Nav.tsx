import './Nav.css'

export type Screen = 'talk' | 'history' | 'devices' | 'tools'

// Chỉ liệt kê màn CÓ THẬT. Nav trỏ tới màn không có là nói dối người dùng.
// Thứ tự thưa dần theo tần suất dùng: Nói là việc chính, Lịch sử là thứ bạn
// xem sau khi nói, Thiết bị là cấu hình, Công cụ là việc lặt vặt thỉnh thoảng.
const ITEMS: { id: Screen; label: string }[] = [
  { id: 'talk', label: 'Nói' },
  { id: 'history', label: 'Lịch sử' },
  { id: 'devices', label: 'Thiết bị' },
  { id: 'tools', label: 'Công cụ' },
]

export function Nav({
  current,
  onGo,
  onLogout,
}: {
  current: Screen
  onGo: (s: Screen) => void
  onLogout: () => void
}) {
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      {/* Bốn màn thật, ngang hàng nhau -- nhóm riêng và canh giữa trong phần
          còn lại sau khi trừ chỗ cho Đăng xuất. */}
      <div className="nav__tabs">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            className="nav__btn"
            aria-current={current === it.id ? 'page' : undefined}
            onClick={() => onGo(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>
      <span className="nav__divider" aria-hidden="true" />
      {/* Đăng xuất là HÀNH ĐỘNG, không phải một màn -- cố tình KHÔNG dùng
          nav__btn (không aria-current, không dáng pill/tab) để không đọc
          nhầm thành một mục ngang hàng với Nói/Lịch sử/Thiết bị/Công cụ. */}
      <button className="nav__logout" onClick={onLogout}>
        Đăng xuất
      </button>
    </nav>
  )
}
