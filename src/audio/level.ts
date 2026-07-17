/** RMS thô -> mức 0..1 dùng được cho UI.
 *
 * Thang log chứ không tuyến tính: tai người nghe theo log, và RMS giọng nói
 * bình thường chỉ quanh 0.05-0.2 -- vẽ tuyến tính thì vòng tròn gần như không
 * nhúc nhích khi người dùng nói.
 */
export function rmsToLevel(rms: number): number {
  if (rms <= 0) return 0
  const db = 20 * Math.log10(rms)
  // -60dB (gần như im) -> 0 ; -6dB (to) -> 1
  const norm = (db + 60) / 54
  return Math.max(0, Math.min(1, norm))
}

/** Làm mượt: lên nhanh, xuống chậm.
 *
 * Xuống chậm là chủ ý: giọng nói có khoảng lặng giữa các âm tiết, và bám sát
 * chúng khiến vòng tròn nhấp nháy loạn thay vì thở.
 */
export function smoothLevel(prev: number, next: number, attack: number, release: number): number {
  const k = next > prev ? attack : release
  return prev + (next - prev) * k
}

/** Đọc mức tức thời từ một AnalyserNode. Trả 0 nếu chưa có node. */
export function readLevel(analyser: AnalyserNode | null, buf: Float32Array<ArrayBuffer>): number {
  if (!analyser) return 0
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i]
  return rmsToLevel(Math.sqrt(sum / buf.length))
}
