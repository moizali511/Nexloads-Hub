import { useEffect } from 'react'

/**
 * If the active tab is not allowed (role change / stale session), fall back to overview.
 */
export function useGuardedTab(activeTab, allowedKeys, setTab) {
  useEffect(() => {
    if (activeTab === 'employeeDetail') return
    if (!allowedKeys.length) return
    if (!allowedKeys.includes(activeTab)) {
      setTab(allowedKeys[0] || 'overview')
    }
  }, [activeTab, allowedKeys, setTab])
}
