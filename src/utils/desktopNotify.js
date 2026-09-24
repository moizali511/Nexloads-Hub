const ICON = '/favicon.ico'

export function canUseDesktopNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function ensureNotificationPermission() {
  if (!canUseDesktopNotifications()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

/**
 * OS-level notification (Chrome/Edge/Firefox). Only fires when permission granted.
 */
export function showDesktopNotification(title, body, onClick) {
  if (!canUseDesktopNotifications() || Notification.permission !== 'granted') return null
  try {
    const n = new Notification(title, {
      body: body || '',
      icon: ICON,
      tag: `nexloads-${title}-${body}`.slice(0, 180),
    })
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
    return n
  } catch {
    return null
  }
}
