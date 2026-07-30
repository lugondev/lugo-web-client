import { useEffect, useState } from 'react'
import { getMyUsage, type UsageRow } from '../api/usage'
import { Button } from '../ui/Button'
import './Usage.css'

export function Usage({ onBack }: { onBack?: () => void }) {
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
    <main className="page">
      {/* Reached from Settings now, not the nav -- see Tools.tsx for the same note. */}
      {onBack && (
        <div className="page__back">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ‹ Settings
          </Button>
        </div>
      )}
      <div className="page__head">
        {/* Same words as the Settings row that opens it. */}
        <h1 className="page__title">My usage</h1>
      </div>
      <p className="page__sub">What you've used, by kind and model.</p>

      <div className="usage__filter">
        <label className="usage__period" htmlFor="usage-period">
          Month
        </label>
        <input
          id="usage-period"
          className="input"
          value={period}
          placeholder="YYYY-MM"
          onChange={(e) => setPeriod(e.target.value)}
          onBlur={() => void refresh()}
        />
      </div>

      {error && (
        <p className="usage__err" role="alert">
          {error}
        </p>
      )}

      {!error && rows.length === 0 ? (
        <p className="empty">No usage recorded yet.</p>
      ) : (
        !error && (
          <div className="usage__scroll">
          <table className="usage__table">
            {/* Kind and model share one column: five columns cannot fit a phone,
                and the model id is the one value long enough to need its own
                line anyway. */}
            <thead>
              <tr>
                <th>Source</th>
                <th>Cost</th>
                <th>Amount</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.model_id}`}>
                  <td>
                    <span className="usage__kind">{r.kind}</span>
                    <span className="usage__model">{r.model_id || '(none)'}</span>
                  </td>
                  <td>${(r.cost_usd || 0).toFixed(4)}</td>
                  <td>{(r.native_amount || 0).toLocaleString()}</td>
                  <td>{(r.count || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>${totalCost.toFixed(4)}</td>
                <td></td>
                <td>{totalCount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        )
      )}
    </main>
  )
}
