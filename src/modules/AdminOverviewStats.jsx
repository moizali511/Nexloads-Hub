import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DateRangeFilter, { defaultDateRange } from '../components/crm/DateRangeFilter'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function AdminOverviewStats({ adminId }) {
  const [range, setRange] = useState(defaultDateRange())
  const [stats, setStats] = useState(null)

  useEffect(() => {
    load()
  }, [range.start, range.end])

  async function load() {
    const { data } = await supabase.rpc('admin_dashboard_stats', {
      p_admin_id: adminId,
      p_start: range.start,
      p_end: range.end,
    })
    if (data?.success) setStats(data)
  }

  const chartData = stats ? [
    { name: 'New leads', value: stats.sales?.new_leads || 0 },
    { name: 'Contacted', value: stats.sales?.contacted || 0 },
    { name: 'Interested', value: stats.sales?.interested || 0 },
    { name: 'Converted', value: stats.sales?.converted || 0 },
    { name: 'Lost', value: stats.sales?.lost || 0 },
  ] : []

  return (
    <div>
      <DateRangeFilter value={range} onChange={setRange} />
      {!stats && <div style={{ color: 'var(--text-muted)' }}>Loading dashboard… (apply migration 002 if empty)</div>}
      {stats && (
        <>
          <div className="stat-row stat-row-4" style={{ marginTop: 12 }}>
            <div className="stat-card"><div className="stat-label">Active staff</div><div className="stat-value">{stats.employees?.active}</div></div>
            <div className="stat-card"><div className="stat-label">Online</div><div className="stat-value stat-accent">{stats.employees?.online}</div></div>
            <div className="stat-card"><div className="stat-label">Clocked in</div><div className="stat-value">{stats.employees?.clocked_in}</div></div>
            <div className="stat-card"><div className="stat-label">Loads in progress</div><div className="stat-value">{stats.operations?.loads_in_progress}</div></div>
          </div>
          <div className="dashboard-grid" style={{ marginTop: 16 }}>
            <div className="card">
              <h3 className="card-title">Sales pipeline</h3>
              <div style={{ width: '100%', height: 220, marginTop: 12 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#e8741a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3 className="card-title">Finance snapshot</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: '0.9rem' }}>
                <li>Load revenue: <strong>${Number(stats.finance?.load_revenue || 0).toLocaleString()}</strong></li>
                <li>Dispatch fees (loads): <strong>${Number(stats.finance?.dispatch_fees || 0).toLocaleString()}</strong></li>
                <li>Dispatcher deal fees: <strong>${Number(stats.finance?.deal_fees || 0).toLocaleString()}</strong></li>
                <li>Pending payments: <strong>{stats.finance?.pending_payments}</strong></li>
                <li>Paid (period): <strong>{stats.finance?.paid_payments}</strong></li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
