import { apiFetch } from './client'

// One flat option per (engine, model-variant) pair — mirrors the playground
// UI's single "STT model" select. `model` is '' for engines without
// selectable variants (their default/only model).
export interface SttModelOption {
  engine: string
  model: string
  label: string
}

interface SttEngine { engine: string; available: boolean; detail?: string }
interface SttVariant { id: string; label?: string }

export async function listSttModelOptions(): Promise<SttModelOption[]> {
  const resp = await apiFetch('/v1/stt/engines')
  if (!resp.ok) throw new Error(`Server returned error ${resp.status}`)
  const engines = (((await resp.json()).data ?? []) as SttEngine[]).filter((e) => e.available)

  const variantLists = await Promise.all(engines.map(async (e) => {
    try {
      const r = await apiFetch(`/v1/stt/models?engine=${encodeURIComponent(e.engine)}`)
      if (!r.ok) return []
      return (((await r.json()).data?.models ?? []) as SttVariant[])
    } catch {
      return []
    }
  }))

  return engines.flatMap((e, i) => {
    const variants = variantLists[i]
    if (variants.length === 0) {
      return [{ engine: e.engine, model: '', label: e.detail ? `${e.engine} — ${e.detail}` : e.engine }]
    }
    return variants.map((v) => ({
      engine: e.engine,
      model: v.id,
      label: `${e.engine} — ${v.label || v.id}`,
    }))
  })
}
