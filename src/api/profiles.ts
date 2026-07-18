import { apiFetch } from './client'

export interface LlmConfig { base_url: string; api_key: string; model: string; engine: string }
export interface TtsConfig { profile_name: string }
export interface SttConfig { profile: string; engine: string; language: string; model: string }
export interface McpServer { name: string; url: string; headers: Record<string, string>; enabled: boolean }
export interface MemoryConfig {
  enabled: boolean; mode: string; top_k: number; extractor_model: string; embed_model: string
  compaction_threshold: number; max_facts: number; dedup_threshold: number
}
export interface SessionConfig { idle_timeout_s: number }

export interface Profile {
  name: string
  owner_id: string | null
  nickname: string
  llm: LlmConfig
  system_prompt: string
  voice_optimized: boolean
  stt: SttConfig
  tts: TtsConfig
  mcp_servers: McpServer[]
  memory: MemoryConfig
  session: SessionConfig
}

export type ProfileInput = Omit<Profile, 'owner_id'>
export interface LlmOption { id: string; engine: string; model_id: string; label: string }

async function errorFrom(resp: Response): Promise<Error> {
  let msg = ''
  try {
    const body = await resp.json()
    const raw = body?.error ?? body?.detail
    if (typeof raw === 'string') msg = raw
  } catch {
    // body không phải JSON -- rơi xuống thông báo mặc định
  }
  if (resp.status === 409) return new Error(msg || 'That name is already taken.')
  return new Error(msg || `Server returned error ${resp.status}`)
}

async function jsonData<T>(resp: Response): Promise<T> {
  if (!resp.ok) throw await errorFrom(resp)
  return (await resp.json()).data as T
}

export async function listProfiles(): Promise<Profile[]> {
  const resp = await apiFetch('/v1/profiles')
  const dict = await jsonData<Record<string, Profile>>(resp)
  return Object.values(dict ?? {}).sort(
    (a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name))
}

export async function getProfile(name: string): Promise<Profile> {
  return jsonData<Profile>(await apiFetch(`/v1/profiles/${encodeURIComponent(name)}`))
}

export async function createProfile(p: ProfileInput): Promise<Profile> {
  return jsonData<Profile>(await apiFetch('/v1/profiles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
  }))
}

export async function updateProfile(name: string, p: ProfileInput): Promise<Profile> {
  return jsonData<Profile>(await apiFetch(`/v1/profiles/${encodeURIComponent(name)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
  }))
}

export async function deleteProfile(name: string): Promise<void> {
  const resp = await apiFetch(`/v1/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!resp.ok) throw await errorFrom(resp)
}

export async function cloneProfile(name: string, newName: string): Promise<Profile> {
  return jsonData<Profile>(await apiFetch(`/v1/profiles/${encodeURIComponent(name)}/clone`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: newName }),
  }))
}

export async function listLlmOptions(): Promise<LlmOption[]> {
  return jsonData<LlmOption[]>(await apiFetch('/v1/profiles/llm-options'))
}
