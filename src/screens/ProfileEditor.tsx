import { useEffect, useState } from 'react'
import { createProfile, updateProfile, listLlmOptions, type LlmOption, type McpServer, type ProfileInput } from '../api/profiles'
import { listTtsProfiles, type TtsProfileSummary } from '../api/tts'
import { listSttModelOptions, type SttModelOption } from '../api/stt'
import { parseHeaders, serializeHeaders } from './profileForm'
import { Button } from '../ui/Button'
import './Profiles.css'

// Use raw <input>/<textarea> with aria-label instead of ui/TextInput|TextArea:
// those two components render their own <label htmlFor=id> and their onChange is a
// plain event (props = {label,id} & InputHTMLAttributes), not onChange(v). Raw +
// aria-label keeps the form compact and lets tests query by getByLabelText.

// Each MCP row keeps headers as a JSON string so the user can type freely; only
// parse on Save (a parse error blocks Save, without corrupting the in-progress state).
type McpRow = Omit<McpServer, 'headers'> & { headersText: string }

// Encode a profile's (engine, model) pair as the select's option value.
// '' = inherit server default. Mirrors the playground UI's flat STT select.
function sttKey(stt: { engine: string; model: string }): string {
  return stt.engine ? `${stt.engine}|${stt.model}` : ''
}

// Same encoding for the LLM select's (engine, model) pair.
function llmKey(llm: { engine: string; model: string }): string {
  return llm.engine ? `${llm.engine}|${llm.model}` : ''
}

export function ProfileEditor({
  mode, initial, onDone, onCancel,
}: {
  mode: 'create' | 'edit'
  initial: ProfileInput
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ProfileInput>(initial)
  const [mcp, setMcp] = useState<McpRow[]>(
    initial.mcp_servers.map((s) => ({ ...s, headersText: serializeHeaders(s.headers) })))
  const [llmOptions, setLlmOptions] = useState<LlmOption[]>([])
  const [ttsProfiles, setTtsProfiles] = useState<TtsProfileSummary[]>([])
  const [sttOptions, setSttOptions] = useState<SttModelOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listLlmOptions().then(setLlmOptions).catch(() => setLlmOptions([]))
    listTtsProfiles().then(setTtsProfiles).catch(() => setTtsProfiles([]))
    listSttModelOptions().then(setSttOptions).catch(() => setSttOptions([]))
  }, [])

  function patch(p: Partial<ProfileInput>): void { setForm((f) => ({ ...f, ...p })) }

  async function save(): Promise<void> {
    setError(null)
    let mcp_servers: McpServer[]
    try {
      mcp_servers = mcp.map((r) => ({
        name: r.name, url: r.url, enabled: r.enabled, headers: parseHeaders(r.headersText),
      }))
    } catch (e) {
      setError(`MCP headers: ${(e as Error).message}`)
      return
    }
    const payload: ProfileInput = { ...form, mcp_servers }
    setSaving(true)
    try {
      if (mode === 'create') await createProfile(payload)
      else await updateProfile(form.name, payload)
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pe">
      <div className="pe__bar">
        <Button variant="secondary" size="sm" onClick={onCancel}>Back</Button>
      </div>

      {error && <p className="pe__error" role="alert">{error}</p>}

      <fieldset className="pe__group">
        <legend>Basic</legend>
        <label className="pe__field">Name
          <input className="input" aria-label="Name" value={form.name} readOnly={mode === 'edit'}
            onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <label className="pe__field">Nickname
          <input className="input" aria-label="Nickname" value={form.nickname}
            onChange={(e) => patch({ nickname: e.target.value })} />
        </label>
        <label className="pe__check">
          <input type="checkbox" checked={form.voice_optimized}
            onChange={(e) => patch({ voice_optimized: e.target.checked })} />
          Voice optimized
        </label>
      </fieldset>

      <fieldset className="pe__group">
        <legend>LLM</legend>
        <label className="pe__field">Model
          <select className="input" aria-label="LLM model" value={llmKey(form.llm)}
            onChange={(e) => {
              const [engine = '', model = ''] = e.target.value ? e.target.value.split('|') : ['', '']
              // The registry now carries credentials for each engine/model, so
              // the profile no longer stores its own base_url/api_key.
              patch({ llm: { engine, model, base_url: '', api_key: '' } })
            }}>
            {llmOptions.length === 0 ? (
              <option value="" disabled>(no LLM models — add one in Model Registry)</option>
            ) : (
              <>
                <option value="">(server default)</option>
                {llmOptions.map((o) => (
                  <option key={`${o.engine}|${o.model_id}`} value={`${o.engine}|${o.model_id}`}>{o.label}</option>
                ))}
              </>
            )}
            {form.llm.engine && !llmOptions.some((o) => o.engine === form.llm.engine && o.model_id === form.llm.model) && (
              <option value={llmKey(form.llm)}>
                {form.llm.engine}{form.llm.model ? ` — ${form.llm.model}` : ''} (unavailable)
              </option>
            )}
          </select>
        </label>
      </fieldset>

      <fieldset className="pe__group">
        <legend>System prompt</legend>
        <textarea className="textarea" aria-label="System prompt" rows={4} value={form.system_prompt}
          onChange={(e) => patch({ system_prompt: e.target.value })} />
      </fieldset>

      <fieldset className="pe__group">
        <legend>STT</legend>
        <label className="pe__field">Model
          <select className="input" aria-label="STT model" value={sttKey(form.stt)}
            onChange={(e) => {
              const [engine = '', model = ''] = e.target.value ? e.target.value.split('|') : ['', '']
              patch({ stt: { ...form.stt, engine, model } })
            }}>
            <option value="">(server default)</option>
            {sttOptions.map((o) => (
              <option key={`${o.engine}|${o.model}`} value={`${o.engine}|${o.model}`}>{o.label}</option>
            ))}
            {form.stt.engine && !sttOptions.some((o) => o.engine === form.stt.engine && o.model === form.stt.model) && (
              <option value={sttKey(form.stt)}>
                {form.stt.engine}{form.stt.model ? ` — ${form.stt.model}` : ''} (unavailable)
              </option>
            )}
          </select>
        </label>
        <label className="pe__field">Language
          <input className="input" aria-label="STT language" value={form.stt.language}
            onChange={(e) => patch({ stt: { ...form.stt, language: e.target.value } })} />
        </label>
      </fieldset>

      <fieldset className="pe__group">
        <legend>TTS</legend>
        <label className="pe__field">Voice profile
          <select className="input" aria-label="TTS profile" value={form.tts.profile_name}
            onChange={(e) => patch({ tts: { profile_name: e.target.value } })}>
            <option value="">(server default)</option>
            {ttsProfiles.map((t) => <option key={t.name} value={t.name}>{t.nickname || t.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="pe__group">
        <legend>MCP servers</legend>
        {mcp.map((row, i) => (
          <div className="pe__mcp" key={i}>
            <label className="pe__field">Name
              <input className="input" aria-label={`MCP server ${i + 1} name`} value={row.name}
                onChange={(e) => setMcp((m) => m.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
            </label>
            <label className="pe__field">URL
              <input className="input" aria-label={`MCP server ${i + 1} url`} value={row.url}
                onChange={(e) => setMcp((m) => m.map((r, j) => j === i ? { ...r, url: e.target.value } : r))} />
            </label>
            <label className="pe__check">
              <input type="checkbox" checked={row.enabled}
                onChange={(e) => setMcp((m) => m.map((r, j) => j === i ? { ...r, enabled: e.target.checked } : r))} />
              Enabled
            </label>
            <label className="pe__field">Headers (JSON)
              <textarea className="textarea" aria-label={`MCP server ${i + 1} headers (JSON)`} rows={2} value={row.headersText}
                onChange={(e) => setMcp((m) => m.map((r, j) => j === i ? { ...r, headersText: e.target.value } : r))} />
            </label>
            <Button variant="secondary" size="sm" onClick={() => setMcp((m) => m.filter((_, j) => j !== i))}>
              {`Remove MCP server ${i + 1}`}
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm"
          onClick={() => setMcp((m) => [...m, { name: '', url: '', enabled: true, headersText: '{}' }])}>
          Add MCP server
        </Button>
      </fieldset>

      <fieldset className="pe__group">
        <legend>Memory</legend>
        <label className="pe__check">
          <input type="checkbox" checked={form.memory.enabled}
            onChange={(e) => patch({ memory: { ...form.memory, enabled: e.target.checked } })} />
          Enabled
        </label>
        <label className="pe__field">Mode
          <select className="input" aria-label="Memory mode" value={form.memory.mode}
            onChange={(e) => patch({ memory: { ...form.memory, mode: e.target.value } })}>
            <option value="all">all</option>
            <option value="semantic">semantic</option>
          </select>
        </label>
        <label className="pe__field">Top K
          <input className="input" aria-label="Memory top_k" type="number" value={form.memory.top_k}
            onChange={(e) => patch({ memory: { ...form.memory, top_k: Number(e.target.value) } })} />
        </label>
        <label className="pe__field">Extractor model
          <input className="input" aria-label="Memory extractor_model" value={form.memory.extractor_model}
            onChange={(e) => patch({ memory: { ...form.memory, extractor_model: e.target.value } })} />
        </label>
        <label className="pe__field">Embed model
          <input className="input" aria-label="Memory embed_model" value={form.memory.embed_model}
            onChange={(e) => patch({ memory: { ...form.memory, embed_model: e.target.value } })} />
        </label>
        <label className="pe__field">Compaction threshold
          <input className="input" aria-label="Memory compaction_threshold" type="number" value={form.memory.compaction_threshold}
            onChange={(e) => patch({ memory: { ...form.memory, compaction_threshold: Number(e.target.value) } })} />
        </label>
        <label className="pe__field">Max facts
          <input className="input" aria-label="Memory max_facts" type="number" value={form.memory.max_facts}
            onChange={(e) => patch({ memory: { ...form.memory, max_facts: Number(e.target.value) } })} />
        </label>
        <label className="pe__field">Dedup threshold
          <input className="input" aria-label="Memory dedup_threshold" type="number" step="0.01" value={form.memory.dedup_threshold}
            onChange={(e) => patch({ memory: { ...form.memory, dedup_threshold: Number(e.target.value) } })} />
        </label>
      </fieldset>

      <fieldset className="pe__group">
        <legend>Session</legend>
        <label className="pe__field">Idle timeout (s)
          <input className="input" aria-label="Session idle_timeout_s" type="number" value={form.session.idle_timeout_s}
            onChange={(e) => patch({ session: { idle_timeout_s: Number(e.target.value) } })} />
        </label>
      </fieldset>

      <div className="pe__actions">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={save}>Save</Button>
      </div>
    </div>
  )
}
