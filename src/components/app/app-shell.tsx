'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { useBranding } from '@/lib/branding'
import { useIdleTimer } from '@/hooks/use-idle-timer'
import { Sidebar } from '@/components/app/sidebar'
import { Header } from '@/components/app/header'
import { DashboardView } from '@/components/views/dashboard-view'
import { MahasiswaView } from '@/components/views/mahasiswa-view'
import { DosenView } from '@/components/views/dosen-view'
import { DesaView } from '@/components/views/desa-view'
import { SekolahView } from '@/components/views/sekolah-view'
import { AbsensiView } from '@/components/views/absensi-view'
import { PembagianView } from '@/components/views/pembagian-view'
import { PersuratanView } from '@/components/views/persuratan-view'
import { PenilaianView } from '@/components/views/penilaian-view'
import { AkunView } from '@/components/views/akun-view'
import { LaporanView } from '@/components/views/laporan-view'
import { PengaturanView } from '@/components/views/pengaturan-view'
import { AgendaView } from '@/components/views/agenda-view'
import { PengumumanView } from '@/components/views/pengumuman-view'
import { AktivitasView } from '@/components/views/aktivitas-view'
import { PendaftaranView } from '@/components/views/pendaftaran-view'
import { FormPendaftaranView } from '@/components/views/form-pendaftaran-view'
import { LinkPentingView } from '@/components/views/link-penting-view'

const VIEW_MAP: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  mahasiswa: MahasiswaView,
  dosen: DosenView,
  desa: DesaView,
  sekolah: SekolahView,
  absensi: AbsensiView,
  pembagian: PembagianView,
  persuratan: PersuratanView,
  penilaian: PenilaianView,
  akun: AkunView,
  laporan: LaporanView,
  pengaturan: PengaturanView,
  agenda: AgendaView,
  pengumuman: PengumumanView,
  aktivitas: AktivitasView,
  pendaftaran: PendaftaranView,
  formPendaftaran: FormPendaftaranView,
  linkPenting: LinkPentingView,
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentView = useAppStore((s) => s.currentView)
  const branding = useBranding()
  const ViewComponent = VIEW_MAP[currentView] || DashboardView

  // Idle auto-logout: 5 minutes of inactivity → logout + toast.
  useIdleTimer({
    timeoutMs: 5 * 60_000,
    warningMs: 60_000,
    onWarning: () => {
      toast.warning('Sesi Anda akan berakhir dalam 1 menit karena tidak ada aktivitas. Gerakkan mouse untuk memperpanjang.', {
        duration: 45_000,
      })
    },
    onTimeout: () => {
      useAppStore.getState().logout()
      toast.error('Sesi berakhir karena tidak ada aktivitas selama 5 menit. Silakan masuk kembali.', {
        duration: 8_000,
      })
    },
  })

  // Cross-tab session sync: if the user logs out (manually or via idle
  // timeout) in another tab, this tab follows suit.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'kknplp-store') return
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null
        const user = parsed?.state?.user
        if (!user) {
          // Another tab cleared the user — reflect it here too.
          useAppStore.getState().logout()
        }
      } catch {
        // Ignore malformed storage payloads.
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <ViewComponent />
        </main>
        <footer className="mt-auto border-t border-border bg-background py-4 px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© 2024 SIM KKN & PLP — {branding.namaKampus}. Hak cipta dilindungi.</p>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <span className="hidden sm:inline">•</span>
              <a href="#" className="hover:text-foreground transition-colors">Bantuan</a>
              <a href="#" className="hover:text-foreground transition-colors">Kebijakan Privasi</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
