import { useEffect, useState } from 'react'
import { getMyUsage, type UsageRow } from '../api/usage'
import './Usage.css'

export function Usage() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('')

  async function refresh(p: string = period) {
    try {
      setRows(await getMyUsage(p.trim() || undefined))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load usage')
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalCost = rows.reduce((s, r) => s + (r.cost_usd || 0), 0)
  const totalCount = rows.reduce((s, r) => s + (r.count || 0), 0)

  return (
    <main className="usage">
      <div className="usage__head">
        <h1 className="usage__h">My Usage</h1>
        <label className="usage__period">
          Month
          <input
            className="input"
            value={period}
            placeholder="YYYY-MM"
            onChange={(e) => setPeriod(e.target.value)}
            onBlur={() => void refresh()}
          />
        </label>
      </div>
      <p className="usage__sub">What you've used, by kind and model.</p>

      {error && (
        <p className="usage__err" role="alert">
          {error}
        </p>
      )}

      {!error && rows.length === 0 ? (
        <p className="usage__empty">No usage recorded yet.</p>
      ) : (
        !error && (
          <table className="usage__table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Model</th>
                <th>Cost (USD)</th>
                <th>Amount</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.model_id}`}>
                  <td>{r.kind}</td>
                  <td>
                    <code>{r.model_id || '(none)'}</code>
                  </td>
                  <td>${(r.cost_usd || 0).toFixed(4)}</td>
                  <td>{(r.native_amount || 0).toLocaleString()}</td>
                  <td>{(r.count || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>${totalCost.toFixed(4)}</strong>
                </td>
                <td></td>
                <td>
                  <strong>{totalCount.toLocaleString()}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        )
      )}
    </main>
  )
}
