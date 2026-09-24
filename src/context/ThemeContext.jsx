import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'nexloads_hub_theme'

const ThemeContext = createContext(null)

function resolveSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    } catch {
      /* ignore */
    }
    return 'light'
  })

  const resolved = useMemo(() => {
    if (preference === 'system') return resolveSystemTheme()
    return preference
  }, [preference])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      /* ignore */
    }
  }, [preference, resolved])

  useEffect(() => {
    if (preference !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference,
    }),
    [preference, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
