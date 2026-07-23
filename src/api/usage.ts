import { apiFetch } from './client'

export type UsageRow = {
  kind: string
  model_id: string
  cost_usd: number
  native_amount: number
  count: number
}

export async function getMyUsage(period?: string): Promise<UsageRow[]> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : ''
  const resp = await apiFetch(`/v1/usage/me${qs}`)
  if (!resp.ok) throw new Error(`Server returned error ${resp.status}`)
  const body = await resp.json()
  return (body.data ?? []) as UsageRow[]
}
