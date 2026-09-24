import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import DataTable from '../components/crm/DataTable'

export default function TasksPanel({ callerId }) {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.rpc('crm_list_tasks', { p_caller_id: callerId })
    if (data?.success) setTasks(data.tasks || [])
  }

  async function add(e) {
    e.preventDefault()
    await supabase.rpc('crm_upsert_task', { p_caller_id: callerId, p_payload: { title } })
    setTitle('')
    load()
  }

  async function complete(t) {
    await supabase.rpc('crm_upsert_task', { p_caller_id: callerId, p_payload: { id: t.id, status: 'completed' } })
    load()
  }

  const columns = [
    { key: 'title', label: 'Task' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'due_date', label: 'Due' },
    { key: 'a', label: '', render: (r) => r.status !== 'completed' && (
      <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => complete(r)}>Done</button>
    ) },
  ]

  return (
    <div className="card">
      <h3 className="card-title">Tasks</h3>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input required placeholder="New task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="btn-primary">Add</button>
      </form>
      <div style={{ marginTop: 16 }}><DataTable columns={columns} rows={tasks} /></div>
    </div>
  )
}
