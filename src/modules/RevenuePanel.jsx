import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DateRangeFilter, { defaultDateRange } from '../components/crm/DateRangeFilter'

export default function RevenuePanel({ adminId }) {
  const [range, setRange] = useState(defaultDateRange())
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase.rpc('admin_dashboard_stats', { p_admin_id: adminId, p_start: range.start, p_end: range.end })
      .then(({ data }) => { if (data?.success) setStats(data.finance) })
  }, [range])

  return (
    <div className="card">
      <h3 className="card-title">Revenue & finance</h3>
      <DateRangeFilter value={range} onChange={setRange} />
      {stats && (
        <div className="stat-row" style={{ marginTop: 16 }}>
          <div className="stat-card"><div className="stat-label">Load value</div><div className="stat-value">${Number(stats.load_revenue || 0).toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Dispatch fees</div><div className="stat-value stat-accent">${Number(stats.dispatch_fees || 0).toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Deal fees</div><div className="stat-value">${Number(stats.deal_fees || 0).toLocaleString()}</div></div>
        </div>
      )}
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 16 }}>
        Dispatch fees are calculated from client dispatch % on loads. Dispatcher deal fees come from existing Deals module. Payroll remains separate under Payroll &amp; Bonuses.
      </p>
    </div>
  )
}
