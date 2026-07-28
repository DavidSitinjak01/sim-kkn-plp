'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'SUPER_ADMIN' | 'ADMIN_FAKULTAS' | 'ADMIN_PRODI' | 'DOSEN' | 'MAHASISWA' | 'PIMPINAN'

export interface AuthUser {
  id: string
  username: string
  email?: string | null
  name: string
  role: Role
  avatar?: string | null
  phone?: string | null
}

export type ViewKey =
  | 'dashboard'
  | 'mahasiswa'
  | 'dosen'
  | 'desa'
  | 'sekolah'
  | 'absensi'
  | 'pembagian'
  | 'persuratan'
  | 'penilaian'
  | 'akun'
  | 'laporan'
  | 'pengaturan'
  | 'agenda'
  | 'pengumuman'
  | 'aktivitas'
  | 'pendaftaran'
  | 'formPendaftaran'

interface AppState {
  user: AuthUser | null
  currentView: ViewKey
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  setUser: (user: AuthUser | null) => void
  logout: () => void
  setView: (view: ViewKey) => void
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      currentView: 'dashboard',
      theme: 'light',
      sidebarCollapsed: false,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, currentView: 'dashboard' }),
      setView: (view) => set({ currentView: view }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'kknplp-store',
      version: 2,
      partialize: (s) => ({ user: s.user, currentView: s.currentView, theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
      // v1 -> v2: AuthUser changed from `email` (required) to `username` (required).
      // Old persisted sessions have no `username`, so force logout to require fresh login
      // with the new username-based credential.
      migrate: (persisted: any, version: number) => {
        if (version < 2 && persisted?.user) {
          // Old shape: user.email existed, user.username did not. Clear session.
          persisted.user = null
          persisted.currentView = 'dashboard'
        }
        return persisted
      },
    }
  )
)

// Role-based menu access
export const MENU_ACCESS: Record<Role, ViewKey[]> = {
  SUPER_ADMIN: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'akun', 'laporan', 'pengaturan', 'agenda', 'pengumuman', 'aktivitas', 'pendaftaran', 'formPendaftaran'],
  ADMIN_FAKULTAS: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'laporan', 'agenda', 'pengumuman', 'pendaftaran', 'formPendaftaran'],
  ADMIN_PRODI: ['dashboard', 'mahasiswa', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'laporan', 'agenda', 'pengumuman', 'pendaftaran', 'formPendaftaran'],
  DOSEN: ['dashboard', 'mahasiswa', 'absensi', 'pembagian', 'penilaian', 'agenda', 'pengumuman'],
  MAHASISWA: ['dashboard', 'absensi', 'agenda', 'pengumuman'],
  PIMPINAN: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'laporan', 'pengumuman', 'agenda', 'pendaftaran', 'formPendaftaran'],
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_FAKULTAS: 'Admin Fakultas',
  ADMIN_PRODI: 'Admin Prodi',
  DOSEN: 'Dosen Pendamping',
  MAHASISWA: 'Mahasiswa',
  PIMPINAN: 'Pimpinan',
}
