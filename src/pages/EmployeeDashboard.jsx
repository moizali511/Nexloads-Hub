import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TimeClock from '../components/TimeClock'
import UpdatesFeed from '../components/UpdatesFeed'
import EmployeeMessages from '../components/EmployeeMessages'
import DealsPanel from '../components/DealsPanel'
import ColdCallerPanel from '../components/ColdCallerPanel'
import PerformancePanel from '../components/PerformancePanel'
import TeamOverviewPanel from '../components/TeamOverviewPanel'
import MonthlyProgressChart from '../components/MonthlyProgressChart'
import ChangeMyPassword from '../components/ChangeMyPassword'
import ThemeToggle from '../components/ThemeToggle'
import { supabase } from '../supabaseClient'
import { playNotificationSound } from '../utils/notifySound'
import { departmentLabel, isManagerDepartment } from '../utils/departments'
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat'
import NotificationCenter from '../components/NotificationCenter'
import LeadsPanel from '../modules/LeadsPanel'
import FollowUpsPanel from '../modules/FollowUpsPanel'
import CallsPanel from '../modules/CallsPanel'
import TeamChatPanel from '../modules/TeamChatPanel'
import TasksPanel from '../modules/TasksPanel'
import CrudModule from '../modules/CrudModule'
import { LOAD_STATUSES } from '../utils/crmConstants'

const POLL_MS = 8000

export default function EmployeeDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [messages, setMessages] = useState([])
  const [newIds, setNewIds] = useState(new Set())
  const seenIdsRef = useRef(null) // null until first load completes, so we never "notify" for history on login

  // Department drives which tabs/panels this employee sees — reliable,
  // unlike the old free-text position matching.
  const department = user.department || 'dispatcher'
  const isDispatcher = department === 'dispatcher'
  const isColdCaller = department === 'cold_caller'
  const isManager = isManagerDepartment(department)
  const usesPerfPanel = !isDispatcher && !isColdCaller

  const TABS = [
    { key: 'overview', label: 'Overview' },
    ...(isDispatcher ? [
      { key: 'deals', label: 'Deals & Invoices' },
      { key: 'loads', label: 'Loads' },
    ] : []),
    ...(isColdCaller ? [
      { key: 'coldcalling', label: 'Cold Calling' },
      { key: 'leads', label: 'My Leads' },
      { key: 'calls', label: 'Calls' },
      { key: 'followups', label: 'Follow-ups' },
    ] : []),
    ...(usesPerfPanel ? [{ key: 'performance', label: 'My Performance' }] : []),
    ...(isManager ? [{ key: 'team', label: 'My Team' }] : []),
    { key: 'tasks', label: 'Tasks' },
    { key: 'teamchat', label: 'Team chat' },
    { key: 'updates', label: 'Team updates' },
    { key: 'messages', label: `Legacy${newIds.size > 0 ? ` (${newIds.size})` : ''}` },
    { key: 'settings', label: 'Settings' },
  ]

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  usePresenceHeartbeat(user.id)

  async function loadMessages() {
    const { data } = await supabase.rpc('get_my_messages', { p_employee_id: user.id })
    const list = data || []

    if (seenIdsRef.current === null) {
      // first load ever this session — mark everything as already seen, no sound
      seenIdsRef.current = new Set(list.map((m) => m.id))
    } else {
      const fresh = list.filter((m) => !seenIdsRef.current.has(m.id))
      if (fresh.length > 0) {
        playNotificationSound()
        setNewIds((prev) => {
          const next = new Set(prev)
          fresh.forEach((m) => next.add(m.id))
          return next
        })
        fresh.forEach((m) => seenIdsRef.current.add(m.id))
      }
    }
    setMessages(list)
  }

  function openMessagesTab() {
    setTab('messages')
    setNewIds(new Set()) // clear the "new" highlight once they actually look
    supabase.rpc('mark_all_messages_read', { p_employee_id: user.id })
  }

  return (
    <div className="dashboard-shell">
      <Sidebar
        user={user}
        tabs={TABS}
        active={tab}
        onSelect={(key) => (key === 'messages' ? openMessagesTab() : setTab(key))}
        onLogout={onLogout}
      />
      <div className="dashboard-main">
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0, marginBottom: 4 }}>
          Welcome, {user.full_name.split(' ')[0]}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            {user.position || departmentLabel(department)}
          </p>
          <NotificationCenter employeeId={user.id} />
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div className="dashboard-grid">
              <TimeClock employeeId={user.id} />
              <UpdatesFeed employeeId={user.id} />
            </div>
            <MonthlyProgressChart callerId={user.id} employeeId={user.id} title="My progress" />
          </div>
        )}

        {tab === 'deals' && isDispatcher && <DealsPanel employeeId={user.id} />}

        {tab === 'coldcalling' && isColdCaller && <ColdCallerPanel employeeId={user.id} />}
        {tab === 'leads' && isColdCaller && <LeadsPanel callerId={user.id} employees={[]} />}
        {tab === 'calls' && isColdCaller && <CallsPanel callerId={user.id} />}
        {tab === 'followups' && isColdCaller && <FollowUpsPanel callerId={user.id} />}
        {tab === 'loads' && isDispatcher && (
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
        )}
        {tab === 'tasks' && <TasksPanel callerId={user.id} />}
        {tab === 'teamchat' && <TeamChatPanel employeeId={user.id} isAdmin={false} employees={[]} />}

        {tab === 'performance' && usesPerfPanel && (
          <PerformancePanel employeeId={user.id} department={department} />
        )}

        {tab === 'team' && isManager && <TeamOverviewPanel managerId={user.id} />}

        {tab === 'updates' && (
          <div style={{ maxWidth: 640 }}>
            <UpdatesFeed employeeId={user.id} />
          </div>
        )}

        {tab === 'messages' && (
          <div style={{ maxWidth: 720 }}>
            <EmployeeMessages employeeId={user.id} messages={messages} newIds={newIds} onSent={loadMessages} />
          </div>
        )}

        {tab === 'settings' && (
          <div style={{ maxWidth: 480, display: 'grid', gap: '1.5rem' }}>
            <div className="card">
              <h3 className="card-title">Appearance</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Light mode is the default. Your choice is saved on this device.</p>
              <div style={{ marginTop: 14 }}>
                <ThemeToggle />
              </div>
            </div>
            <ChangeMyPassword employeeId={user.id} />
          </div>
        )}
      </div>
    </div>
  )
}
