import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'secmulher.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* armazenamento bloqueado: segue o sistema */
  }
  return 'system'
}

const resolve = (p: ThemePreference): Resolved => (p === 'system' ? (media().matches ? 'dark' : 'light') : p)

/** Aplica a classe no <html>; com `animate`, as cores trocam com transição curta. */
function apply(theme: Resolved, animate: boolean) {
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
  }
  root.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0c12' : '#f9f8fb')
}

interface ThemeContextValue {
  preference: ThemePreference
  theme: Resolved
  setPreference: (p: ThemePreference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [theme, setTheme] = useState<Resolved>(() => resolve(readPreference()))

  // Acompanha a troca de tema do sistema enquanto a preferência for "system"
  useEffect(() => {
    if (preference !== 'system') return
    const mq = media()
    const onChange = () => {
      const t = mq.matches ? 'dark' : 'light'
      setTheme(t)
      apply(t, true)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* ignora */
    }
    const t = resolve(p)
    setPref(p)
    setTheme(t)
    apply(t, true)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle: () => setPreference(theme === 'dark' ? 'light' : 'dark') }),
    [preference, theme, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>')
  return ctx
}
