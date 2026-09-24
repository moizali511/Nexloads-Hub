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
import AdminTimeControl from '../components/AdminTimeControl'
import AdminAuditLog from '../components/AdminAuditLog'
import GlobalSearch from '../components/GlobalSearch'
import NotificationCenter from '../components/NotificationCenter'
import LeadsPanel from '../modules/LeadsPanel'
import CrudModule from '../modules/CrudModule'
import AdminOverviewStats from '../modules/AdminOverviewStats'
import TeamChatPanel from '../modules/TeamChatPanel'
import AdminControlCenter from '../modules/AdminControlCenter'
import CallsPanel from '../modules/CallsPanel'
import FollowUpsPanel from '../modules/FollowUpsPanel'
import TasksPanel from '../modules/TasksPanel'
import RevenuePanel from '../modules/RevenuePanel'
import { supabase } from '../supabaseClient'
import { formatDateTime12h, formatTime12h } from '../utils/formatTime'
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat'
import { presenceMeta } from '../utils/presence'
import ThemeToggle from '../components/ThemeToggle'
import { CLIENT_STATUSES, LOAD_STATUSES, TRUCK_STATUSES, DRIVER_STATUSES } from '../utils/crmConstants'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'control', label: 'Control center' },
  { key: 'employees', label: 'Employees' },
  { key: 'leads', label: 'Leads' },
  { key: 'calls', label: 'Calls' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'clients', label: 'Clients' },
  { key: 'loads', label: 'Loads' },
  { key: 'trucks', label: 'Trucks' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'brokers', label: 'Brokers' },
  { key: 'deals', label: 'Deals & Sales' },
  { key: 'coldcallers', label: 'Cold Callers' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'timelogs', label: 'Time logs' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'teamchat', label: 'Team chat' },
  { key: 'messages', label: 'Legacy messages' },
  { key: 'audit', label: 'Audit log' },
  { key: 'updates', label: 'Team updates' },
  { key: 'payroll', label: 'Payroll & Bonuses' },
  { key: 'settings', label: 'Settings' },
]

export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [timelogs, setTimelogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  usePresenceHeartbeat(user.id)

  const openShifts = timelogs.filter((t) => !t.clock_out)

  useEffect(() => {
    if (['timelogs', 'overview'].includes(tab)) loadTimelogs()
    if (tab !== 'settings' && tab !== 'employeeDetail') loadEmployees()
  }, [tab])

  function openEmployeeDetail(emp) {
    setSelectedEmployee(emp)
    setTab('employeeDetail')
  }

  function onGlobalNavigate(result) {
    const map = { lead: 'leads', client: 'clients', load: 'loads', broker: 'brokers', employee: 'employees' }
    if (map[result.type]) setTab(map[result.type])
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
            Admin — {user.full_name.split(' ')[0]}
          </h2>
          <NotificationCenter employeeId={user.id} />
        </div>

        <GlobalSearch callerId={user.id} onNavigate={onGlobalNavigate} />

        {tab === 'overview' && (
          <>
            <AdminOverviewStats adminId={user.id} />
            <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
              <div className="card">
                <h3 className="card-title">Currently clocked in</h3>
                <div style={{ marginTop: 16 }}>
                  {openShifts.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No one is clocked in right now.</div>
                  )}
                  {openShifts.map((t) => {
                    const emp = employees.find((e) => e.id === t.employee_id)
                    const pState = emp?.presence_state || (emp?.is_online ? 'online' : 'offline')
                    const p = presenceMeta(pState)
                    return (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                        <span>{t.full_name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{p.emoji} {p.label}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Since {formatTime12h(t.clock_in)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <UpdatesFeed employeeId={user.id} />
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <TeamPulse adminId={user.id} employees={employees} onSelectEmployee={openEmployeeDetail} />
            </div>
          </>
        )}

        {tab === 'control' && <AdminControlCenter onSelectTab={setTab} />}

        {tab === 'employees' && <EmployeeManager adminId={user.id} onSelectEmployee={openEmployeeDetail} />}

        {tab === 'employeeDetail' && selectedEmployee && (
          <AdminEmployeeDetail adminId={user.id} employee={selectedEmployee} onBack={() => setTab('employees')} />
        )}

        {tab === 'leads' && <LeadsPanel callerId={user.id} employees={employees} />}
        {tab === 'calls' && <CallsPanel callerId={user.id} />}
        {tab === 'followups' && <FollowUpsPanel callerId={user.id} />}

        {tab === 'clients' && (
          <CrudModule
            title="Clients"
            callerId={user.id}
            listRpc="crm_list_clients"
            upsertRpc="crm_upsert_client"
            emptyPayload={{ owner_name: '', company: '', status: 'onboarding', dispatch_percent: 5 }}
            fields={[
              { key: 'owner_name', label: 'Owner name *', required: true },
              { key: 'company', label: 'Company' },
              { key: 'phone', label: 'Phone' },
              { key: 'dispatch_percent', label: 'Dispatch %', type: 'number' },
              { key: 'status', label: 'Status', type: 'select', options: CLIENT_STATUSES.map((s) => ({ value: s, label: s })) },
            ]}
            columns={[
              { key: 'owner_name', label: 'Owner' },
              { key: 'company', label: 'Company' },
              { key: 'status', label: 'Status' },
              { key: 'dispatcher_name', label: 'Dispatcher' },
            ]}
          />
        )}

        {tab === 'loads' && (
          <CrudModule
            title="Load management"
            callerId={user.id}
            listRpc="crm_list_loads"
            listArgs={{ p_filter: 'active' }}
            upsertRpc="crm_upsert_load"
            emptyPayload={{ pickup_location: '', delivery_location: '', rate: 0, status: 'searching' }}
            fields={[
              { key: 'pickup_location', label: 'Pickup *', required: true },
              { key: 'delivery_location', label: 'Delivery *', required: true },
              { key: 'rate', label: 'Rate ($)', type: 'number' },
              { key: 'status', label: 'Status', type: 'select', options: LOAD_STATUSES.map((s) => ({ value: s, label: s })) },
            ]}
            columns={[
              { key: 'load_number', label: 'Load #' },
              { key: 'status', label: 'Status' },
              { key: 'client_name', label: 'Client' },
              { key: 'rate', label: 'Rate' },
            ]}
          />
        )}

        {tab === 'trucks' && (
          <CrudModule
            title="Trucks (operations)"
            callerId={user.id}
            listRpc="crm_list_client_trucks"
            upsertRpc="crm_upsert_client_truck"
            emptyPayload={{ truck_number: '', status: 'available' }}
            fields={[
              { key: 'truck_number', label: 'Truck # *', required: true },
              { key: 'equipment', label: 'Equipment' },
              { key: 'status', label: 'Status', type: 'select', options: TRUCK_STATUSES.map((s) => ({ value: s, label: s })) },
            ]}
            columns={[
              { key: 'truck_number', label: 'Truck' },
              { key: 'status', label: 'Status' },
              { key: 'current_location', label: 'Location' },
            ]}
          />
        )}

        {tab === 'drivers' && (
          <CrudModule
            title="Drivers"
            callerId={user.id}
            listRpc="crm_list_drivers"
            upsertRpc="crm_upsert_driver"
            emptyPayload={{ full_name: '', status: 'available' }}
            fields={[
              { key: 'full_name', label: 'Name *', required: true },
              { key: 'phone', label: 'Phone' },
              { key: 'status', label: 'Status', type: 'select', options: DRIVER_STATUSES.map((s) => ({ value: s, label: s })) },
            ]}
            columns={[
              { key: 'full_name', label: 'Driver' },
              { key: 'phone', label: 'Phone' },
              { key: 'status', label: 'Status' },
            ]}
          />
        )}

        {tab === 'brokers' && (
          <CrudModule
            title="Brokers"
            callerId={user.id}
            listRpc="crm_list_brokers"
            upsertRpc="crm_upsert_broker"
            emptyPayload={{ company_name: '' }}
            fields={[
              { key: 'company_name', label: 'Broker company *', required: true },
              { key: 'contact_name', label: 'Contact' },
              { key: 'phone', label: 'Phone' },
            ]}
            columns={[
              { key: 'company_name', label: 'Broker' },
              { key: 'contact_name', label: 'Contact' },
              { key: 'phone', label: 'Phone' },
            ]}
          />
        )}

        {tab === 'deals' && <AdminDeals adminId={user.id} />}
        {tab === 'coldcallers' && <AdminColdCallers adminId={user.id} employees={employees} />}
        {tab === 'revenue' && <RevenuePanel adminId={user.id} />}
        {tab === 'tasks' && <TasksPanel callerId={user.id} />}

        {tab === 'timelogs' && (
          <div style={{ maxWidth: 820 }}>
            <AdminTimeControl adminId={user.id} onDone={loadTimelogs} />
            <div className="card">
              <h3 className="card-title">All time logs</h3>
              <div style={{ marginTop: 16, maxHeight: 480, overflowY: 'auto' }} className="scrollbar-thin">
                {timelogs.map((t) => (
                  <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span>{t.full_name}</span>
                      <span>{formatDateTime12h(t.clock_in)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {t.clock_out ? formatTime12h(t.clock_out) : 'In progress'}
                        {t.clock_out_forced && ' · Admin adjusted'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'teamchat' && <TeamChatPanel employeeId={user.id} isAdmin employees={employees} />}
        {tab === 'messages' && <AdminMessaging adminId={user.id} employees={employees} />}
        {tab === 'audit' && <AdminAuditLog adminId={user.id} />}

        {tab === 'updates' && (
          <div style={{ maxWidth: 640 }}>
            <UpdatesFeed employeeId={user.id} />
          </div>
        )}

        {tab === 'payroll' && <AdminPayroll adminId={user.id} employees={employees} />}

        {tab === 'settings' && (
          <div style={{ maxWidth: 480, display: 'grid', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">Appearance</h3>
              <ThemeToggle />
            </div>
            <ChangePasswordCard adminId={user.id} />
          </div>
        )}
      </div>
    </div>
  )
}
