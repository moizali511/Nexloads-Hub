export default function AdminControlCenter({ onSelectTab }) {
  const sections = [
    { title: 'People', items: [['employees', 'Employees'], ['timelogs', 'Time logs'], ['audit', 'Audit log']] },
    { title: 'Sales', items: [['leads', 'Leads'], ['calls', 'Calls'], ['followups', 'Follow-ups']] },
    { title: 'Operations', items: [['clients', 'Clients'], ['loads', 'Loads'], ['trucks', 'Trucks'], ['drivers', 'Drivers'], ['brokers', 'Brokers']] },
    { title: 'Finance', items: [['deals', 'Deals & Sales'], ['revenue', 'Revenue'], ['payroll', 'Payroll']] },
    { title: 'Communication', items: [['teamchat', 'Team chat'], ['messages', 'Legacy messages'], ['updates', 'Team updates']] },
    { title: 'System', items: [['tasks', 'Tasks'], ['settings', 'Settings']] },
  ]

  return (
    <div className="card">
      <h3 className="card-title">Admin control center</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Jump to any administrative area of Nexloads Hub.</p>
      <div style={{ display: 'grid', gap: 16, marginTop: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {sections.map((sec) => (
          <div key={sec.title} style={{ padding: 12, border: '1px solid var(--border-soft)', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{sec.title}</div>
            {sec.items.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="btn-ghost"
                style={{ width: '100%', textAlign: 'left', marginBottom: 4, padding: '6px 8px' }}
                onClick={() => onSelectTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
