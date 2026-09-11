import { useState } from 'react'
import { supabase } from '../supabaseClient'
import logo from '../assets/logos/logo-horizontal-transparent.png'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: rpcError } = await supabase.rpc('login_employee', {
      p_email: email.trim(),
      p_password: password,
    })

    setLoading(false)

    if (rpcError) {
      setError('Something went wrong. Try again.')
      return
    }
    if (!data?.success) {
      setError('Email or password is incorrect.')
      return
    }

    onLogin(data)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.glow} />
      <form onSubmit={handleSubmit} className="card glass-panel" style={styles.card}>
        <div style={styles.logoRow}>
          <img src={logo} alt="Nexloads Hub" style={{ height: 78, width: 'auto' }} />
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 20, marginBottom: 28, fontSize: '0.9rem' }}>
          Dispatch office sign in
        </p>

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@nexloads.com"
          required
          autoFocus
        />

        <label style={{ ...styles.label, marginTop: 16 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 24 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  wrap: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: '1rem',
  },
  glow: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,95,61,0.18), transparent 70%)',
    top: '-15%',
    right: '-10%',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    position: 'relative',
    zIndex: 1,
  },
  logoRow: { display: 'flex', alignItems: 'baseline' },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: 6,
  },
  error: {
    color: 'var(--danger)',
    fontSize: '0.85rem',
    marginTop: 14,
  },
}
