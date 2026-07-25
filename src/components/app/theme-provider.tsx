'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  useEffect(() => {
    // Initialize theme from store or system
    const stored = useAppStore.persist?.hasHydrated?.()
    if (!stored && typeof window !== 'undefined') {
      const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefers ? 'dark' : 'light')
    }
  }, [setTheme])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return <>{children}</>
}
