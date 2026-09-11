import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminPayroll({ adminId, employees }) {
  const [bonusForm, setBonusForm] = useState({ employee_id: '', amount: '', currency: 'USD', reason: '' })
  const [bonuses, setBonuses] = useState([])
  const [closings, setClosings] = useState([])
  const [closeEmployeeId, setCloseEmployeeId] = useState('')
  const [savingBonus, setSavingBonus] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')

  const monthStr = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: bonusRes }, { data: closingRes }] = await Promise.all([
      supabase.rpc('admin_get_all_bonuses', { p_admin_id: adminId, p_month: monthStr() }),
      supabase.rpc('admin_get_closings', { p_admin_id: adminId, p_month: monthStr() }),
    ])
    if (bonusRes?.success) setBonuses(bonusRes.bonuses)
    if (closingRes?.success) setClosings(closingRes.closings)
  }

  async function submitBonus(e) {
    e.preventDefault()
    setError('')
    if (!bonusForm.employee_id) {
      setError('Pick an employee.')
      return
    }
    setSavingBonus(true)
    const { data } = await supabase.rpc('admin_add_bonus', {
      p_admin_id: adminId,
      p_employee_id: bonusForm.employee_id,
      p_amount: parseFloat(bonusForm.amount),
      p_currency: bonusForm.currency,
      p_reason: bonusForm.reason.trim(),
    })
    setSavingBonus(false)
    if (!data?.success) {
      setError('Could not save the bonus. Check the amount and reason.')
      return
    }
    setBonusForm({ employee_id: '', amount: '', currency: 'USD', reason: '' })
    load()
  }

  async function closeMonth() {
    if (!closeEmployeeId) return
    setClosing(true)
    const { data } = await supabase.rpc('admin_close_month', {
      p_admin_id: adminId, p_employee_id: closeEmployeeId, p_month: monthStr(),
    })
    setClosing(false)
    if (data?.success) load()
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className="card">
        <h3 className="card-title">Give a bonus</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>
          e.g. a weekly performance bonus to motivate the team — logged against this month's closing automatically.
        </p>
        <form onSubmit={submitBonus} style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={fieldLabel}>Employee</label>
            <select
              value={bonusForm.employee_id}
              onChange={(e) => setBonusForm({ ...bonusForm, employee_id: e.target.value })}
              style={selectStyle}
            >
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Amount</label>
            <input type="number" step="0.01" min="0" style={{ maxWidth: 120 }}
              value={bonusForm.amount} onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })} />
          </div>
          <div>
            <label style={fieldLabel}>Currency</label>
            <select value={bonusForm.currency} onChange={(e) => setBonusForm({ ...bonusForm, currency: e.target.value })} style={selectStyle}>
              <option value="USD">USD</option>
              <option value="PKR">PKR</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={fieldLabel}>Reason</label>
            <input placeholder="e.g. Great week, motivating the team"
              value={bonusForm.reason} onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })} />
          </div>
          <button className="btn-primary" disabled={savingBonus}>{savingBonus ? 'Saving…' : 'Give bonus'}</button>
        </form>
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 8 }}>{error}</div>}

        <div style={{ marginTop: 20, maxHeight: 260, overflowY: 'auto' }} className="scrollbar-thin">
          {bonuses.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No bonuses given this month yet.</div>}
          {bonuses.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{b.employee_name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{b.reason} · by {b.awarded_by_name}</div>
              </div>
              <div style={{ color: 'var(--orange-1)', fontWeight: 600 }}>
                {b.currency === 'PKR' ? 'PKR ' : '$'}{Number(b.amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Month-end closing</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>
          Locks in an employee's final earnings for this month (commission/sales + any bonuses given), so it won't shift later if new deals land after close.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={closeEmployeeId} onChange={(e) => setCloseEmployeeId(e.target.value)} style={selectStyle}>
            <option value="">Select employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} — {e.position}</option>)}
          </select>
          <button className="btn-primary" disabled={closing || !closeEmployeeId} onClick={closeMonth}>
            {closing ? 'Closing…' : 'Close this month'}
          </button>
        </div>

        <div style={{ marginTop: 20, maxHeight: 320, overflowY: 'auto' }} className="scrollbar-thin">
          {closings.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No months closed yet.</div>}
          {closings.map((c) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontWeight: 600 }}>{c.employee_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {c.position}</span></div>
                <div style={{ fontWeight: 600, color: 'var(--orange-1)', textAlign: 'right' }}>
                  {c.total_usd > 0 && <div>${Number(c.total_usd).toLocaleString()}</div>}
                  {c.total_pkr > 0 && <div>PKR {Number(c.total_pkr).toLocaleString()}</div>}
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                base: {c.base_currency === 'PKR' ? 'PKR ' : '$'}{Number(c.base_amount).toLocaleString()} ·
                {' '}commission: ${Number(c.commission_amount).toLocaleString()} ·
                {' '}bonuses: ${Number(c.bonus_usd).toLocaleString()}{c.bonus_pkr > 0 ? ` + PKR ${Number(c.bonus_pkr).toLocaleString()}` : ''}
                {' '}· closed {new Date(c.closed_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const fieldLabel = { display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }
const selectStyle = { background: 'var(--bg-panel-raised)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', borderRadius: 10, padding: '0.75rem 0.9rem' }
