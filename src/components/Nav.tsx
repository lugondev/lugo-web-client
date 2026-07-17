import './Nav.css'

export type Screen = 'talk' | 'devices'

// Chỉ liệt kê màn CÓ THẬT. Spec vẽ nav 4 mục, nhưng History và Tools chưa tồn
// tại -- nav trỏ tới màn không có là nói dối người dùng. Thêm vào khi có thật.
const ITEMS: { id: Screen; label: string }[] = [
  { id: 'talk', label: 'Nói' },
  { id: 'devices', label: 'Thiết bị' },
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
      {/* Nói và Thiết bị là hai màn thật, ngang hàng nhau -- nhóm riêng và
          canh giữa trong phần còn lại sau khi trừ chỗ cho Đăng xuất. */}
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
          nhầm thành mục thứ ba ngang hàng với Nói/Thiết bị. */}
      <button className="nav__logout" onClick={onLogout}>
        Đăng xuất
      </button>
    </nav>
  )
}
