import { useTheme } from '../context/ThemeContext'

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export default function ThemeToggle({ compact = false }) {
  const { preference, setPreference } = useTheme()

  if (compact) {
    return (
      <select
        className="theme-select"
        value={preference}
        onChange={(e) => setPreference(e.target.value)}
        aria-label="Theme"
        style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', width: 'auto' }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`theme-toggle-btn${preference === o.value ? ' active' : ''}`}
          onClick={() => setPreference(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
