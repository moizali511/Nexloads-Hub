import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DataTable from '../components/crm/DataTable'
import { formatDateTime12h } from '../utils/formatTime'

export default function CallsPanel({ callerId }) {
  const [calls, setCalls] = useState([])
  const [form, setForm] = useState({ direction: 'outbound', status: 'connected', duration_seconds: 0, notes: '', result: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.rpc('crm_list_calls', { p_caller_id: callerId, p_limit: 80 })
    if (data?.success) setCalls(data.calls || [])
  }

  async function save(e) {
    e.preventDefault()
    await supabase.rpc('crm_log_call', { p_caller_id: callerId, p_payload: form })
    setForm({ direction: 'outbound', status: 'connected', duration_seconds: 0, notes: '', result: '' })
    load()
  }

  const columns = [
    { key: 'created_at', label: 'When', render: (r) => formatDateTime12h(r.created_at) },
    { key: 'direction', label: 'Direction' },
    { key: 'status', label: 'Status' },
    { key: 'duration_seconds', label: 'Duration (s)' },
    { key: 'employee_name', label: 'Employee' },
    { key: 'result', label: 'Result' },
  ]

  return (
    <div className="card">
      <h3 className="card-title">Calls</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manual call logging — ready for future VoIP integration via provider + external_id fields.</p>
      <form onSubmit={save} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="connected">Connected</option>
          <option value="missed">Missed</option>
          <option value="voicemail">Voicemail</option>
        </select>
        <input type="number" placeholder="Duration (sec)" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })} />
        <input placeholder="Result" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" className="btn-primary">Log call</button>
      </form>
      <div style={{ marginTop: 16 }}><DataTable columns={columns} rows={calls} /></div>
    </div>
  )
}
