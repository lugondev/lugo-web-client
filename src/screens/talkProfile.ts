export const PROFILE_KEY = 'lugo.talkProfile'

/** Chọn profile ban đầu: giữ lựa chọn đã lưu nếu còn tồn tại, không thì lấy
 * cái đầu danh sách. '' nghĩa là không có profile nào (dùng default server). */
export function resolveInitialProfile(saved: string | null, names: string[]): string {
  if (saved && names.includes(saved)) return saved
  return names[0] ?? ''
}
