import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { defaultMetricFor } from '../utils/departments'
import MonthlyProgressChart from './MonthlyProgressChart'

// Generic daily/task performance log used by every Hub role that
// doesn't already have its own dedicated panel (Social Media Manager,
// Designer, Animator, Operations Manager, Team Leader, Other).
export default function PerformancePanel({ employeeId, department }) {
  const defaultLabel = defaultMetricFor(department)
  const [form, setForm] = useState({
    log_date: todayStr(),
    metric_label: defaultLabel,
    metric_value: '',
    notes: '',
  })
  const [logs, setLogs] = useState([])
  const [saving, setSaving] = useState(false)
  const [monthTotal, setMonthTotal] = useState(0)

  function todayStr() {
    return new Date().toISOString().slice(0, 10)
  }
  function monthStr() {
    return new Date().toISOString().slice(0, 10)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const { data } = await supabase.rpc('get_my_performance_logs', { p_employee_id: employeeId, p_month: monthStr() })
    const list = data || []
    setLogs(list)
    setMonthTotal(list.reduce((sum, l) => sum + Number(l.metric_value || 0), 0))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.rpc('log_performance', {
      p_employee_id: employeeId,
      p_log_date: form.log_date,
      p_metric_label: form.metric_label.trim() || defaultLabel,
      p_metric_value: Number(form.metric_value) || 0,
      p_notes: form.notes.trim() || null,
    })
    setSaving(false)
    setForm({ log_date: todayStr(), metric_label: defaultLabel, metric_value: '', notes: '' })
    load()
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <MonthlyProgressChart callerId={employeeId} employeeId={employeeId} title="My progress" />

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 className="card-title">Log today's work</h3>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">This month, total</div>
            <div className="stat-value stat-accent" style={{ fontSize: '1.2rem' }}>{monthTotal}</div>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: 16, display: 'grid', gap: 12, maxWidth: 480 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={fieldLabel}>Date</label>
              <input
                type="date" value={form.log_date}
                onChange={(e) => setForm({ ...form, log_date: e.target.value })}
              />
            </div>
            <div>
              <label style={fieldLabel}>Count</label>
              <input
                type="number" step="1" min="0" placeholder="e.g. 3"
                value={form.metric_value}
                onChange={(e) => setForm({ ...form, metric_value: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label style={fieldLabel}>What are you logging?</label>
            <input
              type="text" value={form.metric_label}
              onChange={(e) => setForm({ ...form, metric_label: e.target.value })}
              placeholder={defaultLabel}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 5 }}>
              Defaults to "{defaultLabel}" for your role — change it if you're logging something else today.
            </div>
          </div>

          <div>
            <label style={fieldLabel}>Notes (optional)</label>
            <input
              type="text" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any context worth adding"
            />
          </div>

          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save log'}</button>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">This month's log</h3>
        <div style={{ marginTop: 14, display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }} className="scrollbar-thin">
          {logs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing logged yet this month.</div>}
          {logs.map((l) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
              <span>{l.log_date} · {l.metric_label}{l.notes ? ` — ${l.notes}` : ''}</span>
              <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>{l.metric_value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const fieldLabel = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
  marginBottom: 6,
}
