import { useEffect } from 'react'
import { useSettings } from '../db/hooks'

const THEME_COLORS = { dark: '#0b0f0e', light: '#f3f5f4' } as const

/** Applies the theme setting to <html data-theme> and the browser chrome colour. Dark until settings load. */
export function ThemeSync() {
  const theme = useSettings()?.theme ?? 'dark'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return null
}
