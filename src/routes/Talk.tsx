// Placeholder. Nội dung thật (WS realtime, VAD, barge-in, vòng tròn logo làm
// chỉ báo trạng thái) thuộc plan sau -- plan này chỉ dựng khung + auth.
export function Talk({ onLogout }: { onLogout: () => void }) {
  return (
    <main data-surface="talk" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
        <p style={{ opacity: 0.6 }}>Talk — sắp có</p>
        <button onClick={onLogout} style={{ background: 'none', border: '1px solid currentColor', color: 'inherit', padding: '8px 16px', borderRadius: 8 }}>
          Đăng xuất
        </button>
      </div>
    </main>
  )
}
