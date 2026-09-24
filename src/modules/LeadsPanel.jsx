import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DataTable from '../components/crm/DataTable'
import ActivityTimeline from '../components/crm/ActivityTimeline'
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '../utils/crmConstants'

const emptyForm = {
  name: '', company: '', phone: '', email: '', location: '', lead_source: '',
  equipment: '', truck_count: 0, mc: '', dot: '', preferred_lanes: '', notes: '',
  status: 'new', priority: 'normal', assigned_cold_caller_id: '', next_follow_up_at: '',
}

export default function LeadsPanel({ callerId, employees = [] }) {
  const [leads, setLeads] = useState([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [status, search])

  async function load() {
    const { data } = await supabase.rpc('crm_list_leads', {
      p_caller_id: callerId,
      p_status: status || null,
      p_search: search || null,
      p_assigned_to: null,
      p_limit: 100,
      p_offset: 0,
    })
    if (data?.success) setLeads(data.leads || [])
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const payload = { ...form, id: selected?.id, truck_count: parseInt(form.truck_count, 10) || 0,
      assigned_cold_caller_id: form.assigned_cold_caller_id || null,
      next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null,
    }
    const { data } = await supabase.rpc('crm_upsert_lead', { p_caller_id: callerId, p_payload: payload })
    setBusy(false)
    if (!data?.success) {
      setError('Could not save lead. Run SQL migrations 002 on Supabase.')
      return
    }
    setForm(emptyForm)
    setSelected(null)
    load()
  }

  async function convert(lead) {
    if (!window.confirm(`Convert ${lead.name} to client?`)) return
    const { data } = await supabase.rpc('crm_convert_lead_to_client', {
      p_caller_id: callerId,
      p_lead_id: lead.id,
      p_dispatcher_id: null,
    })
    if (data?.success) load()
    else alert('Conversion failed.')
  }

  function editRow(lead) {
    setSelected(lead)
    setForm({
      ...emptyForm,
      ...lead,
      truck_count: lead.truck_count || 0,
      assigned_cold_caller_id: lead.assigned_cold_caller_id || '',
      next_follow_up_at: lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 16) : '',
    })
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'status', label: 'Status', render: (r) => LEAD_STATUS_LABELS[r.status] || r.status },
    { key: 'priority', label: 'Priority' },
    { key: 'assigned_name', label: 'Cold caller' },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => editRow(r)}>Edit</button>
          {r.status !== 'converted' && (
            <button type="button" className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => convert(r)}>Convert</button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="card">
      <h3 className="card-title">Lead management</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 200 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <form onSubmit={save} style={{ marginTop: 16, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <input required placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={form.assigned_cold_caller_id} onChange={(e) => setForm({ ...form, assigned_cold_caller_id: e.target.value })}>
          <option value="">Assign cold caller</option>
          {employees.filter((e) => e.department === 'cold_caller').map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        <input type="datetime-local" value={form.next_follow_up_at} onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })} />
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        {error && <div style={{ color: 'var(--danger)', gridColumn: '1 / -1' }}>{error}</div>}
        <button type="submit" className="btn-primary" disabled={busy}>{selected ? 'Update lead' : 'Add lead'}</button>
        {selected && <button type="button" className="btn-ghost" onClick={() => { setSelected(null); setForm(emptyForm) }}>Cancel edit</button>}
      </form>

      <div style={{ marginTop: 20 }}>
        <DataTable columns={columns} rows={leads} />
      </div>

      {selected && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ margin: '0 0 8px' }}>Activity</h4>
          <ActivityTimeline callerId={callerId} entityType="lead" entityId={selected.id} />
        </div>
      )}
    </div>
  )
}
