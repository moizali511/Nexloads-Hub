import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { playNotificationSound } from '../utils/notifySound'
import { ensureNotificationPermission, showDesktopNotification } from '../utils/desktopNotify'

const POLL_MS = 7000

function isIncomingMessage(m, employeeId) {
  if (m.is_mine) return false
  if (m.is_direct) return true
  return Boolean(m.sender_name)
}

/**
 * Polls messages, CRM notifications, and chat unread — sound + desktop popup only while clocked in.
 */
export function useClockedInAlerts(employeeId, { onToast } = {}) {
  const [clockedIn, setClockedIn] = useState(false)
  const [legacyMessages, setLegacyMessages] = useState([])
  const [newMessageIds, setNewMessageIds] = useState(() => new Set())
  const seenRef = useRef({
    notifications: new Set(),
    messages: new Set(),
    chatUnread: 0,
    initialized: false,
  })

  const notify = useCallback(
    (title, body, meta = {}) => {
      playNotificationSound()
      onToast?.({ id: `${Date.now()}-${Math.random()}`, title, body, ...meta })
      showDesktopNotification(title, body, meta.onClick)
    },
    [onToast],
  )

  const poll = useCallback(async () => {
    if (!employeeId) return

    const { data: logs } = await supabase.rpc('get_my_timelogs', { p_employee_id: employeeId })
    const open = Array.isArray(logs) && logs.some((l) => !l.clock_out)
    setClockedIn(open)

    if (!open) return

    if (seenRef.current.initialized && Notification.permission === 'default') {
      await ensureNotificationPermission()
    }

    const [notifRes, msgRes, chatRes] = await Promise.all([
      supabase.rpc('crm_list_notifications', { p_caller_id: employeeId, p_unread_only: true }),
      supabase.rpc('get_my_messages', { p_employee_id: employeeId }),
      supabase.rpc('chat_list_rooms', { p_employee_id: employeeId }),
    ])

    const notifications = notifRes.data?.success ? notifRes.data.notifications || [] : []
    const messages = msgRes.data || []
    setLegacyMessages(messages)

    const chatRooms = chatRes.data?.success ? chatRes.data.rooms || [] : []
    const chatUnread = chatRooms.reduce((sum, r) => sum + (Number(r.unread_count) || 0), 0)

    const seen = seenRef.current
    if (!seen.initialized) {
      notifications.forEach((n) => seen.notifications.add(n.id))
      messages.filter((m) => isIncomingMessage(m, employeeId)).forEach((m) => seen.messages.add(m.id))
      seen.chatUnread = chatUnread
      seen.initialized = true
      const incoming = messages.filter((m) => isIncomingMessage(m, employeeId))
      setNewMessageIds(new Set(incoming.map((m) => m.id)))
      return
    }

    const freshNotifs = notifications.filter((n) => !seen.notifications.has(n.id))
    freshNotifs.forEach((n) => {
      seen.notifications.add(n.id)
      notify(n.title || 'Nexloads Hub', n.body || 'New notification', { kind: 'notification' })
    })

    const incoming = messages.filter((m) => isIncomingMessage(m, employeeId))
    const freshMsgs = incoming.filter((m) => !seen.messages.has(m.id))
    if (freshMsgs.length > 0) {
      freshMsgs.forEach((m) => seen.messages.add(m.id))
      setNewMessageIds((prev) => {
        const next = new Set(prev)
        freshMsgs.forEach((m) => next.add(m.id))
        return next
      })
      const preview = freshMsgs[0]
      const from = preview.sender_name || 'Someone'
      const body = (preview.body || 'New message').slice(0, 120)
      notify(`Message from ${from}`, body, { kind: 'message' })
    }

    if (chatUnread > seen.chatUnread) {
      const delta = chatUnread - seen.chatUnread
      seen.chatUnread = chatUnread
      notify('Team chat', delta === 1 ? 'You have a new chat message' : `${delta} new chat messages`, { kind: 'chat' })
    } else if (chatUnread < seen.chatUnread) {
      seen.chatUnread = chatUnread
    }
  }, [employeeId, notify])

  useEffect(() => {
    if (!employeeId) return undefined
    seenRef.current = { notifications: new Set(), messages: new Set(), chatUnread: 0, initialized: false }
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [employeeId, poll])

  const clearNewMessages = useCallback(() => {
    setNewMessageIds(new Set())
    supabase.rpc('mark_all_messages_read', { p_employee_id: employeeId })
  }, [employeeId])

  return {
    clockedIn,
    legacyMessages,
    newMessageIds,
    clearNewMessages,
    refresh: poll,
  }
}
