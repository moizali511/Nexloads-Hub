/** Server-computed or client-side presence label. */
export const PRESENCE = {
  online: { label: 'Online', dotClass: 'online', emoji: '🟢' },
  away: { label: 'Away', dotClass: 'away', emoji: '🟡' },
  offline: { label: 'Offline', dotClass: 'offline', emoji: '⚫' },
}

export function presenceMeta(state) {
  return PRESENCE[state] || PRESENCE.offline
}

export function clockStatusLabel(isClockedIn) {
  return isClockedIn ? 'Clocked in' : 'Clocked out'
}
