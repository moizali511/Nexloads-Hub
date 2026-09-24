import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateTime12h } from '../utils/formatTime'

export default function TeamChatPanel({ employeeId, isAdmin, employees = [] }) {
  const [rooms, setRooms] = useState([])
  const [roomId, setRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [dmTarget, setDmTarget] = useState('')

  useEffect(() => { loadRooms() }, [])
  useEffect(() => {
    if (!roomId) return undefined
    loadMessages()
    const t = setInterval(loadMessages, 5000)
    return () => clearInterval(t)
  }, [roomId])

  async function loadRooms() {
    const { data } = await supabase.rpc('chat_list_rooms', { p_employee_id: employeeId })
    if (data?.success) {
      setRooms(data.rooms || [])
      if (!roomId && data.rooms?.[0]) setRoomId(data.rooms[0].id)
    }
  }

  async function loadMessages() {
    const { data } = await supabase.rpc('chat_list_messages', {
      p_employee_id: employeeId,
      p_room_id: roomId,
      p_limit: 80,
    })
    if (data?.success) setMessages((data.messages || []).reverse())
  }

  async function send(e) {
    e.preventDefault()
    if (!body.trim()) return
    await supabase.rpc('chat_send_message', {
      p_employee_id: employeeId,
      p_room_id: roomId,
      p_body: body.trim(),
      p_attachment_url: null,
    })
    setBody('')
    loadMessages()
  }

  async function startDm() {
    if (!dmTarget) return
    const { data } = await supabase.rpc('chat_get_or_create_dm', {
      p_employee_id: employeeId,
      p_other_id: dmTarget,
    })
    if (data?.success) {
      await loadRooms()
      setRoomId(data.room.id)
    }
  }

  async function adminEdit(msg) {
    if (!isAdmin) return
    const newBody = window.prompt('Corrected message text:', msg.body)
    if (!newBody) return
    const reason = window.prompt('Reason for edit (audit):', '') || ''
    await supabase.rpc('chat_edit_message', {
      p_actor_id: employeeId,
      p_message_id: msg.id,
      p_new_body: newBody,
      p_reason: reason,
    })
    loadMessages()
  }

  async function adminDelete(msg) {
    const reason = window.prompt('Reason for deletion (audit):', '') || ''
    await supabase.rpc('chat_delete_message', {
      p_actor_id: employeeId,
      p_message_id: msg.id,
      p_reason: reason,
    })
    loadMessages()
  }

  const activeRoom = rooms.find((r) => r.id === roomId)

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, minHeight: 420 }}>
      <div>
        <h3 className="card-title">Channels</h3>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`theme-toggle-btn${roomId === r.id ? ' active' : ''}`}
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => setRoomId(r.id)}
            >
              {r.name}{r.unread_count > 0 ? ` (${r.unread_count})` : ''}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct message</label>
          <select value={dmTarget} onChange={(e) => setDmTarget(e.target.value)}>
            <option value="">Select employee</option>
            {employees.filter((e) => e.id !== employeeId).map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={startDm}>Open DM</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 360 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{activeRoom?.name || 'Chat'}</div>
        <div className="scrollbar-thin" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 12 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 12, fontSize: '0.88rem' }}>
              <div style={{ fontWeight: 600 }}>{m.sender_name}{m.edited_at ? ' (edited)' : ''}</div>
              <div>{m.body}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDateTime12h(m.created_at)}</div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => adminEdit(m)}>Edit</button>
                  <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => adminDelete(m)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" />
          <button type="submit" className="btn-primary">Send</button>
        </form>
      </div>
    </div>
  )
}
