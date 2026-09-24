import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Shown to Team Leaders / Operations Managers — a snapshot of everyone
// who reports to them (employees.manager_id === this manager's id),
// with this month's number for each, using whatever metric fits their
// department.
export default function TeamOverviewPanel({ managerId }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  function monthStr() {
    return new Date().toISOString().slice(0, 10)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('get_my_team_overview', { p_manager_id: managerId, p_month: monthStr() })
    if (data?.success) setTeam(data.team)
    setLoading(false)
  }

  return (
    <div className="card">
      <h3 className="card-title">My team — this month</h3>
      <div style={{ marginTop: 16 }}>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>}
        {!loading && team.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No one is reporting to you yet — ask an admin to set your team members' "Reports to" in Employees.
          </div>
        )}
        {!loading && team.map((m) => (
          <div key={m.id} style={row}>
            <div>
              <div style={{ fontWeight: 500 }}>{m.full_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.position}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--orange-1)' }}>{m.month_value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.metric_label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid var(--border-soft)',
}
