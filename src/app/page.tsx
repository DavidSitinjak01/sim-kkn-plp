'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { LoginScreen } from '@/components/app/login-screen'
import { AppShell } from '@/components/app/app-shell'
import { ThemeProvider } from '@/components/app/theme-provider'

export default function Home() {
  const user = useAppStore((s) => s.user)
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <ThemeProvider>
      {!user ? <LoginScreen /> : <AppShell />}
    </ThemeProvider>
  )
}
