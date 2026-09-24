import logo from '../assets/logos/logo-horizontal-transparent.png'

export default function Sidebar({
  user,
  tabs,
  active,
  onSelect,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}) {
  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src={logo} alt="Nexloads Hub" className="sidebar-logo" />
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="brand-mark" style={{ fontSize: '0.95rem' }}>Nexloads Hub</span>
              <span className="sidebar-subtitle">
                {user.role === 'admin' ? 'Admin' : (user.position || 'Employee')}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn btn-ghost"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="sidebar-nav scrollbar-thin" aria-label="Main navigation">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className={`sidebar-nav-btn${active === t.key ? ' active' : ''}`}
            title={collapsed ? t.label : undefined}
          >
            {collapsed ? t.label.charAt(0) : t.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && <div className="sidebar-user">{user.full_name}</div>}
        <button type="button" className="btn-ghost sidebar-signout" onClick={onLogout}>
          {collapsed ? 'Out' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
