import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const emptyForm = {
  customer_name: '', truck_ref: '', pickup_location: '', drop_location: '',
  pickup_date: '', delivery_date: '', load_amount: '', dispatch_fee_percent: '', notes: '',
}

export default function DealsPanel({ employeeId }) {
  const [deals, setDeals] = useState([])
  const [summary, setSummary] = useState(null)
  const [bonuses, setBonuses] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const thisMonth = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: dealsRes }, { data: summaryRes }, { data: bonusRes }] = await Promise.all([
      supabase.rpc('get_my_deals', { p_employee_id: employeeId }),
      supabase.rpc('get_my_sales_summary', { p_employee_id: employeeId, p_month: thisMonth() }),
      supabase.rpc('get_my_bonuses', { p_employee_id: employeeId, p_month: thisMonth() }),
    ])
    setDeals(dealsRes || [])
    if (summaryRes?.success) setSummary(summaryRes)
    setBonuses(bonusRes || [])
  }

  const feePreview = () => {
    const amt = parseFloat(form.load_amount)
    const pct = parseFloat(form.dispatch_fee_percent)
    if (isNaN(amt) || isNaN(pct)) return null
    return (amt * pct / 100).toFixed(2)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data } = await supabase.rpc('add_deal', {
      p_employee_id: employeeId,
      p_customer_name: form.customer_name.trim(),
      p_truck_ref: form.truck_ref.trim(),
      p_pickup_location: form.pickup_location.trim(),
      p_drop_location: form.drop_location.trim(),
      p_pickup_date: form.pickup_date || null,
      p_delivery_date: form.delivery_date || null,
      p_load_amount: parseFloat(form.load_amount),
      p_dispatch_fee_percent: parseFloat(form.dispatch_fee_percent),
      p_notes: form.notes.trim() || null,
    })
    setBusy(false)
    if (!data?.success) {
      setError('Could not save the deal. Check the amounts and try again.')
      return
    }
    setForm(emptyForm)
    setShowForm(false)
    load()
  }

  async function togglePaid(deal) {
    await supabase.rpc('set_deal_payment_status', {
      p_employee_id: employeeId,
      p_deal_id: deal.id,
      p_status: deal.payment_status === 'paid' ? 'pending' : 'paid',
    })
    load()
  }

  // Target is measured against dispatch FEE earned, not total load amount
  // sold — the target represents fee, per policy.
  const pct = summary && summary.target_amount > 0
    ? Math.min(100, Math.round((summary.total_fee_amount / summary.target_amount) * 100))
    : null

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {summary && (
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-label">This month's sales</div>
            <div className="stat-value stat-accent">${Number(summary.total_load_amount).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Dispatch fee earned</div>
            <div className="stat-value">${Number(summary.total_fee_amount).toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monthly target (fee)</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>
              {summary.target_amount > 0 ? `$${Number(summary.target_amount).toLocaleString()}` : 'Not set'}
            </div>
            {pct !== null && (
              <div style={{ marginTop: 8, height: 6, borderRadius: 4, background: 'var(--bg-panel-raised)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gradient-brand)' }} />
              </div>
            )}
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

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 className="card-title">Deals & Invoices</h3>
          <button className="btn-ghost" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ New deal'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} style={{ marginTop: 18, display: 'grid', gap: 12, maxWidth: 480 }}>
            <Field label="Customer / broker name">
              <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </Field>
            <Field label="Truck / driver reference">
              <input required value={form.truck_ref} onChange={(e) => setForm({ ...form, truck_ref: e.target.value })} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Pickup location">
                <input required value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} />
              </Field>
              <Field label="Drop location">
                <input required value={form.drop_location} onChange={(e) => setForm({ ...form, drop_location: e.target.value })} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Pickup date">
                <input type="date" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
              </Field>
              <Field label="Delivery date">
                <input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Load amount ($)">
                <input type="number" step="0.01" min="0" required value={form.load_amount} onChange={(e) => setForm({ ...form, load_amount: e.target.value })} />
              </Field>
              <Field label="Dispatch fee (%)">
                <input type="number" step="0.01" min="0" max="100" required value={form.dispatch_fee_percent} onChange={(e) => setForm({ ...form, dispatch_fee_percent: e.target.value })} />
              </Field>
            </div>
            {feePreview() !== null && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Fee amount: <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>${feePreview()}</span> (auto-calculated)
              </div>
            )}
            <Field label="Notes (optional)">
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>}
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save deal'}</button>
          </form>
        )}

        <div style={{ marginTop: 20, maxHeight: 420, overflowY: 'auto' }} className="scrollbar-thin">
          {deals.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No deals logged yet.</div>}
          {deals.map((d) => (
            <div key={d.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{d.customer_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {d.invoice_number}</span></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {d.pickup_location} → {d.drop_location} · Truck {d.truck_ref}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>${Number(d.load_amount).toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--orange-1)' }}>fee ${Number(d.fee_amount).toLocaleString()}</div>
                </div>
              </div>
              <button
                onClick={() => togglePaid(d)}
                className="pill"
                style={{
                  marginTop: 8, border: 'none', cursor: 'pointer',
                  background: d.payment_status === 'paid' ? 'rgba(61,220,132,0.14)' : 'rgba(255,122,26,0.14)',
                  color: d.payment_status === 'paid' ? 'var(--success)' : 'var(--orange-1)',
                }}
              >
                {d.payment_status === 'paid' ? '✓ Paid' : 'Mark as paid'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
