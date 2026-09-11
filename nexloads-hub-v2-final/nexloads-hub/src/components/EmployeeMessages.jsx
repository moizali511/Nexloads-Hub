export default function EmployeeMessages({ messages, newIds }) {
  return (
    <div className="card">
      <h3 className="card-title">Messages</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>
        Team announcements and messages sent to you directly.
      </p>

      <div style={{ marginTop: 16, maxHeight: 480, overflowY: 'auto' }} className="scrollbar-thin">
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
                {m.is_direct ? (
                  <span className="pill" style={{ marginRight: 6 }}>Direct message</span>
                ) : (
                  <span className="pill" style={{ marginRight: 6, background: 'rgba(61,220,132,0.14)', color: 'var(--success)', borderColor: 'rgba(61,220,132,0.28)' }}>Team announcement</span>
                )}
                Admin - {m.sender_name}
              </span>
              <span>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 6 }}>{m.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
