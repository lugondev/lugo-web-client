// Nơi DUY NHẤT feature-detect. Gom về một chỗ để khi một trình duyệt thiếu thứ
// gì đó, ta nói thật được là thiếu cái nào -- thay vì để mic bật lên rồi người
// dùng ngồi nói vào khoảng không.
export type AudioSupport = { ok: true } | { ok: false; missing: string[] }

export function checkAudioSupport(): AudioSupport {
  const missing: string[] = []
  // WebCodecs: cần để giải mã Opus server đẩy về qua socket.
  if (typeof (globalThis as any).AudioDecoder === 'undefined') missing.push('AudioDecoder')
  if (typeof (globalThis as any).AudioContext === 'undefined') missing.push('AudioContext')
  if (!(globalThis as any).navigator?.mediaDevices?.getUserMedia) missing.push('getUserMedia')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
