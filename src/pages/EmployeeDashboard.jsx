import { useMemo, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import TimeClock from '../components/TimeClock'
import UpdatesFeed from '../components/UpdatesFeed'
import EmployeeMessages from '../components/EmployeeMessages'
import DealsPanel from '../components/DealsPanel'
import ColdCallerPanel from '../components/ColdCallerPanel'
import PerformancePanel from '../components/PerformancePanel'
import TeamOverviewPanel from '../components/TeamOverviewPanel'
import MonthlyProgressChart from '../components/MonthlyProgressChart'
import ChangeMyPassword from '../components/ChangeMyPassword'
import { departmentLabel } from '../utils/departments'
import NotificationCenter from '../components/NotificationCenter'
import LeadsPanel from '../modules/LeadsPanel'
import FollowUpsPanel from '../modules/FollowUpsPanel'
import CallsPanel from '../modules/CallsPanel'
import TeamChatPanel from '../modules/TeamChatPanel'
import TasksPanel from '../modules/TasksPanel'
import CrudModule from '../modules/CrudModule'
import RevenuePanel from '../modules/RevenuePanel'
import { useAlertPoller } from '../context/AlertPollerContext'
import { useGuardedTab } from '../hooks/useGuardedTab'
import {
  canAccessEmployeeTab,
  getEmployeeTabs,
} from '../utils/navigation'
import { CLIENT_STATUSES, LOAD_STATUSES, TRUCK_STATUSES, DRIVER_STATUSES } from '../utils/crmConstants'

export default function EmployeeDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const { legacyMessages, newMessageIds, clearNewMessages, clockedIn, refresh } = useAlertPoller()

  const tabs = useMemo(
    () => getEmployeeTabs(user, {
      messages: `Legacy${newMessageIds.size > 0 ? ` (${newMessageIds.size})` : ''}`,
    }),
    [user, newMessageIds.size],
  )

  useGuardedTab(tab, tabs.map((t) => t.key), setTab)

  function openMessagesTab() {
    if (!canAccessEmployeeTab(user, 'messages')) return
    setTab('messages')
    clearNewMessages()
  }

  function guard(key, content) {
    if (tab !== key || !canAccessEmployeeTab(user, key)) return null
    return content
  }

  return (
    <DashboardLayout
      user={user}
      tabs={tabs}
      activeTab={tab}
      onSelectTab={(key) => (key === 'messages' ? openMessagesTab() : setTab(key))}
      onLogout={onLogout}
      topBarExtra={
        <>
          {!clockedIn && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 8 }} title="Clock in to get sound and desktop alerts">
              Alerts off until clocked in
            </span>
          )}
          <NotificationCenter employeeId={user.id} />
        </>
      }
    >
      <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0, marginBottom: 4 }}>
        Welcome, {user.full_name.split(' ')[0]}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 24, fontSize: '0.9rem' }}>
        {user.position || departmentLabel(user.department)} · {departmentLabel(user.department)}
      </p>

      {guard('overview', (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="dashboard-grid">
            <TimeClock employeeId={user.id} />
            <UpdatesFeed employeeId={user.id} />
          </div>
          <MonthlyProgressChart callerId={user.id} employeeId={user.id} title="My progress" />
        </div>
      ))}

      {guard('deals', <DealsPanel employeeId={user.id} />)}
      {guard('coldcalling', <ColdCallerPanel employeeId={user.id} />)}
      {guard('leads', <LeadsPanel callerId={user.id} employees={[]} />)}
      {guard('calls', <CallsPanel callerId={user.id} />)}
      {guard('followups', <FollowUpsPanel callerId={user.id} />)}

      {guard('loads', (
        <CrudModule
          title="My loads"
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
            { key: 'rate', label: 'Rate' },
          ]}
        />
      ))}

      {guard('clients', (
        <CrudModule
          title="Clients"
          callerId={user.id}
          listRpc="crm_list_clients"
          upsertRpc="crm_upsert_client"
          emptyPayload={{ owner_name: '', company: '', status: 'active', dispatch_percent: 5 }}
          fields={[
            { key: 'owner_name', label: 'Owner name *', required: true },
            { key: 'company', label: 'Company' },
            { key: 'phone', label: 'Phone' },
            { key: 'status', label: 'Status', type: 'select', options: CLIENT_STATUSES.map((s) => ({ value: s, label: s })) },
          ]}
          columns={[
            { key: 'owner_name', label: 'Owner' },
            { key: 'company', label: 'Company' },
            { key: 'status', label: 'Status' },
          ]}
        />
      ))}

      {guard('trucks', (
        <CrudModule
          title="Trucks"
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
          ]}
        />
      ))}

      {guard('drivers', (
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
          ]}
        />
      ))}

      {guard('brokers', (
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
          ]}
        />
      ))}

      {guard('revenue', <RevenuePanel adminId={user.id} />)}
      {guard('tasks', <TasksPanel callerId={user.id} />)}
      {guard('teamchat', <TeamChatPanel employeeId={user.id} isAdmin={false} employees={[]} />)}

      {guard('performance', (
        <PerformancePanel employeeId={user.id} department={user.department} />
      ))}

      {guard('team', <TeamOverviewPanel managerId={user.id} />)}

      {guard('updates', (
        <div style={{ maxWidth: 640 }}>
          <UpdatesFeed employeeId={user.id} />
        </div>
      ))}

      {guard('messages', (
        <div style={{ maxWidth: 720 }}>
          <EmployeeMessages
            employeeId={user.id}
            messages={legacyMessages}
            newIds={newMessageIds}
            onSent={() => refresh()}
          />
        </div>
      ))}

      {guard('settings', (
        <div style={{ maxWidth: 480 }}>
          <ChangeMyPassword employeeId={user.id} />
        </div>
      ))}
    </DashboardLayout>
  )
}
