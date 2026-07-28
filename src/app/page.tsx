'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { LoginScreen } from '@/components/app/login-screen'
import { AppShell } from '@/components/app/app-shell'
import { ThemeProvider } from '@/components/app/theme-provider'
import { PendaftaranFormDinamis } from '@/components/pendaftaran/pendaftaran-form-dinamis'

function HomeContent() {
  const user = useAppStore((s) => s.user)
  const theme = useAppStore((s) => s.theme)
  const searchParams = useSearchParams()
  // Public registration form is shown when ?daftar=true is present in the URL.
  // This lets admins share a single link (e.g. https://app/?daftar=true) to
  // prospective KKN/PLP participants — no login required.
  const isDaftarMode = searchParams.get('daftar') === 'true'

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Public registration form takes priority — no auth required.
  if (isDaftarMode) {
    return (
      <ThemeProvider>
        <PendaftaranFormDinamis />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      {!user ? <LoginScreen /> : <AppShell />}
    </ThemeProvider>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}
