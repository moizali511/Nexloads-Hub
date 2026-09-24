import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { departmentLabel } from '../utils/departments'
import { presenceMeta, clockStatusLabel } from '../utils/presence'
import { formatDateTime12h } from '../utils/formatTime'

export default function AdminEmployeeWorkspace({ adminId, employeeId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  async function load() {
    setLoading(true)
    const { data: res } = await supabase.rpc('admin_get_employee_workspace', {
      p_admin_id: adminId,
      p_employee_id: employeeId,
    })
    if (res?.success) setData(res)
    setLoading(false)
  }

  if (loading) {
    return <div className="card" style={{ color: 'var(--text-muted)' }}>Loading work summary…</div>
  }

  if (!data?.success) {
    return (
      <div className="card" style={{ color: 'var(--danger)' }}>
        Could not load workspace summary. Run migration 006 on Supabase.
      </div>
    )
  }

  const p = data.presence || {}
  const tasks = data.tasks || {}
  const fu = data.follow_ups || {}
  const sales = data.sales || {}
  const ops = data.operations || {}
  const pMeta = presenceMeta(p.presence_state || 'offline')
  const dailyLabel = {
    yes: { text: 'Daily tasks complete', ok: true },
    no: { text: 'Daily tasks incomplete', ok: false },
    no_tasks_today: { text: 'No tasks due today', ok: true },
  }[tasks.daily_complete] || { text: '—', ok: true }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h3 className="card-title" style={{ marginBottom: 6 }}>Work snapshot</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {departmentLabel(data.employee?.department)} · {pMeta.emoji} {pMeta.label} · {clockStatusLabel(p.is_clocked_in)}
            {p.last_seen_at && ` · Last seen ${formatDateTime12h(p.last_seen_at)}`}
          </p>
        </div>
        <span
          className="pill"
          style={{
            background: dailyLabel.ok ? 'rgba(31,157,85,0.14)' : 'rgba(214,59,59,0.14)',
            color: dailyLabel.ok ? 'var(--success)' : 'var(--danger)',
            borderColor: 'transparent',
          }}
        >
          {dailyLabel.text}
        </span>
      </div>

      <div className="stat-row" style={{ marginTop: 18 }}>
        <Stat label="Open tasks" value={tasks.open ?? 0} />
        <Stat label="Overdue tasks" value={tasks.overdue ?? 0} accent={tasks.overdue > 0} />
        <Stat label="Due today (pending)" value={tasks.due_today_pending ?? 0} />
        <Stat label="Completed today" value={tasks.completed_today ?? 0} />
        <Stat label="Open follow-ups" value={fu.open ?? 0} />
        <Stat label="Overdue follow-ups" value={fu.overdue ?? 0} accent={fu.overdue > 0} />
      </div>

      <div className="stat-row" style={{ marginTop: 10 }}>
        <Stat label="Active leads" value={sales.leads_active ?? 0} />
        <Stat label="Calls today" value={sales.calls_today ?? 0} />
        <Stat label="Active loads" value={ops.loads_active ?? 0} />
        <Stat label="Active clients" value={ops.clients_active ?? 0} />
      </div>

      {(tasks.due_today_list || []).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 8 }}>Today & overdue tasks</div>
          <div className="scrollbar-thin" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {tasks.due_today_list.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-soft)',
                  fontSize: '0.85rem',
                }}
              >
                <span>{t.title}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {t.status}{t.due_date ? ` · ${t.due_date}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.recent_activity || []).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 8 }}>Recent activity</div>
          <div className="scrollbar-thin" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {data.recent_activity.map((a, i) => (
              <div key={i} style={{ fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{formatDateTime12h(a.created_at)}</span>
                {' · '}{a.summary || a.event_type}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${accent ? ' stat-accent' : ''}`}>{value}</div>
    </div>
  )
}
