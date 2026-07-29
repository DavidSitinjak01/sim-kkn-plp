'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { LoginScreen } from '@/components/app/login-screen'
import { AppShell } from '@/components/app/app-shell'
import { ThemeProvider } from '@/components/app/theme-provider'
import { PendaftaranFormDinamis } from '@/components/pendaftaran/pendaftaran-form-dinamis'
import { AbsensiWajahPublic } from '@/components/absensi-wajah/absensi-wajah-public'

function HomeContent() {
  const user = useAppStore((s) => s.user)
  const theme = useAppStore((s) => s.theme)
  const searchParams = useSearchParams()
  // Public registration form is shown when ?daftar=true is present in the URL.
  // This lets admins share a single link (e.g. https://app/?daftar=true) to
  // prospective KKN/PLP participants — no login required.
  const isDaftarMode = searchParams.get('daftar') === 'true'
  // Public face attendance page shown when ?absensi=wajah&token=xxx is present.
  // Superadmin generates a unique token per mahasiswa and shares the link.
  const isAbsensiWajahMode = searchParams.get('absensi') === 'wajah' && !!searchParams.get('token')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Public face attendance takes priority — no auth required.
  if (isAbsensiWajahMode) {
    return (
      <ThemeProvider>
        <AbsensiWajahPublic />
      </ThemeProvider>
    )
  }

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
