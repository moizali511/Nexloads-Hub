import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateTime12h, formatTime12h } from '../utils/formatTime'

export default function TimeClock({ employeeId }) {
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(new Date())

  const openLog = logs.find((l) => !l.clock_out)

  useEffect(() => {
    loadLogs()
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  async function loadLogs() {
    const { data } = await supabase.rpc('get_my_timelogs', { p_employee_id: employeeId })
    setLogs(data || [])
  }

  async function handleClockIn() {
    setBusy(true)
    await supabase.rpc('clock_in', { p_employee_id: employeeId })
    await loadLogs()
    setBusy(false)
  }

  async function handleClockOut() {
    setBusy(true)
    await supabase.rpc('clock_out', { p_employee_id: employeeId })
    await loadLogs()
    setBusy(false)
  }

  function digitalClock12h() {
    let h = now.getHours()
    const m = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    if (h === 0) h = 12
    return { time: `${h}:${m}:${s}`, ampm }
  }

  function elapsed() {
    if (!openLog) return null
    const ms = now - new Date(openLog.clock_in)
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${h}h ${m}m ${s}s`
  }

  return (
    <div className="card">
      <h3 className="card-title">Time clock</h3>

      {/* Live 12-hour digital clock, ticking every second */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14,
        fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums',
      }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 700 }} className="brand-mark">
          {digitalClock12h().time}
        </span>
        <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {digitalClock12h().ampm}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {openLog ? 'Clocked in for' : 'Status'}
          </div>
          <div style={{ fontSize: '1.6rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {openLog ? elapsed() : 'Not clocked in'}
          </div>
        </div>
        {openLog ? (
          <button className="btn-danger" onClick={handleClockOut} disabled={busy}>
            Clock out
          </button>
        ) : (
          <button className="btn-primary" onClick={handleClockIn} disabled={busy}>
            Clock in
          </button>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>Recent shifts</div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }} className="scrollbar-thin">
          {logs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No shifts yet.</div>}
          {logs.map((l) => (
            <div key={l.id} style={row}>
              <span>{formatDateTime12h(l.clock_in)}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {l.clock_out ? `→ ${formatTime12h(l.clock_out)}` : 'In progress'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid var(--border-soft)',
  fontSize: '0.85rem',
}
