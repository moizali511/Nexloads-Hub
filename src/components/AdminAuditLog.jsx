import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateTime12h } from '../utils/formatTime'

export default function AdminAuditLog({ adminId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_get_audit_logs', {
      p_admin_id: adminId,
      p_limit: 150,
      p_offset: 0,
    })
    setLoading(false)
    if (rpcError || !data?.success) {
      setError('Could not load audit log. Apply sql/migrations/001_foundation_audit_presence_time.sql on Supabase.')
      return
    }
    setLogs(data.logs || [])
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 className="card-title">Audit log</h3>
        <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={load}>
          Refresh
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
        Security-sensitive actions (time corrections, employment changes, message deletions, and more over time).
      </p>

      {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: '0.85rem' }}>{error}</div>}
      {loading && <div style={{ color: 'var(--text-muted)', marginTop: 16 }}>Loading…</div>}

      {!loading && !error && logs.length === 0 && (
        <div style={{ color: 'var(--text-muted)', marginTop: 16, fontSize: '0.85rem' }}>No audit entries yet.</div>
      )}

      <div style={{ marginTop: 16, maxHeight: 520, overflowY: 'auto' }} className="scrollbar-thin">
        {logs.map((row) => (
          <div
            key={row.id}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--border-soft)',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{row.action}</span>
              <span style={{ color: 'var(--text-muted)' }}>{formatDateTime12h(row.created_at)}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {row.actor_name || 'System'} · {row.entity_type || '—'} {row.entity_id ? `· ${row.entity_id.slice(0, 8)}…` : ''}
            </div>
            {row.reason && <div style={{ marginTop: 4 }}>Reason: {row.reason}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
