import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { supabase } from '../supabaseClient'

// Shows the last `months` months of an employee's performance as a bar
// chart, with the current month highlighted, plus a "vs last month"
// call-out. Works for every department — the RPC decides what number
// to use (dispatch fee, trucks activated, or logged performance).
export default function MonthlyProgressChart({ callerId, employeeId, months = 6, title = 'Monthly progress' }) {
  const [series, setSeries] = useState([])
  const [metricLabel, setMetricLabel] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('get_monthly_progress_series', {
      p_caller_id: callerId,
      p_employee_id: employeeId,
      p_months: months,
    })
    if (data?.success) {
      setMetricLabel(data.metric_label)
      setSeries(
        (data.series || []).map((s) => ({
          month: monthShort(s.month),
          value: Number(s.value) || 0,
        }))
      )
    }
    setLoading(false)
  }

  function monthShort(ym) {
    const [y, m] = ym.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short' })
  }

  const current = series[series.length - 1]?.value ?? 0
  const previous = series[series.length - 2]?.value ?? 0
  const diff = current - previous
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : (current > 0 ? 100 : 0)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 className="card-title">{title}</h3>
          {metricLabel && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{metricLabel}</div>
          )}
        </div>
        {series.length >= 2 && (
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">This month vs last</div>
            <div
              className="stat-value"
              style={{ fontSize: '1.2rem', color: diff >= 0 ? 'var(--success, #3ddc84)' : 'var(--danger)' }}
            >
              {diff >= 0 ? '▲' : '▼'} {Math.abs(pct)}%
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 16 }}>Loading…</div>}

      {!loading && series.every((s) => s.value === 0) && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 16 }}>
          No activity logged yet — the chart will fill in as data comes in.
        </div>
      )}

      {!loading && (
        <div style={{ height: 220, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={46} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8rem' }}
                labelStyle={{ color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {series.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={index === series.length - 1 ? 'var(--orange-1)' : 'rgba(255,143,79,0.35)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
