import { useEffect, useState } from 'react'
import { createProfile, updateProfile, listLlmOptions, type LlmOption, type McpServer, type ProfileInput } from '../api/profiles'
import { listTtsProfiles, type TtsProfileSummary } from '../api/tts'
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
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listLlmOptions().then(setLlmOptions).catch(() => setLlmOptions([]))
    listTtsProfiles().then(setTtsProfiles).catch(() => setTtsProfiles([]))
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
        <label className="pe__field">Engine
          <input className="input" aria-label="LLM engine" list="llm-engines" value={form.llm.engine}
            onChange={(e) => patch({ llm: { ...form.llm, engine: e.target.value } })} />
        </label>
        <label className="pe__field">Model
          <input className="input" aria-label="LLM model" list="llm-models" value={form.llm.model}
            onChange={(e) => patch({ llm: { ...form.llm, model: e.target.value } })} />
        </label>
        <datalist id="llm-engines">
          {[...new Set(llmOptions.map((o) => o.engine))].map((e) => <option key={e} value={e} />)}
        </datalist>
        <datalist id="llm-models">
          {llmOptions.map((o) => <option key={o.id} value={o.model_id}>{o.label}</option>)}
        </datalist>
        <label className="pe__field">Base URL
          <input className="input" aria-label="LLM base_url" value={form.llm.base_url}
            onChange={(e) => patch({ llm: { ...form.llm, base_url: e.target.value } })} />
        </label>
        <label className="pe__field">API key
          <input className="input" aria-label="API key" type="password" placeholder="leave blank to keep existing"
            value={form.llm.api_key}
            onChange={(e) => patch({ llm: { ...form.llm, api_key: e.target.value } })} />
        </label>
      </fieldset>

      <fieldset className="pe__group">
        <legend>System prompt</legend>
        <textarea className="textarea" aria-label="System prompt" rows={4} value={form.system_prompt}
          onChange={(e) => patch({ system_prompt: e.target.value })} />
      </fieldset>

      <fieldset className="pe__group">
        <legend>STT</legend>
        <label className="pe__field">Engine
          <input className="input" aria-label="STT engine" value={form.stt.engine}
            onChange={(e) => patch({ stt: { ...form.stt, engine: e.target.value } })} />
        </label>
        <label className="pe__field">Language
          <input className="input" aria-label="STT language" value={form.stt.language}
            onChange={(e) => patch({ stt: { ...form.stt, language: e.target.value } })} />
        </label>
        <label className="pe__field">Model
          <input className="input" aria-label="STT model" value={form.stt.model}
            onChange={(e) => patch({ stt: { ...form.stt, model: e.target.value } })} />
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
