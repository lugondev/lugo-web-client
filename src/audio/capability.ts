// The ONE place we feature-detect. Centralized so that when a browser is missing
// something, we can honestly say which one -- instead of turning the mic on and
// leaving the user talking into the void.
export type AudioSupport = { ok: true } | { ok: false; missing: string[] }

export function checkAudioSupport(): AudioSupport {
  const missing: string[] = []
  // WebCodecs: needed to decode the Opus the server pushes over the socket.
  if (typeof (globalThis as any).AudioDecoder === 'undefined') missing.push('AudioDecoder')
  if (typeof (globalThis as any).AudioContext === 'undefined') missing.push('AudioContext')
  if (!(globalThis as any).navigator?.mediaDevices?.getUserMedia) missing.push('getUserMedia')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
