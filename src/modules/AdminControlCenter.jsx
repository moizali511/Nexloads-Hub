import { getAdminControlSections } from '../utils/navigation'

export default function AdminControlCenter({ user, onSelectTab }) {
  const sections = getAdminControlSections(user)

  return (
    <div className="card">
      <h3 className="card-title">Admin control center</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Jump to any administrative area of Nexloads Hub.</p>
      <div className="control-center-grid">
        {sections.map((sec) => (
          <div key={sec.title} className="control-center-card">
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
