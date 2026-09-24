import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateTime12h, formatTime12h } from '../utils/formatTime'
import { departmentLabel } from '../utils/departments'
import MonthlyProgressChart from './MonthlyProgressChart'
import AdminEmployeeWorkspace from './AdminEmployeeWorkspace'

export default function AdminEmployeeDetail({ adminId, employee, onBack }) {
  const [timelogs, setTimelogs] = useState([])
  const [deals, setDeals] = useState([])
  const [salesSummary, setSalesSummary] = useState(null)
  const [callActivity, setCallActivity] = useState([])
  const [fleets, setFleets] = useState([])
  const [commission, setCommission] = useState(null)
  const [performanceLogs, setPerformanceLogs] = useState([])
  const [bonuses, setBonuses] = useState([])
  const [closings, setClosings] = useState([])
  const [loading, setLoading] = useState(true)

  const department = employee.department || 'dispatcher'
  const isColdCaller = department === 'cold_caller'
  const isDispatcher = department === 'dispatcher'
  const usesPerfLogs = !isColdCaller && !isDispatcher
  const monthStr = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id])

  async function load() {
    setLoading(true)
    const calls = [
      supabase.rpc('get_my_timelogs', { p_employee_id: employee.id }),
      supabase.rpc('get_my_bonuses', { p_employee_id: employee.id, p_month: monthStr() }),
      supabase.rpc('get_my_closings', { p_employee_id: employee.id }),
    ]
    if (isColdCaller) {
      calls.push(
        supabase.rpc('get_my_coldcaller_activity', { p_employee_id: employee.id, p_month: monthStr() }),
        supabase.rpc('get_my_fleets', { p_cold_caller_id: employee.id }),
        supabase.rpc('calculate_coldcaller_commission', { p_caller_id: adminId, p_cold_caller_id: employee.id, p_month: monthStr() }),
      )
    } else if (isDispatcher) {
      calls.push(
        supabase.rpc('get_my_deals', { p_employee_id: employee.id }),
        supabase.rpc('get_my_sales_summary', { p_employee_id: employee.id, p_month: monthStr() }),
      )
    } else {
      calls.push(
        supabase.rpc('get_my_performance_logs', { p_employee_id: employee.id, p_month: monthStr() }),
      )
    }

    const results = await Promise.all(calls)
    setTimelogs(results[0].data || [])
    setBonuses(results[1].data || [])
    setClosings(results[2].data || [])

    if (isColdCaller) {
      setCallActivity(results[3].data || [])
      setFleets(results[4].data || [])
      if (results[5].data?.success) setCommission(results[5].data)
    } else if (isDispatcher) {
      setDeals(results[3].data || [])
      if (results[4].data?.success) setSalesSummary(results[4].data)
    } else {
      setPerformanceLogs(results[3].data || [])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" onClick={onBack}>← Back to Employees</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>{employee.full_name}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {employee.position} · {departmentLabel(department)} · {employee.email} {!employee.active && <span className="pill" style={{ marginLeft: 6, background: 'rgba(255,92,92,0.14)', color: 'var(--danger)' }}>Inactive</span>}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">Base salary</div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>
              {employee.base_salary_currency === 'PKR' ? 'PKR ' : '$'}{Number(employee.base_salary || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <AdminEmployeeWorkspace adminId={adminId} employeeId={employee.id} />

      <MonthlyProgressChart callerId={adminId} employeeId={employee.id} title="Monthly progress" />

      {loading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && isColdCaller && commission && (
        <div className="card">
          <h3 className="card-title">Commission this month</h3>
          <div className="stat-row" style={{ marginTop: 14 }}>
            <Stat label="Activated trucks" value={commission.activated_trucks_count} />
            <Stat label="Tier commission" value={`$${Number(commission.tier_commission_usd).toFixed(2)}`} />
            <Stat label="Fleet bonus" value={`$${Number(commission.fleet_bonus_usd).toFixed(2)}`} />
            <Stat label="Canada bonus" value={`$${Number(commission.canada_bonus_usd).toFixed(2)}`} />
            <Stat label="Performance bonus" value={`$${Number(commission.performance_bonus_usd).toFixed(2)}`} />
            <Stat label="Total commission" value={`$${Number(commission.total_commission_usd).toFixed(2)}`} accent />
          </div>
        </div>
      )}

      {!loading && isColdCaller && (
        <div className="card">
          <h3 className="card-title">Calls & fleets</h3>
          <div style={{ marginTop: 14, display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }} className="scrollbar-thin">
            {callActivity.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No call activity logged yet.</div>}
            {callActivity.map((a) => (
              <div key={a.log_date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{a.log_date}</span>
                <span style={{ color: 'var(--text-muted)' }}>{a.calls_made} calls · {a.confirmed_sales} sales</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            {fleets.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No fleets signed yet.</div>}
            {fleets.map(({ fleet, trucks }) => (
              <div key={fleet.id} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{fleet.carrier_name} <span className="pill">{fleet.country}</span></div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{trucks.length} truck(s)</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && isDispatcher && (
        <div className="card">
          <h3 className="card-title">Deals & sales</h3>
          {salesSummary && (
            <div className="stat-row" style={{ marginTop: 14 }}>
              <Stat label="This month's sales" value={`$${Number(salesSummary.total_load_amount).toLocaleString()}`} />
              <Stat label="Fee earned" value={`$${Number(salesSummary.total_fee_amount).toLocaleString()}`} accent />
              <Stat label="Fee target" value={salesSummary.target_amount > 0 ? `$${Number(salesSummary.target_amount).toLocaleString()}` : 'Not set'} />
            </div>
          )}
          <div style={{ marginTop: 16, maxHeight: 280, overflowY: 'auto' }} className="scrollbar-thin">
            {deals.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No deals logged yet.</div>}
            {deals.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
                <span>{d.customer_name} · {d.invoice_number}</span>
                <span style={{ color: 'var(--text-muted)' }}>${Number(d.load_amount).toLocaleString()} (fee ${Number(d.fee_amount).toLocaleString()})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && usesPerfLogs && (
        <div className="card">
          <h3 className="card-title">Performance log — this month</h3>
          <div style={{ marginTop: 14, display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }} className="scrollbar-thin">
            {performanceLogs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing logged yet this month.</div>}
            {performanceLogs.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
                <span>{l.log_date} · {l.metric_label}{l.notes ? ` — ${l.notes}` : ''}</span>
                <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>{l.metric_value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div className="card">
          <h3 className="card-title">Bonuses this month</h3>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {bonuses.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None this month.</div>}
            {bonuses.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{b.reason}</span>
                <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>{b.currency === 'PKR' ? 'PKR ' : '$'}{Number(b.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div className="card">
          <h3 className="card-title">Closed months</h3>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {closings.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No months closed yet.</div>}
            {closings.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border-soft)', padding: '6px 0' }}>
                <span>{c.closed_month}</span>
                <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>
                  {c.total_usd > 0 && `$${Number(c.total_usd).toLocaleString()}`}
                  {c.total_usd > 0 && c.total_pkr > 0 && ' + '}
                  {c.total_pkr > 0 && `PKR ${Number(c.total_pkr).toLocaleString()}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div className="card">
          <h3 className="card-title">Time logs</h3>
          <div style={{ marginTop: 12, maxHeight: 240, overflowY: 'auto' }} className="scrollbar-thin">
            {timelogs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No shifts logged yet.</div>}
            {timelogs.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
                <span>{formatDateTime12h(l.clock_in)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{l.clock_out ? `→ ${formatTime12h(l.clock_out)}` : 'In progress'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent ? 'stat-accent' : ''}`}>{value}</div>
    </div>
  )
}
