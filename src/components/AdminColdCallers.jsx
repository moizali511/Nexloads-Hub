import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminColdCallers({ adminId, employees }) {
  const [activity, setActivity] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [commission, setCommission] = useState(null)
  const [loadingComm, setLoadingComm] = useState(false)

  const coldCallers = employees.filter((e) => e.department === 'cold_caller')
  const monthStr = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    loadActivity()
  }, [])

  async function loadActivity() {
    const { data } = await supabase.rpc('admin_get_all_coldcaller_activity', { p_admin_id: adminId, p_month: monthStr() })
    if (data?.success) setActivity(data.activity)
  }

  async function runCommission() {
    if (!selectedId) return
    setLoadingComm(true)
    const { data } = await supabase.rpc('calculate_coldcaller_commission', {
      p_caller_id: adminId, p_cold_caller_id: selectedId, p_month: monthStr(),
    })
    setLoadingComm(false)
    if (data?.success) setCommission(data)
  }

  const byEmployee = {}
  activity.forEach((a) => {
    if (!byEmployee[a.employee_id]) byEmployee[a.employee_id] = { full_name: a.full_name, calls: 0, sales: 0 }
    byEmployee[a.employee_id].calls += a.calls_made
    byEmployee[a.employee_id].sales += a.confirmed_sales
  })

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className="card">
        <h3 className="card-title">Cold caller activity — this month</h3>
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {Object.keys(byEmployee).length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity logged yet.</div>
          )}
          {Object.entries(byEmployee).map(([id, stats]) => (
            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{ fontWeight: 500 }}>{stats.full_name}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {stats.calls} calls · {stats.sales} confirmed sales
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Salary & commission calculator</h3>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ background: 'var(--bg-panel-raised)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', borderRadius: 10, padding: '0.75rem 0.9rem' }}
          >
            <option value="">Select cold caller…</option>
            {coldCallers.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={runCommission} disabled={loadingComm || !selectedId}>
            {loadingComm ? 'Calculating…' : 'Calculate'}
          </button>
        </div>

        {commission && (
          <div className="stat-row" style={{ marginTop: 20 }}>
            <Stat label="Base salary" value={`PKR ${Number(commission.base_salary_pkr).toLocaleString()}`} />
            <Stat label="Activated trucks" value={commission.activated_trucks_count} />
            <Stat label="Tier commission" value={`$${Number(commission.tier_commission_usd).toFixed(2)}`} />
            <Stat label="Fleet bonus" value={`$${Number(commission.fleet_bonus_usd).toFixed(2)}`} />
            <Stat label="Canada bonus" value={`$${Number(commission.canada_bonus_usd).toFixed(2)}`} />
            <Stat label="Performance bonus" value={`$${Number(commission.performance_bonus_usd).toFixed(2)}`} />
            <Stat label="Total commission" value={`$${Number(commission.total_commission_usd).toFixed(2)}`} accent />
            <Stat label="Performance level" value={commission.performance_level} accent />
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent ? 'stat-accent' : ''}`} style={{ fontSize: typeof value === 'string' && value.length > 10 ? '1.1rem' : undefined }}>{value}</div>
    </div>
  )
}
