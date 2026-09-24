import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ColdCallerPanel({ employeeId }) {
  const [today, setToday] = useState({ calls_made: 0, confirmed_sales: 0, daily_call_target: 100 })
  const [monthActivity, setMonthActivity] = useState([])
  const [fleets, setFleets] = useState([])
  const [commission, setCommission] = useState(null)
  const [bonuses, setBonuses] = useState([])
  const [savingDaily, setSavingDaily] = useState(false)
  const [showFleetForm, setShowFleetForm] = useState(false)
  const [fleetForm, setFleetForm] = useState({ carrier_name: '', country: 'USA' })

  const todayStr = () => new Date().toISOString().slice(0, 10)
  const monthStr = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: activity }, { data: fleetsRes }, { data: commRes }, { data: bonusRes }] = await Promise.all([
      supabase.rpc('get_my_coldcaller_activity', { p_employee_id: employeeId, p_month: monthStr() }),
      supabase.rpc('get_my_fleets', { p_cold_caller_id: employeeId }),
      supabase.rpc('calculate_coldcaller_commission', { p_caller_id: employeeId, p_cold_caller_id: employeeId, p_month: monthStr() }),
      supabase.rpc('get_my_bonuses', { p_employee_id: employeeId, p_month: monthStr() }),
    ])
    const list = activity || []
    setMonthActivity(list)
    const todays = list.find((a) => a.log_date === todayStr())
    if (todays) setToday(todays)
    setFleets(fleetsRes || [])
    if (commRes?.success) setCommission(commRes)
    setBonuses(bonusRes || [])
  }

  async function saveDaily() {
    setSavingDaily(true)
    await supabase.rpc('log_coldcaller_activity', {
      p_employee_id: employeeId,
      p_log_date: todayStr(),
      p_calls_made: Number(today.calls_made) || 0,
      p_confirmed_sales: Number(today.confirmed_sales) || 0,
    })
    setSavingDaily(false)
    load()
  }

  async function addFleet(e) {
    e.preventDefault()
    await supabase.rpc('add_fleet', {
      p_cold_caller_id: employeeId,
      p_carrier_name: fleetForm.carrier_name.trim(),
      p_country: fleetForm.country,
      p_agreement_signed_at: new Date().toISOString(),
    })
    setFleetForm({ carrier_name: '', country: 'USA' })
    setShowFleetForm(false)
    load()
  }

  async function addTruck(fleetId) {
    const truckNumber = window.prompt('Truck number / unit ID?')
    if (!truckNumber) return
    await supabase.rpc('add_truck', {
      p_cold_caller_id: employeeId, p_fleet_id: fleetId,
      p_truck_number: truckNumber.trim(), p_activated_at: new Date().toISOString(),
    })
    load()
  }

  async function markFirstLoad(truckId) {
    await supabase.rpc('mark_truck_first_load', { p_cold_caller_id: employeeId, p_truck_id: truckId })
    load()
  }

  const remaining = Math.max(0, (Number(today.daily_call_target) || 100) - (Number(today.calls_made) || 0))
  const monthTotalCalls = monthActivity.reduce((s, a) => s + a.calls_made, 0)
  const monthTotalSales = monthActivity.reduce((s, a) => s + a.confirmed_sales, 0)

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-label">Calls left today</div>
          <div className="stat-value stat-accent">{remaining}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Calls this month</div>
          <div className="stat-value">{monthTotalCalls}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Confirmed sales this month</div>
          <div className="stat-value">{monthTotalSales}</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Today's calls</h3>
        <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Calls made</label>
            <input type="number" min="0" style={{ maxWidth: 140 }} value={today.calls_made}
              onChange={(e) => setToday({ ...today, calls_made: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Confirmed sales</label>
            <input type="number" min="0" style={{ maxWidth: 140 }} value={today.confirmed_sales}
              onChange={(e) => setToday({ ...today, confirmed_sales: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={savingDaily} onClick={saveDaily}>
            {savingDaily ? 'Saving…' : 'Save today'}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Daily target: {today.daily_call_target || 100} calls
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 className="card-title">My fleets & trucks</h3>
          <button className="btn-ghost" onClick={() => setShowFleetForm((s) => !s)}>
            {showFleetForm ? 'Cancel' : '+ New fleet'}
          </button>
        </div>

        {showFleetForm && (
          <form onSubmit={addFleet} style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Carrier / fleet name</label>
              <input required value={fleetForm.carrier_name} onChange={(e) => setFleetForm({ ...fleetForm, carrier_name: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Country</label>
              <select
                value={fleetForm.country}
                onChange={(e) => setFleetForm({ ...fleetForm, country: e.target.value })}
                style={{ background: 'var(--bg-panel-raised)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', borderRadius: 10, padding: '0.75rem 0.9rem' }}
              >
                <option value="USA">USA</option>
                <option value="Canada">Canada</option>
              </select>
            </div>
            <button className="btn-primary">Add fleet</button>
          </form>
        )}

        <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
          {fleets.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No fleets signed yet.</div>}
          {fleets.map(({ fleet, trucks }) => (
            <div key={fleet.id} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{fleet.carrier_name} <span className="pill">{fleet.country}</span></div>
                <button className="btn-ghost" onClick={() => addTruck(fleet.id)}>+ Add truck</button>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {trucks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Truck {t.truck_number}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t.first_load_completed_at ? '✓ First load done' : (
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => markFirstLoad(t.id)}>
                          Mark first load done
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {commission && (
        <div className="card">
          <h3 className="card-title">My commission this month</h3>
          <div className="stat-row" style={{ marginTop: 16 }}>
            <Stat label="Base salary" value={`PKR ${Number(commission.base_salary_pkr).toLocaleString()}`} />
            <Stat label="Activated trucks" value={commission.activated_trucks_count} />
            <Stat label="Total commission" value={`$${Number(commission.total_commission_usd).toFixed(2)}`} accent />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Performance level: <span style={{ color: 'var(--orange-1)' }}>{commission.performance_level}</span>
          </div>
        </div>
      )}

      {bonuses.length > 0 && (
        <div className="card">
          <h3 className="card-title">Bonuses this month</h3>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {bonuses.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{b.reason}</span>
                <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>
                  {b.currency === 'PKR' ? 'PKR ' : '$'}{Number(b.amount).toLocaleString()}
                </span>
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
