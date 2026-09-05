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
  | 'linkPenting'
  | 'idCard'

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
      version: 3,
      // Only persist auth + theme + sidebar state. `currentView` is
      // intentionally NOT persisted so that a browser refresh always
      // returns the user to the dashboard (initial state = 'dashboard'),
      // regardless of which view was open before the refresh.
      partialize: (s) => ({ user: s.user, theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
      // v1 -> v2: AuthUser changed from `email` (required) to `username` (required).
      // Old persisted sessions have no `username`, so force logout to require fresh login
      // with the new username-based credential.
      // v2 -> v3: `currentView` is no longer persisted. Clear any stale value
      // from older sessions so the dashboard is always shown after refresh.
      migrate: (persisted: any, version: number) => {
        if (version < 2 && persisted?.user) {
          // Old shape: user.email existed, user.username did not. Clear session.
          persisted.user = null
        }
        if (version < 3 && persisted) {
          // Drop the persisted view so the app falls back to the default
          // 'dashboard' on the next hydration.
          delete persisted.currentView
        }
        return persisted
      },
    }
  )
)

// Role-based menu access
export const MENU_ACCESS: Record<Role, ViewKey[]> = {
  SUPER_ADMIN: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'akun', 'laporan', 'pengaturan', 'agenda', 'pengumuman', 'aktivitas', 'pendaftaran', 'formPendaftaran', 'linkPenting', 'idCard'],
  ADMIN_FAKULTAS: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'laporan', 'agenda', 'pengumuman', 'pendaftaran', 'formPendaftaran', 'linkPenting', 'idCard'],
  ADMIN_PRODI: ['dashboard', 'mahasiswa', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'laporan', 'agenda', 'pengumuman', 'pendaftaran', 'formPendaftaran', 'linkPenting', 'idCard'],
  DOSEN: ['dashboard', 'mahasiswa', 'absensi', 'pembagian', 'penilaian', 'agenda', 'pengumuman', 'linkPenting'],
  MAHASISWA: ['dashboard', 'absensi', 'agenda', 'pengumuman', 'linkPenting'],
  PIMPINAN: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'laporan', 'pengumuman', 'agenda', 'pendaftaran', 'formPendaftaran', 'linkPenting', 'idCard'],
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_FAKULTAS: 'Admin Fakultas',
  ADMIN_PRODI: 'Admin Prodi',
  DOSEN: 'Dosen Pendamping',
  MAHASISWA: 'Mahasiswa',
  PIMPINAN: 'Pimpinan',
}
