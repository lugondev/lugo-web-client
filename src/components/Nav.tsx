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
      <span className="nav__spacer" />
      <button className="nav__btn" onClick={onLogout}>
        Đăng xuất
      </button>
    </nav>
  )
}
