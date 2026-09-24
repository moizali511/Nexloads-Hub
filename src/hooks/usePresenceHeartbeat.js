import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

const HEARTBEAT_MS = 45000

/**
 * Keeps last_seen_at fresh and reports online vs away (tab hidden).
 * Clock status is separate — use timelogs RPCs.
 */
export function usePresenceHeartbeat(employeeId) {
  useEffect(() => {
    if (!employeeId) return undefined

    let status = document.visibilityState === 'visible' ? 'online' : 'away'

    function send() {
      supabase.rpc('heartbeat', { p_employee_id: employeeId, p_presence_status: status })
    }

    function onVisibility() {
      status = document.visibilityState === 'visible' ? 'online' : 'away'
      send()
    }

    send()
    const interval = setInterval(send, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [employeeId])
}
