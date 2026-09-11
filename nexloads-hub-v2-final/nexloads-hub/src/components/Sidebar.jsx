import logo from '../assets/logos/logo-horizontal-transparent.png'

export default function Sidebar({ user, tabs, active, onSelect, onLogout }) {
  return (
    <div className="sidebar glass-panel" style={styles.wrap}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <img src={logo} alt="Nexloads Hub" style={{ height: 40, width: 'auto' }} />
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 32 }}>
          {user.role === 'admin' ? 'Admin dashboard' : (user.position || 'Dispatch dashboard')}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              style={{
                ...styles.navBtn,
                ...(active === t.key ? styles.navBtnActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        <div style={{ fontSize: '0.85rem', marginBottom: 10 }}>{user.full_name}</div>
        <button className="btn-ghost" style={{ width: '100%' }} onClick={onLogout}>
          Sign out
        </button>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    width: 220,
    flexShrink: 0,
    borderRight: '1px solid var(--border-soft)',
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100vh',
    position: 'sticky',
    top: 0,
  },
  navBtn: {
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    padding: '0.6rem 0.75rem',
    borderRadius: 8,
    fontSize: '0.9rem',
  },
  navBtnActive: {
    background: 'var(--bg-panel-raised)',
    color: 'var(--text-primary)',
  },
}
