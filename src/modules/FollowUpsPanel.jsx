import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DataTable from '../components/crm/DataTable'
import { formatDateTime12h } from '../utils/formatTime'

const BUCKETS = [
  { key: '', label: 'All open' },
  { key: 'due_today', label: 'Due today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
]

export default function FollowUpsPanel({ callerId }) {
  const [bucket, setBucket] = useState('due_today')
  const [rows, setRows] = useState([])
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')

  useEffect(() => { load() }, [bucket])

  async function load() {
    const { data } = await supabase.rpc('crm_list_follow_ups', {
      p_caller_id: callerId,
      p_bucket: bucket || null,
    })
    if (data?.success) setRows(data.follow_ups || [])
  }

  async function add(e) {
    e.preventDefault()
    await supabase.rpc('crm_upsert_follow_up', {
      p_caller_id: callerId,
      p_payload: { title, due_at: new Date(dueAt).toISOString() },
    })
    setTitle('')
    setDueAt('')
    load()
  }

  async function complete(row) {
    await supabase.rpc('crm_upsert_follow_up', {
      p_caller_id: callerId,
      p_payload: { id: row.id, status: 'completed' },
    })
    load()
  }

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'due_at', label: 'Due', render: (r) => formatDateTime12h(r.due_at) },
    { key: 'priority', label: 'Priority' },
    { key: 'assigned_name', label: 'Assigned' },
    { key: 'x', label: '', render: (r) => (
      <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => complete(r)}>Complete</button>
    ) },
  ]

  return (
    <div className="card">
      <h3 className="card-title">Follow-ups</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {BUCKETS.map((b) => (
          <button key={b.key || 'all'} type="button" className={`theme-toggle-btn${bucket === b.key ? ' active' : ''}`} onClick={() => setBucket(b.key)}>{b.label}</button>
        ))}
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input required type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <button type="submit" className="btn-primary">Schedule</button>
      </form>
      <div style={{ marginTop: 16 }}><DataTable columns={columns} rows={rows} /></div>
    </div>
  )
}
