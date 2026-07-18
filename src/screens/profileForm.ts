import type { Profile, ProfileInput } from '../api/profiles'

export function emptyProfileInput(): ProfileInput {
  return {
    name: '',
    nickname: '',
    llm: { base_url: '', api_key: '', model: '', engine: '' },
    system_prompt: '',
    voice_optimized: false,
    stt: { profile: '', engine: '', language: '', model: '' },
    tts: { profile_name: '' },
    mcp_servers: [],
    memory: {
      enabled: true, mode: 'all', top_k: 5, extractor_model: '', embed_model: '',
      compaction_threshold: 20, max_facts: 200, dedup_threshold: 0.92,
    },
    session: { idle_timeout_s: 30 },
  }
}

export function toEditableInput(p: Profile): ProfileInput {
  return {
    name: p.name,
    nickname: p.nickname,
    // Never send the "***" mask back to the server: blank = keep existing key.
    llm: { ...p.llm, api_key: '' },
    system_prompt: p.system_prompt,
    voice_optimized: p.voice_optimized,
    stt: { ...p.stt },
    tts: { ...p.tts },
    mcp_servers: p.mcp_servers.map((s) => ({ ...s, headers: { ...s.headers } })),
    memory: { ...p.memory },
    session: { ...p.session },
  }
}

export function parseHeaders(text: string): Record<string, string> {
  if (!text.trim()) return {}
  const parsed = JSON.parse(text) // throws SyntaxError on malformed JSON
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object, e.g. {"X-Key": "value"}')
  }
  for (const v of Object.values(parsed)) {
    if (typeof v !== 'string') throw new Error('Every header value must be a string')
  }
  return parsed as Record<string, string>
}

export function serializeHeaders(h: Record<string, string>): string {
  return JSON.stringify(h ?? {}, null, 2)
}
