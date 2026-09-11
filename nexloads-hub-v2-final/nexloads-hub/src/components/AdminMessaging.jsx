import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminMessaging({ adminId, employees }) {
  const [mode, setMode] = useState('team') // 'team' | 'individual'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [body, setBody] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.rpc('admin_get_all_messages', { p_admin_id: adminId })
    if (data?.success) setMessages(data.messages)
  }

  async function handleSend() {
    setError('')
    if (!body.trim()) {
      setError("Message can't be empty.")
      return
    }
    if (mode === 'individual' && !selectedEmployeeId) {
      setError('Pick an employee to message.')
      return
    }
    setSending(true)
    const { data } = await supabase.rpc('admin_send_message', {
      p_admin_id: adminId,
      p_recipient_employee_id: mode === 'team' ? null : selectedEmployeeId,
      p_body: body.trim(),
    })
    setSending(false)
    if (!data?.success) {
      setError('Could not send the message.')
      return
    }
    setBody('')
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this message for everyone who can see it?')) return
    const { data, error: rpcError } = await supabase.rpc('admin_delete_message', { p_admin_id: adminId, p_message_id: id })
    if (rpcError || !data?.success) {
      alert('Could not delete this message: ' + (rpcError?.message || data?.error || 'unknown error'))
      return
    }
    load() // re-fetch from the server so the list always reflects the real database state
  }

  async function handleClearAll() {
    const typed = window.prompt('This permanently deletes ALL messages for every employee and cannot be undone.\n\nType CLEAR to confirm:')
    if (typed !== 'CLEAR') return
    const { data, error: rpcError } = await supabase.rpc('admin_clear_all_messages', { p_admin_id: adminId })
    if (rpcError || !data?.success) {
      alert('Could not clear messages: ' + (rpcError?.message || data?.error || 'unknown error'))
      return
    }
    load()
  }

  return (
    <div className="card">
      <h3 className="card-title">Team messaging</h3>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          className={mode === 'team' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setMode('team')}
        >
          Message whole team
        </button>
        <button
          className={mode === 'individual' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setMode('individual')}
        >
          Message one employee
        </button>
      </div>

      {mode === 'individual' && (
        <select
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
          style={{ marginTop: 14, background: 'var(--bg-panel-raised)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)', borderRadius: 10, padding: '0.75rem 0.9rem', width: '100%', maxWidth: 340 }}
        >
          <option value="">Select employee…</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.position || 'No position'}</option>
          ))}
        </select>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, maxWidth: 560 }}>
        <textarea
          rows={2}
          placeholder={mode === 'team' ? 'Message the whole team…' : 'Message this employee only…'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 8 }}>{error}</div>}

      <button className="btn-primary" style={{ marginTop: 10 }} disabled={sending} onClick={handleSend}>
        {sending ? 'Sending…' : 'Send'}
      </button>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          New employees only see broadcasts sent after their account was created.
        </div>
        <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleClearAll}>
          Clear all message history
        </button>
      </div>

      <div style={{ marginTop: 12, maxHeight: 420, overflowY: 'auto' }} className="scrollbar-thin">
        {messages.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No messages yet.</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--orange-1)', fontWeight: 600 }}>Admin - {m.sender_name}</span>
                {' → '}
                {m.recipient_employee_id
                  ? <>{m.recipient_name} <span style={{ opacity: 0.6 }}>({blurEmail(m.recipient_email)})</span></>
                  : 'Whole team'}
                {' · '}{new Date(m.created_at).toLocaleString()}
              </div>
              <div style={{ marginTop: 3 }}>{m.body}</div>
            </div>
            <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: 'transparent', whiteSpace: 'nowrap' }} onClick={() => handleDelete(m.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Admin sees the real email everywhere else in the app (Employees tab), but
// here in the message log we still soften it visually — full email is in
// the title attribute if you need to copy it, never shown to non-admins.
function blurEmail(email) {
  if (!email) return ''
  const [user, domain] = email.split('@')
  if (!domain) return email
  const visible = user.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(3, user.length - 2))}@${domain}`
}
