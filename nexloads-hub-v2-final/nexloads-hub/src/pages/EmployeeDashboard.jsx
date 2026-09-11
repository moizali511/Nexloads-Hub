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
import { supabase } from '../supabaseClient'
import { playNotificationSound } from '../utils/notifySound'
import { departmentLabel, isManagerDepartment } from '../utils/departments'

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
    ...(isDispatcher ? [{ key: 'deals', label: 'Deals & Invoices' }] : []),
    ...(isColdCaller ? [{ key: 'coldcalling', label: 'Cold Calling' }] : []),
    ...(usesPerfPanel ? [{ key: 'performance', label: 'My Performance' }] : []),
    ...(isManager ? [{ key: 'team', label: 'My Team' }] : []),
    { key: 'updates', label: 'Team updates' },
    { key: 'messages', label: `Messages${newIds.size > 0 ? ` (${newIds.size})` : ''}` },
  ]

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 24, fontSize: '0.9rem' }}>
          {user.position || departmentLabel(department)}
        </p>

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
          <div style={{ maxWidth: 640 }}>
            <EmployeeMessages messages={messages} newIds={newIds} />
          </div>
        )}
      </div>
    </div>
  )
}
