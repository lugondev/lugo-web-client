import { apiFetch } from './client'

export interface TtsProfileSummary { name: string; nickname?: string }

export async function listTtsProfiles(): Promise<TtsProfileSummary[]> {
  const resp = await apiFetch('/v1/tts/profiles')
  if (!resp.ok) throw new Error(`Server returned error ${resp.status}`)
  const dict = ((await resp.json()).data ?? {}) as Record<string, { nickname?: string }>
  return Object.entries(dict)
    .map(([name, v]) => ({ name, nickname: v?.nickname }))
    .sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name))
}
