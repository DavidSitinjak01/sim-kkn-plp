'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'SUPER_ADMIN' | 'ADMIN_FAKULTAS' | 'ADMIN_PRODI' | 'DOSEN' | 'MAHASISWA' | 'PIMPINAN'

export interface AuthUser {
  id: string
  email: string
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
      partialize: (s) => ({ user: s.user, currentView: s.currentView, theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
)

// Role-based menu access
export const MENU_ACCESS: Record<Role, ViewKey[]> = {
  SUPER_ADMIN: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'akun', 'laporan', 'pengaturan', 'agenda', 'pengumuman', 'aktivitas', 'pendaftaran'],
  ADMIN_FAKULTAS: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'laporan', 'agenda', 'pengumuman', 'pendaftaran'],
  ADMIN_PRODI: ['dashboard', 'mahasiswa', 'absensi', 'pembagian', 'persuratan', 'penilaian', 'laporan', 'agenda', 'pengumuman', 'pendaftaran'],
  DOSEN: ['dashboard', 'mahasiswa', 'absensi', 'pembagian', 'penilaian', 'agenda', 'pengumuman'],
  MAHASISWA: ['dashboard', 'absensi', 'agenda', 'pengumuman'],
  PIMPINAN: ['dashboard', 'mahasiswa', 'dosen', 'desa', 'sekolah', 'absensi', 'pembagian', 'laporan', 'pengumuman', 'agenda', 'pendaftaran'],
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_FAKULTAS: 'Admin Fakultas',
  ADMIN_PRODI: 'Admin Prodi',
  DOSEN: 'Dosen Pendamping',
  MAHASISWA: 'Mahasiswa',
  PIMPINAN: 'Pimpinan',
}
