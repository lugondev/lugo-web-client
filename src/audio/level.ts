/** Raw RMS -> a 0..1 level usable by the UI.
 *
 * Log scale, not linear: human hearing is logarithmic, and normal speech RMS
 * only sits around 0.05-0.2 -- drawn linearly the circle barely moves when the
 * user speaks.
 */
export function rmsToLevel(rms: number): number {
  if (rms <= 0) return 0
  const db = 20 * Math.log10(rms)
  // -60dB (near silent) -> 0 ; -6dB (loud) -> 1
  const norm = (db + 60) / 54
  return Math.max(0, Math.min(1, norm))
}

/** Smoothing: rise fast, fall slow.
 *
 * Falling slow is intentional: speech has pauses between syllables, and tracking
 * them closely makes the circle flicker wildly instead of breathing.
 */
export function smoothLevel(prev: number, next: number, attack: number, release: number): number {
  const k = next > prev ? attack : release
  return prev + (next - prev) * k
}

/** Read the instantaneous level from an AnalyserNode. Returns 0 if there's no node. */
export function readLevel(analyser: AnalyserNode | null, buf: Float32Array<ArrayBuffer>): number {
  if (!analyser) return 0
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i]
  return rmsToLevel(Math.sqrt(sum / buf.length))
}
