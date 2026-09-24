import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function UpdatesFeed({ employeeId }) {
  const [updates, setUpdates] = useState([])
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.rpc('get_updates')
    setUpdates(data || [])
  }

  async function handlePost(e) {
    e.preventDefault()
    if (!message.trim()) return
    setPosting(true)
    await supabase.rpc('post_update', { p_employee_id: employeeId, p_message: message.trim() })
    setMessage('')
    await load()
    setPosting(false)
  }

  return (
    <div className="card">
      <h3 className="card-title">Team updates</h3>

      <form onSubmit={handlePost} style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <input
          type="text"
          placeholder="Share an update with the team…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="btn-primary" disabled={posting} style={{ whiteSpace: 'nowrap' }}>
          Post
        </button>
      </form>

      <div style={{ marginTop: 20, maxHeight: 320, overflowY: 'auto' }} className="scrollbar-thin">
        {updates.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No updates yet.</div>
        )}
        {updates.map((u) => (
          <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>
                {u.full_name} {u.role === 'admin' && <span style={{ color: 'var(--orange-1)' }}>· Admin</span>}
              </span>
              <span>{new Date(u.created_at).toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 4 }}>{u.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
