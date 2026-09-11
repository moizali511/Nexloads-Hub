import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { departmentLabel } from '../utils/departments'

// Compact, overview-friendly version of the monthly progress chart:
// one row per active employee showing this month's number and the
// % change vs last month, without rendering a full chart for everyone.
export default function TeamPulse({ adminId, employees, onSelectEmployee }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (employees.length > 0) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length])

  async function load() {
    setLoading(true)
    const active = employees.filter((e) => e.active)
    const results = await Promise.all(
      active.map((e) =>
        supabase.rpc('get_monthly_progress_series', { p_caller_id: adminId, p_employee_id: e.id, p_months: 2 })
      )
    )
    const built = active.map((e, i) => {
      const data = results[i]?.data
      const series = data?.series || []
      const current = Number(series[series.length - 1]?.value) || 0
      const previous = Number(series[series.length - 2]?.value) || 0
      const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0)
      return { employee: e, metricLabel: data?.metric_label || '', current, pct }
    })
    built.sort((a, b) => b.current - a.current)
    setRows(built)
    setLoading(false)
  }

  return (
    <div className="card">
      <h3 className="card-title">Team pulse — this month vs last</h3>
      <div style={{ marginTop: 14, display: 'grid', gap: 4, maxHeight: 360, overflowY: 'auto' }} className="scrollbar-thin">
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active employees yet.</div>
        )}
        {!loading && rows.map(({ employee, metricLabel, current, pct }) => (
          <button
            key={employee.id}
            onClick={() => onSelectEmployee && onSelectEmployee(employee)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 4px', borderBottom: '1px solid var(--border-soft)',
              background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
              color: 'inherit', font: 'inherit',
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{employee.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{departmentLabel(employee.department)} · {metricLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{current}</div>
              <div style={{ fontSize: '0.75rem', color: pct >= 0 ? 'var(--success, #3ddc84)' : 'var(--danger)' }}>
                {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}%
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
