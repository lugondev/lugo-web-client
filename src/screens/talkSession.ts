import type { SessionRow } from '../api/history'

/** id của phiên gần nhất, nếu có -- dùng để Start talking nối tiếp thay vì
 * luôn tạo phiên mới. Không có phiên nào (mới tinh, hoặc tra cứu lỗi) ->
 * undefined, Start talking vẫn chạy như trước khi có tính năng này. */
export function latestSessionId(rows: SessionRow[]): string | undefined {
  return rows[0]?.id
}
