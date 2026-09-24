import { createContext, useCallback, useContext, useState } from 'react'
import { useClockedInAlerts } from '../hooks/useClockedInAlerts'

const AlertPollerContext = createContext(null)

export function AlertPollerProvider({ employeeId, children }) {
  const [toasts, setToasts] = useState([])

  const onToast = useCallback((toast) => {
    setToasts((prev) => [...prev.slice(-4), toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 6000)
  }, [])

  const alerts = useClockedInAlerts(employeeId, { onToast })

  return (
    <AlertPollerContext.Provider value={{ ...alerts, toasts, dismissToast: (id) => setToasts((p) => p.filter((t) => t.id !== id)) }}>
      {children}
      <div className="alert-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="alert-toast card">
            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.title}</div>
            {t.body && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>{t.body}</div>}
          </div>
        ))}
      </div>
    </AlertPollerContext.Provider>
  )
}

export function useAlertPoller() {
  const ctx = useContext(AlertPollerContext)
  if (!ctx) {
    return {
      clockedIn: false,
      legacyMessages: [],
      newMessageIds: new Set(),
      clearNewMessages: () => {},
      refresh: () => {},
      toasts: [],
    }
  }
  return ctx
}
