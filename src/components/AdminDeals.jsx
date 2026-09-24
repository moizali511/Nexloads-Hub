import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminDeals({ adminId }) {
  const [deals, setDeals] = useState([])
  const [summary, setSummary] = useState([])
  const [targetDrafts, setTargetDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)

  const thisMonth = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: dealsRes }, { data: summaryRes }] = await Promise.all([
      supabase.rpc('admin_get_all_deals', { p_admin_id: adminId }),
      supabase.rpc('admin_get_sales_summary', { p_admin_id: adminId, p_month: thisMonth() }),
    ])
    if (dealsRes?.success) setDeals(dealsRes.deals)
    if (summaryRes?.success) setSummary(summaryRes.summary)
  }

  async function saveTarget(employeeId) {
    const val = parseFloat(targetDrafts[employeeId])
    if (isNaN(val)) return
    setSavingId(employeeId)
    await supabase.rpc('admin_set_monthly_target', {
      p_admin_id: adminId, p_employee_id: employeeId, p_month: thisMonth(), p_target_amount: val,
    })
    setSavingId(null)
    load()
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className="card">
        <h3 className="card-title">Dispatcher sales — this month</h3>
        <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {summary.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No dispatch employees yet.</div>}
          {summary.map((s) => {
            // Target is measured against dispatch FEE earned, not load amount sold.
            const pct = s.target_amount > 0 ? Math.min(100, Math.round((s.total_fee_amount / s.target_amount) * 100)) : null
            return (
              <div key={s.employee_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.position} · {s.deal_count} deals</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>${Number(s.total_load_amount).toLocaleString()} sold</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--orange-1)' }}>${Number(s.total_fee_amount).toLocaleString()} fee earned</div>
                  </div>
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 8, height: 6, borderRadius: 4, background: 'var(--bg-panel-raised)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-brand)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <input
                    type="number" placeholder="Set fee target ($)"
                    style={{ maxWidth: 160 }}
                    value={targetDrafts[s.employee_id] ?? s.target_amount ?? ''}
                    onChange={(e) => setTargetDrafts({ ...targetDrafts, [s.employee_id]: e.target.value })}
                  />
                  <button className="btn-ghost" disabled={savingId === s.employee_id} onClick={() => saveTarget(s.employee_id)}>
                    {savingId === s.employee_id ? 'Saving…' : 'Save target'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">All deals</h3>
        <div style={{ marginTop: 16, maxHeight: 480, overflowY: 'auto' }} className="scrollbar-thin">
          {deals.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No deals yet.</div>}
          {deals.map((d) => (
            <div key={d.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{d.customer_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {d.invoice_number}</span></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    by {d.full_name} · {d.pickup_location} → {d.drop_location}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>${Number(d.load_amount).toLocaleString()}</div>
                  <span className="pill" style={{
                    background: d.payment_status === 'paid' ? 'rgba(61,220,132,0.14)' : 'rgba(255,122,26,0.14)',
                    color: d.payment_status === 'paid' ? 'var(--success)' : 'var(--orange-1)',
                  }}>
                    {d.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
