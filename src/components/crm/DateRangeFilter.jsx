const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
]

function rangeForPreset(key) {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  if (key === 'today') {
    return { start: toDate(now), end: toDate(now) }
  }
  if (key === 'week') {
    const day = now.getDay()
    start.setDate(now.getDate() - day)
    return { start: toDate(start), end: toDate(now) }
  }
  if (key === 'month') {
    start.setDate(1)
    return { start: toDate(start), end: toDate(now) }
  }
  if (key === 'last_month') {
    start.setMonth(now.getMonth() - 1, 1)
    end.setMonth(now.getMonth(), 0)
    return { start: toDate(start), end: toDate(end) }
  }
  return { start: toDate(now), end: toDate(now) }
}

function toDate(d) {
  return d.toISOString().slice(0, 10)
}

export default function DateRangeFilter({ value, onChange }) {
  const preset = value?.preset || 'month'

  function setPreset(key) {
    if (key === 'custom') {
      onChange({ preset: 'custom', ...rangeForPreset('month') })
      return
    }
    onChange({ preset: key, ...rangeForPreset(key) })
  }

  return (
    <div className="date-range-filter">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`theme-toggle-btn${preset === p.key ? ' active' : ''}`}
          onClick={() => setPreset(p.key)}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input type="date" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} />
        </div>
      )}
    </div>
  )
}

export function defaultDateRange() {
  return { preset: 'month', ...rangeForPreset('month') }
}
