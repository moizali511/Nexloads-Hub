import { useState } from 'react'
import { supabase } from '../supabaseClient'
import ImagePicker from './ImagePicker'

export default function EmployeeMessages({ employeeId, messages, newIds, onSent }) {
  const [body, setBody] = useState('')
  const [image, setImage] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    setError('')
    if (!body.trim() && !image) {
      setError('Add a message or attach a screenshot.')
      return
    }
    setSending(true)
    const { data } = await supabase.rpc('employee_send_message', {
      p_employee_id: employeeId,
      p_body: body.trim(),
      p_image_data: image,
    })
    setSending(false)
    if (!data?.success) {
      setError('Could not send — try again.')
      return
    }
    setBody('')
    setImage(null)
    onSent && onSent()
  }

  return (
    <div className="card">
      <h3 className="card-title">Messages</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>
        Team announcements, direct messages from admin, and anything you send to admin — a closed deal, a payment screenshot, or a question.
      </p>

      <div style={{ marginTop: 16, maxWidth: 480 }}>
        <textarea
          rows={2}
          placeholder="Send admin an update — e.g. closed a deal, sending payment proof…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ImagePicker value={image} onChange={setImage} />
          <button className="btn-primary" style={{ padding: '6px 16px' }} disabled={sending} onClick={handleSend}>
            {sending ? 'Sending…' : 'Send to admin'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 6 }}>{error}</div>}
      </div>

      <div style={{ marginTop: 20, maxHeight: 480, overflowY: 'auto' }} className="scrollbar-thin">
        {messages.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No messages yet.</div>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              padding: '12px 10px',
              marginBottom: 6,
              borderRadius: 10,
              background: newIds?.has(m.id) ? 'rgba(255,122,26,0.10)' : 'transparent',
              border: newIds?.has(m.id) ? '1px solid rgba(255,122,26,0.3)' : '1px solid transparent',
              borderBottom: '1px solid var(--border-soft)',
              transition: 'background 0.4s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
              <span>
                {m.is_mine ? (
                  <span className="pill" style={{ marginRight: 6, background: 'rgba(61,220,132,0.14)', color: 'var(--success)', borderColor: 'rgba(61,220,132,0.28)' }}>You → Admin</span>
                ) : m.is_direct ? (
                  <span className="pill" style={{ marginRight: 6 }}>Direct message</span>
                ) : (
                  <span className="pill" style={{ marginRight: 6, background: 'rgba(61,220,132,0.14)', color: 'var(--success)', borderColor: 'rgba(61,220,132,0.28)' }}>Team announcement</span>
                )}
                {!m.is_mine && `Admin - ${m.sender_name}`}
              </span>
              <span>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            {m.body && <div style={{ marginTop: 6 }}>{m.body}</div>}
            {m.image_data && (
              <a href={m.image_data} target="_blank" rel="noreferrer">
                <img src={m.image_data} alt="Attachment" style={{ marginTop: 8, maxWidth: 220, maxHeight: 220, borderRadius: 8, border: '1px solid var(--border-soft)', display: 'block' }} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
