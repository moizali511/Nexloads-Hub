import { useState } from 'react'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'

export default function DashboardLayout({
  user,
  tabs,
  activeTab,
  onSelectTab,
  onLogout,
  topBarExtra,
  children,
}) {
  const [navOpen, setNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className={`dashboard-shell${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}${navOpen ? ' mobile-nav-open' : ''}`}>
      <div
        className="sidebar-backdrop"
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <Sidebar
        user={user}
        tabs={tabs}
        active={activeTab}
        onSelect={(key) => {
          onSelectTab(key)
          setNavOpen(false)
        }}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="btn-ghost mobile-menu-btn"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Open menu"
          >
            Menu
          </button>
          <div className="dashboard-topbar-spacer" />
          <div className="dashboard-topbar-actions">
            {topBarExtra}
            <ThemeToggle compact />
          </div>
        </header>
        <main className="dashboard-main scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}
