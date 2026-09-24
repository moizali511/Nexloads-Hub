import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { formatDateTime12h } from '../../utils/formatTime'

export default function ActivityTimeline({ callerId, entityType, entityId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entityType || !entityId) return
    load()
  }, [entityType, entityId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('crm_get_activity', {
      p_caller_id: callerId,
      p_entity_type: entityType,
      p_entity_id: entityId,
    })
    setEvents(data?.success ? data.events || [] : [])
    setLoading(false)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading timeline…</div>
  if (!events.length) return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity yet.</div>

  return (
    <div className="activity-timeline">
      {events.map((ev) => (
        <div key={ev.id} className="activity-timeline-item">
          <div className="activity-timeline-dot" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ev.summary}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {ev.actor_name || 'System'} · {formatDateTime12h(ev.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
