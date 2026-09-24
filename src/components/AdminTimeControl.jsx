import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateTime12h, formatTime12h } from '../utils/formatTime'

export default function AdminTimeControl({ adminId, onDone }) {
  const [openLogs, setOpenLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({}) // timelog id -> { useNow, customIso, reason }

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_get_open_timelogs', { p_admin_id: adminId })
    if (data?.success) setOpenLogs(data.timelogs || [])
    setLoading(false)
  }

  function getDraft(log) {
    return draft[log.id] || { useNow: true, customIso: '', reason: '' }
  }

  async function forceClockOut(log) {
    const d = getDraft(log)
    if (!d.reason.trim()) {
      setError('A reason is required for force clock-out.')
      return
    }
    const clockOut = d.useNow ? new Date().toISOString() : new Date(d.customIso).toISOString()
    if (!d.useNow && Number.isNaN(new Date(d.customIso).getTime())) {
      setError('Pick a valid clock-out date and time.')
      return
    }

    const confirmed = window.confirm(
      `Force clock out ${log.full_name}?\nClock-in: ${formatDateTime12h(log.clock_in)}\nClock-out: ${formatDateTime12h(clockOut)}\n\nThis will be recorded in the audit log.`,
    )
    if (!confirmed) return

    setError('')
    setBusyId(log.id)
    const { data, error: rpcError } = await supabase.rpc('admin_force_clock_out', {
      p_admin_id: adminId,
      p_employee_id: log.employee_id,
      p_clock_out: clockOut,
      p_reason: d.reason.trim(),
    })
    setBusyId(null)

    if (rpcError || !data?.success) {
      setError(data?.error === 'not_clocked_in' ? 'They are no longer clocked in.' : 'Could not force clock-out. Run migration 001 on Supabase if this is a new feature.')
      load()
      return
    }

    setDraft((prev) => {
      const next = { ...prev }
      delete next[log.id]
      return next
    })
    load()
    onDone?.()
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 className="card-title">Admin time control</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
        Force clock-out when someone forgot to clock out. Every action is audited.
      </p>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 12 }}>{error}</div>}

      {loading && <div style={{ color: 'var(--text-muted)', marginTop: 16 }}>Loading open shifts…</div>}

      {!loading && openLogs.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 16 }}>No one is currently clocked in.</div>
      )}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {openLogs.map((log) => {
          const d = getDraft(log)
          return (
            <div
              key={log.id}
              style={{
                padding: 14,
                borderRadius: 12,
                border: '1px solid var(--border-soft)',
                background: 'var(--bg-panel-raised)',
              }}
            >
              <div style={{ fontWeight: 600 }}>{log.full_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Clocked in {formatDateTime12h(log.clock_in)} ({formatTime12h(log.clock_in)})
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    checked={d.useNow}
                    onChange={() => setDraft({ ...draft, [log.id]: { ...d, useNow: true } })}
                  />
                  Current time
                </label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    checked={!d.useNow}
                    onChange={() => setDraft({ ...draft, [log.id]: { ...d, useNow: false } })}
                  />
                  Custom time
                </label>
                {!d.useNow && (
                  <input
                    type="datetime-local"
                    value={d.customIso}
                    onChange={(e) => setDraft({ ...draft, [log.id]: { ...d, customIso: e.target.value } })}
                    style={{ maxWidth: 220 }}
                  />
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Reason (required)</label>
                <input
                  type="text"
                  placeholder="e.g. Left office without clocking out"
                  value={d.reason}
                  onChange={(e) => setDraft({ ...draft, [log.id]: { ...d, reason: e.target.value } })}
                />
              </div>

              <button
                className="btn-danger"
                style={{ marginTop: 12 }}
                disabled={busyId === log.id}
                onClick={() => forceClockOut(log)}
              >
                {busyId === log.id ? 'Saving…' : 'Force clock out'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
