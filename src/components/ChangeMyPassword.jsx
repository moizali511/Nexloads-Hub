import { useState } from 'react'
import { supabase } from '../supabaseClient'
import PasswordInput from './PasswordInput'

// Lets any active employee change their own password, as long as they
// correctly enter their current one first.
export default function ChangeMyPassword({ employeeId }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg(null)

    if (next !== confirm) {
      setMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (next.length < 6) {
      setMsg({ type: 'error', text: 'New password must be at least 6 characters.' })
      return
    }

    setBusy(true)
    const { data } = await supabase.rpc('change_my_password', {
      p_employee_id: employeeId,
      p_current_password: current,
      p_new_password: next,
    })
    setBusy(false)

    if (!data?.success) {
      const map = {
        wrong_current_password: 'Current password is incorrect.',
        password_too_short: 'New password must be at least 6 characters.',
        not_authorized: 'Your session looks invalid — try logging out and back in.',
      }
      setMsg({ type: 'error', text: map[data?.error] || 'Could not update password.' })
      return
    }

    setMsg({ type: 'success', text: 'Password updated. Use it next time you log in.' })
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  return (
    <div className="card" style={{ maxWidth: 380 }}>
      <h3 className="card-title">My password</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 6 }}>
        Change the password you use to log in. You'll need your current one.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <PasswordInput
          placeholder="Current password" required
          value={current} onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordInput
          placeholder="New password" required
          value={next} onChange={(e) => setNext(e.target.value)}
        />
        <PasswordInput
          placeholder="Confirm new password" required
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
        />
        {msg && (
          <div style={{ color: msg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontSize: '0.85rem' }}>
            {msg.text}
          </div>
        )}
        <button className="btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  )
}
