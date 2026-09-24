import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { DEPARTMENTS, departmentLabel } from '../utils/departments'
import { formatDateTime12h } from '../utils/formatTime'
import PasswordInput from './PasswordInput'
import { presenceMeta, clockStatusLabel } from '../utils/presence'

const EMPLOYMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'closed', label: 'Closed' },
]

export default function EmployeeManager({ adminId, onSelectEmployee }) {
  const [employees, setEmployees] = useState([])
  const [presence, setPresence] = useState({}) // employee_id -> { is_online, last_login_at, last_seen_at }
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'employee', position: '',
    department: 'dispatcher', manager_id: '',
    base_salary: '', base_salary_currency: 'PKR',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [salaryEdits, setSalaryEdits] = useState({})
  const [savingSalaryId, setSavingSalaryId] = useState(null)
  const [roleEdits, setRoleEdits] = useState({})
  const [savingRoleId, setSavingRoleId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [resetPasswordId, setResetPasswordId] = useState(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resettingId, setResettingId] = useState(null)

  useEffect(() => {
    load()
    loadPresence()
    const interval = setInterval(loadPresence, 15000) // live online/offline without a full reload
    return () => clearInterval(interval)
  }, [])

  async function loadPresence() {
    const { data } = await supabase.rpc('admin_get_presence', { p_admin_id: adminId })
    if (data?.success) {
      const map = {}
      data.presence.forEach((p) => { map[p.id] = p })
      setPresence(map)
    }
  }

  async function load() {
    const { data } = await supabase.rpc('admin_list_employees', { p_admin_id: adminId })
    if (data?.success) setEmployees(data.employees)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('admin_add_employee', {
      p_admin_id: adminId,
      p_full_name: form.full_name.trim(),
      p_email: form.email.trim(),
      p_password: form.password,
      p_role: form.role,
      p_position: form.position.trim() || 'Dispatcher',
      p_base_salary: parseFloat(form.base_salary) || 0,
      p_base_salary_currency: form.base_salary_currency,
      p_department: form.department,
      p_manager_id: form.manager_id || null,
    })
    setBusy(false)
    if (rpcError) {
      setError('Could not reach the server. Check your connection and try again.')
      return
    }
    if (!data?.success) {
      setError(errorMessage(data?.error))
      return
    }
    setForm({
      full_name: '', email: '', password: '', role: 'employee', position: '',
      department: 'dispatcher', manager_id: '', base_salary: '', base_salary_currency: 'PKR',
    })
    setShowForm(false)
    load()
  }

  function errorMessage(code) {
    switch (code) {
      case 'email_taken': return 'That email is already registered.'
      case 'name_required': return 'Full name is required.'
      case 'email_required': return 'Email is required.'
      case 'password_too_short': return 'Password must be at least 4 characters.'
      case 'invalid_department': return 'Pick a valid department.'
      case 'manager_not_found': return 'The selected manager no longer exists.'
      case 'not_authorized': return 'Your admin session looks invalid — try logging out and back in.'
      default: return code ? `Could not add employee (${code}).` : 'Could not add employee.'
    }
  }

  async function setEmploymentStatus(emp, status) {
    const reason = window.prompt(`Reason for changing ${emp.full_name} to ${status}? (optional)`) || ''
    const { data, error: rpcError } = await supabase.rpc('admin_set_employment_status', {
      p_admin_id: adminId,
      p_employee_id: emp.id,
      p_status: status,
      p_reason: reason,
    })
    if (rpcError || !data?.success) {
      if (status === 'active' || status === 'inactive') {
        await supabase.rpc('admin_set_employee_active', {
          p_admin_id: adminId,
          p_employee_id: emp.id,
          p_active: status === 'active',
        })
        load()
        return
      }
      alert('Could not update status. Run sql/migrations/001_foundation_audit_presence_time.sql on Supabase.')
      return
    }
    load()
  }

  async function toggleActive(emp) {
    await setEmploymentStatus(emp, emp.active ? 'inactive' : 'active')
  }

  async function deletePermanently(emp) {
    const confirmText = window.prompt(
      `This permanently deletes ${emp.full_name} and ALL their data — time logs, deals, cold caller activity, performance logs, messages, bonuses, everything. This cannot be undone.\n\nType their name exactly to confirm: ${emp.full_name}`
    )
    if (confirmText !== emp.full_name) {
      if (confirmText !== null) alert('Name did not match — nothing was deleted.')
      return
    }
    const { data } = await supabase.rpc('admin_delete_employee_permanently', {
      p_admin_id: adminId, p_employee_id: emp.id,
    })
    if (data?.success) load()
    else alert('Could not delete this employee.')
  }

  async function saveSalary(emp) {
    const draft = salaryEdits[emp.id] || { amount: emp.base_salary, currency: emp.base_salary_currency }
    setSavingSalaryId(emp.id)
    await supabase.rpc('admin_update_employee_base_salary', {
      p_admin_id: adminId, p_employee_id: emp.id,
      p_base_salary: parseFloat(draft.amount) || 0,
      p_base_salary_currency: draft.currency,
    })
    setSavingSalaryId(null)
    load()
  }

  async function saveRoleInfo(emp) {
    const draft = roleEdits[emp.id] || { position: emp.position, department: emp.department, manager_id: emp.manager_id || '' }
    setSavingRoleId(emp.id)
    await supabase.rpc('admin_update_employee_role_info', {
      p_admin_id: adminId, p_employee_id: emp.id,
      p_position: draft.position,
      p_department: draft.department,
      p_manager_id: draft.manager_id || null,
    })
    setSavingRoleId(null)
    load()
  }

  async function resetPassword(emp) {
    if (!resetPasswordValue || resetPasswordValue.length < 4) {
      alert('New password must be at least 4 characters.')
      return
    }
    setResettingId(emp.id)
    const { data } = await supabase.rpc('admin_reset_employee_password', {
      p_admin_id: adminId, p_employee_id: emp.id, p_new_password: resetPasswordValue,
    })
    setResettingId(null)
    if (data?.success) {
      setResetPasswordId(null)
      setResetPasswordValue('')
      alert(`Password reset for ${emp.full_name}. Give them the new password to log in.`)
    } else {
      alert('Could not reset password.')
    }
  }

  // Anyone can be picked as a "reports to" manager except the employee themself.
  function managerOptions(currentId) {
    return employees.filter((e) => e.id !== currentId)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title">Employees</h3>
        <button className="btn-ghost" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Add employee'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} style={{ marginTop: 18, display: 'grid', gap: 14, maxWidth: 460 }}>
          <div>
            <label style={fieldLabel}>Full name</label>
            <input
              type="text" placeholder="e.g. Ayesha Khan" required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>

          <div>
            <label style={fieldLabel}>Email</label>
            <input
              type="email" placeholder="name@nexloads.com" required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label style={fieldLabel}>Temporary password</label>
            <PasswordInput
              placeholder="They can be given this to log in" required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div>
            <label style={fieldLabel}>Position / job title</label>
            <input
              type="text" placeholder="e.g. Dispatcher, Sales Rep, Driver Manager — type anything"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </div>

          <div>
            <label style={fieldLabel}>Department (drives their dashboard)</label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 5 }}>
              This is what actually controls which tabs/tools they see — separate from the job title above.
            </div>
          </div>

          <div>
            <label style={fieldLabel}>Reports to (optional)</label>
            <select
              value={form.manager_id}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
            >
              <option value="">No one / not set</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} ({departmentLabel(e.department)})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
            <div>
              <label style={fieldLabel}>Basic salary</label>
              <input
                type="number" step="0.01" min="0" placeholder="e.g. 25000"
                value={form.base_salary}
                onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
              />
            </div>
            <div>
              <label style={fieldLabel}>Currency</label>
              <select
                value={form.base_salary_currency}
                onChange={(e) => setForm({ ...form, base_salary_currency: e.target.value })}
              >
                <option value="PKR">PKR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: -6 }}>
            Used at month-end closing to calculate their final pay along with commission/fees + bonuses.
          </div>

          <div>
            <label style={fieldLabel}>Access level</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="employee">Employee — dashboard access only</option>
              <option value="admin">Admin — full access</option>
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 5 }}>
              This controls login permissions, separate from their job title/department above.
            </div>
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add employee'}</button>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        {employees.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No employees added yet.</div>
        )}
        {employees.map((emp) => {
          const salaryDraft = salaryEdits[emp.id] || { amount: emp.base_salary, currency: emp.base_salary_currency }
          const roleDraft = roleEdits[emp.id] || { position: emp.position, department: emp.department, manager_id: emp.manager_id || '' }
          const isExpanded = expandedId === emp.id
          const isResetting = resetPasswordId === emp.id
          const live = presence[emp.id]
          const presenceState = live?.presence_state || (live?.is_online ? 'online' : 'offline')
          const pMeta = presenceMeta(presenceState)
          const isClockedIn = live?.is_clocked_in
          const employmentStatus = emp.employment_status || (emp.active ? 'active' : 'inactive')
          return (
            <div key={emp.id} style={row}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <button
                  onClick={() => onSelectEmployee && onSelectEmployee(emp)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    color: 'var(--text-primary)', fontSize: '1rem', textDecoration: 'underline',
                    textDecorationColor: 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = 'var(--orange-1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = 'transparent')}
                  title="View this employee's full profile"
                >
                  <span className={`status-dot ${pMeta.dotClass}`} title={pMeta.label} aria-hidden />
                  {emp.full_name}
                  {emp.role === 'admin' && <span className="pill">Admin</span>}
                  {employmentStatus !== 'active' && (
                    <span className="pill" style={{ background: 'rgba(255,92,92,0.14)', color: 'var(--danger)', borderColor: 'rgba(255,92,92,0.28)' }}>
                      {EMPLOYMENT_STATUSES.find((s) => s.value === employmentStatus)?.label || employmentStatus}
                    </span>
                  )}
                </button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {emp.position || 'Dispatcher'} · {departmentLabel(emp.department)} · {emp.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  <span title="Online presence">{pMeta.emoji} {pMeta.label}</span>
                  {' · '}
                  <span title="Time clock">{clockStatusLabel(isClockedIn)}</span>
                  {live?.last_seen_at && presenceState === 'offline' && ` · Last seen ${formatDateTime12h(live.last_seen_at)}`}
                  {live?.last_login_at && ` · Last login ${formatDateTime12h(live.last_login_at)}`}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number" step="0.01" min="0" style={{ maxWidth: 110 }}
                    value={salaryDraft.amount}
                    onChange={(e) => setSalaryEdits({ ...salaryEdits, [emp.id]: { ...salaryDraft, amount: e.target.value } })}
                  />
                  <select
                    style={{ maxWidth: 90 }}
                    value={salaryDraft.currency}
                    onChange={(e) => setSalaryEdits({ ...salaryEdits, [emp.id]: { ...salaryDraft, currency: e.target.value } })}
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                  </select>
                  <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }} disabled={savingSalaryId === emp.id} onClick={() => saveSalary(emp)}>
                    {savingSalaryId === emp.id ? 'Saving…' : 'Save salary'}
                  </button>
                  <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => setExpandedId(isExpanded ? null : emp.id)}>
                    {isExpanded ? 'Hide role settings' : 'Edit role/department'}
                  </button>
                  <button
                    className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                    onClick={() => { setResetPasswordId(isResetting ? null : emp.id); setResetPasswordValue('') }}
                  >
                    {isResetting ? 'Cancel' : 'Reset password'}
                  </button>
                </div>

                {isResetting && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', maxWidth: 320, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <PasswordInput
                        placeholder="New password for this employee"
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                      />
                    </div>
                    <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} disabled={resettingId === emp.id} onClick={() => resetPassword(emp)}>
                      {resettingId === emp.id ? 'Setting…' : 'Set new password'}
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-panel-raised)', borderRadius: 8, display: 'grid', gap: 8, maxWidth: 380 }}>
                    <div>
                      <label style={fieldLabel}>Position / job title</label>
                      <input
                        type="text" value={roleDraft.position}
                        onChange={(e) => setRoleEdits({ ...roleEdits, [emp.id]: { ...roleDraft, position: e.target.value } })}
                      />
                    </div>
                    <div>
                      <label style={fieldLabel}>Department</label>
                      <select
                        value={roleDraft.department}
                        onChange={(e) => setRoleEdits({ ...roleEdits, [emp.id]: { ...roleDraft, department: e.target.value } })}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d.key} value={d.key}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabel}>Reports to</label>
                      <select
                        value={roleDraft.manager_id}
                        onChange={(e) => setRoleEdits({ ...roleEdits, [emp.id]: { ...roleDraft, manager_id: e.target.value } })}
                      >
                        <option value="">No one / not set</option>
                        {managerOptions(emp.id).map((e2) => (
                          <option key={e2.id} value={e2.id}>{e2.full_name} ({departmentLabel(e2.department)})</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn-primary" style={{ padding: '6px 10px', fontSize: '0.78rem' }} disabled={savingRoleId === emp.id} onClick={() => saveRoleInfo(emp)}>
                      {savingRoleId === emp.id ? 'Saving…' : 'Save role settings'}
                    </button>
                    <div>
                      <label style={fieldLabel}>Employment status</label>
                      <select
                        value={employmentStatus}
                        onChange={(e) => setEmploymentStatus(emp, e.target.value)}
                      >
                        {EMPLOYMENT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className="btn-ghost"
                  style={{ color: emp.active ? 'var(--danger)' : 'var(--success)', borderColor: 'transparent' }}
                  onClick={() => toggleActive(emp)}
                >
                  {emp.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--danger)', borderColor: 'transparent' }}
                  onClick={() => deletePermanently(emp)}
                >
                  Delete permanently
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const fieldLabel = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--text-muted)',
  marginBottom: 6,
}

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: 10,
  padding: '12px 0',
  borderBottom: '1px solid var(--border-soft)',
}
