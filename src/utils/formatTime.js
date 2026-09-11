// Always renders 12-hour time with AM/PM, regardless of the browser's
// locale settings (some locales default toLocaleTimeString to 24-hour).
export function formatTime12h(dateInput) {
  const d = new Date(dateInput)
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

export function formatDateTime12h(dateInput) {
  const d = new Date(dateInput)
  return `${d.toLocaleDateString()} ${formatTime12h(d)}`
}
