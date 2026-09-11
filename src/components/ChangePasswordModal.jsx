import { useState } from 'react'
import { supabase } from '../supabaseClient'
import PasswordInput from './PasswordInput'

// This control only ever renders inside the Admin dashboard.
export default function ChangePasswordCard({ adminId }) {
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
    if (next.length < 8) {
      setMsg({ type: 'error', text: 'New password must be at least 8 characters.' })
      return
    }

    setBusy(true)
    const { data } = await supabase.rpc('change_admin_password', {
      p_admin_id: adminId,
      p_current_password: current,
      p_new_password: next,
    })
    setBusy(false)

    if (!data?.success) {
      const map = {
        wrong_current_password: 'Current password is incorrect.',
        password_too_short: 'New password must be at least 8 characters.',
        not_authorized: 'Only the admin account can change this password.',
      }
      setMsg({ type: 'error', text: map[data?.error] || 'Could not update password.' })
      return
    }

    setMsg({ type: 'success', text: 'Password updated.' })
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  return (
    <div className="card">
      <h3 className="card-title">Admin password</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 6 }}>
        Only your own admin account can change this here.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, marginTop: 16, maxWidth: 340 }}>
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
