import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import UpdatesFeed from '../components/UpdatesFeed'
import EmployeeManager from '../components/EmployeeManager'
import ChangePasswordCard from '../components/ChangePasswordModal'
import AdminDeals from '../components/AdminDeals'
import AdminColdCallers from '../components/AdminColdCallers'
import AdminMessaging from '../components/AdminMessaging'
import AdminPayroll from '../components/AdminPayroll'
import AdminEmployeeDetail from '../components/AdminEmployeeDetail'
import TeamPulse from '../components/TeamPulse'
import { supabase } from '../supabaseClient'
import { formatDateTime12h, formatTime12h } from '../utils/formatTime'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'employees', label: 'Employees' },
  { key: 'deals', label: 'Deals & Sales' },
  { key: 'coldcallers', label: 'Cold Callers' },
  { key: 'timelogs', label: 'Time logs' },
  { key: 'updates', label: 'Team updates' },
  { key: 'messages', label: 'Messaging' },
  { key: 'payroll', label: 'Payroll & Bonuses' },
  { key: 'settings', label: 'Settings' },
]

export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [timelogs, setTimelogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  useEffect(() => {
    if (tab === 'timelogs' || tab === 'overview') loadTimelogs()
    if (tab === 'deals' || tab === 'coldcallers' || tab === 'messages' || tab === 'payroll' || tab === 'employees' || tab === 'overview') loadEmployees()
  }, [tab])

  function openEmployeeDetail(emp) {
    setSelectedEmployee(emp)
    setTab('employeeDetail')
  }

  async function loadTimelogs() {
    const { data } = await supabase.rpc('admin_get_all_timelogs', { p_admin_id: user.id })
    if (data?.success) setTimelogs(data.timelogs)
  }

  async function loadEmployees() {
    const { data } = await supabase.rpc('admin_list_employees', { p_admin_id: user.id })
    if (data?.success) setEmployees(data.employees)
  }

  return (
    <div className="dashboard-shell">
      <Sidebar user={user} tabs={TABS} active={tab} onSelect={setTab} onLogout={onLogout} />
      <div className="dashboard-main">
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
          Admin — {user.full_name.split(' ')[0]}
        </h2>

        {tab === 'overview' && (
          <>
            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-label">Clocked in now</div>
                <div className="stat-value stat-accent">{timelogs.filter((t) => !t.clock_out).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total employees</div>
                <div className="stat-value">{employees.filter((e) => e.active).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Your role</div>
                <div className="stat-value" style={{ fontSize: '1.3rem' }}>Admin</div>
              </div>
            </div>
            <div className="dashboard-grid">
              <div className="card">
                <h3 className="card-title">Currently clocked in</h3>
                <div style={{ marginTop: 16 }}>
                  {timelogs.filter((t) => !t.clock_out).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No one is clocked in right now.</div>
                  )}
                  {timelogs.filter((t) => !t.clock_out).map((t) => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
                      <span>{t.full_name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>since {formatTime12h(t.clock_in)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <UpdatesFeed employeeId={user.id} />
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <TeamPulse adminId={user.id} employees={employees} onSelectEmployee={openEmployeeDetail} />
            </div>
          </>
        )}

        {tab === 'employees' && <EmployeeManager adminId={user.id} onSelectEmployee={openEmployeeDetail} />}

        {tab === 'employeeDetail' && selectedEmployee && (
          <AdminEmployeeDetail adminId={user.id} employee={selectedEmployee} onBack={() => setTab('employees')} />
        )}

        {tab === 'deals' && <AdminDeals adminId={user.id} />}

        {tab === 'coldcallers' && <AdminColdCallers adminId={user.id} employees={employees} />}

        {tab === 'timelogs' && (
          <div className="card" style={{ maxWidth: 700 }}>
            <h3 className="card-title">All time logs</h3>
            <div style={{ marginTop: 16, maxHeight: 480, overflowY: 'auto' }} className="scrollbar-thin">
              {timelogs.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
                  <span>{t.full_name}</span>
                  <span>{formatDateTime12h(t.clock_in)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{t.clock_out ? formatTime12h(t.clock_out) : 'In progress'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'updates' && (
          <div style={{ maxWidth: 640 }}>
            <UpdatesFeed employeeId={user.id} />
          </div>
        )}

        {tab === 'messages' && <AdminMessaging adminId={user.id} employees={employees} />}

        {tab === 'payroll' && <AdminPayroll adminId={user.id} employees={employees} />}

        {tab === 'settings' && <ChangePasswordCard adminId={user.id} />}
      </div>
    </div>
  )
}
