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

  function canEdit(msg) {
    return msg.sender_id === employeeId || isAdmin
  }

  async function editMessage(msg) {
    if (!canEdit(msg)) return
    const newBody = window.prompt('Edit message:', msg.body)
    if (!newBody || newBody === msg.body) return
    const reason = isAdmin && msg.sender_id !== employeeId
      ? (window.prompt('Reason for admin edit (audit):', '') || '')
      : ''
    await supabase.rpc('chat_edit_message', {
      p_actor_id: employeeId,
      p_message_id: msg.id,
      p_new_body: newBody,
      p_reason: reason,
    })
    loadMessages()
  }

  async function deleteMessage(msg) {
    if (!isAdmin) return
    const reason = window.prompt('Reason for deletion (audit):', '') || ''
    const { data } = await supabase.rpc('chat_delete_message', {
      p_actor_id: employeeId,
      p_message_id: msg.id,
      p_reason: reason,
    })
    if (!data?.success) alert('Could not delete. Run migration 004 on Supabase if delete is admin-only.')
    loadMessages()
  }

  const activeRoom = rooms.find((r) => r.id === roomId)

  return (
    <div className="card chat-panel-grid">
      <div className="chat-rooms-column">
        <h3 className="card-title">Channels</h3>
        <div className="chat-room-list scrollbar-thin">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`sidebar-nav-btn${roomId === r.id ? ' active' : ''}`}
              style={{ width: '100%' }}
              onClick={() => setRoomId(r.id)}
            >
              {r.name}{r.unread_count > 0 ? ` (${r.unread_count})` : ''}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct message</label>
          <select value={dmTarget} onChange={(e) => setDmTarget(e.target.value)}>
            <option value="">Select employee</option>
            {employees.filter((e) => e.id !== employeeId).map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 6 }} onClick={startDm}>
            Open DM
          </button>
        </div>
      </div>
      <div className="chat-thread-column">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{activeRoom?.name || 'Chat'}</div>
        <div className="chat-messages scrollbar-thin">
          {messages.map((m) => (
            <div key={m.id} className="chat-message-bubble">
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {m.sender_name}{m.edited_at ? ' · edited' : ''}
              </div>
              <div style={{ marginTop: 4 }}>{m.body}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {formatDateTime12h(m.created_at)}
              </div>
              <div className="chat-message-actions">
                {canEdit(m) && (
                  <button type="button" className="btn-ghost msg-action-btn" onClick={() => editMessage(m)}>
                    Edit
                  </button>
                )}
                {isAdmin && (
                  <button type="button" className="btn-ghost msg-action-btn danger-text" onClick={() => deleteMessage(m)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="chat-compose">
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" />
          <button type="submit" className="btn-primary">Send</button>
        </form>
      </div>
    </div>
  )
}
