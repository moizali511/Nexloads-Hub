import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateTime12h } from '../utils/formatTime'

export default function NotificationCenter({ employeeId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    const { data } = await supabase.rpc('crm_list_notifications', {
      p_caller_id: employeeId,
      p_unread_only: true,
    })
    if (data?.success) setItems(data.notifications || [])
  }

  async function markAllRead() {
    await supabase.rpc('crm_mark_notifications_read', { p_caller_id: employeeId, p_ids: null })
    load()
  }

  const unread = items.length

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setOpen((o) => !o)}>
        Notifications{unread > 0 ? ` (${unread})` : ''}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: '100%', width: 320, zIndex: 30, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Notifications</strong>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 10 }} className="scrollbar-thin">
            {items.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>You&apos;re all caught up.</div>}
            {items.map((n) => (
              <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                {n.body && <div style={{ color: 'var(--text-muted)' }}>{n.body}</div>}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{formatDateTime12h(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
