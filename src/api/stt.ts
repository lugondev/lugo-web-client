import { apiFetch } from './client'

// One flat option per (engine, model-variant) pair — mirrors the playground
// UI's single "STT model" select. Sourced from the Model Registry options
// endpoint (enabled + stage-valid entries only), not a per-engine fan-out.
export interface SttModelOption {
  engine: string
  model: string
  label: string
}

interface RegistryOption { engine: string; model_id: string; label: string }

export async function listSttModelOptions(): Promise<SttModelOption[]> {
  const resp = await apiFetch('/v1/model_registry/options?kind=stt')
  if (!resp.ok) throw new Error(`Server returned error ${resp.status}`)
  const opts = (((await resp.json()).data ?? []) as RegistryOption[])
  return opts.map((o) => ({ engine: o.engine, model: o.model_id, label: o.label }))
}
