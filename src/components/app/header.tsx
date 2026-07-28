'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Menu, LogOut, User, Settings, ChevronRight } from 'lucide-react'
import { useAppStore, ROLE_LABELS, type ViewKey } from '@/lib/store'
import { useBranding } from '@/lib/branding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: 'Dashboard',
  mahasiswa: 'Data Mahasiswa',
  dosen: 'Data Dosen Pendamping',
  desa: 'Data Desa KKN',
  sekolah: 'Data Sekolah PLP',
  absensi: 'Absensi Mahasiswa',
  pembagian: 'Pembagian KKN & PLP',
  persuratan: 'Persuratan',
  penilaian: 'Penilaian Mahasiswa',
  akun: 'Manajemen Akun',
  laporan: 'Laporan',
  pengaturan: 'Pengaturan Aplikasi',
  agenda: 'Agenda Kegiatan',
  pengumuman: 'Pengumuman',
  aktivitas: 'Log Aktivitas',
  pendaftaran: 'Pendaftaran Peserta',
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, currentView, logout } = useAppStore()
  const branding = useBranding()
  const [search, setSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/pengumuman?limit=5')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotifications(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null
  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  const handleLogout = () => {
    logout()
    toast.success('Anda telah keluar dari sistem')
  }

  return (
    <header className="h-16 sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt="Logo"
            className="w-7 h-7 object-contain rounded-md shrink-0 bg-white/80 dark:bg-white/10 p-0.5"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : null}
        <span className="text-sm text-muted-foreground hidden sm:inline">{branding.namaKampus}</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:inline" />
        <h1 className="font-semibold text-base sm:text-lg truncate">{VIEW_TITLES[currentView]}</h1>
      </div>

      {/* Search */}
      <div className="ml-auto hidden md:flex items-center w-64 lg:w-80">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari mahasiswa, dosen, surat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <Button variant="ghost" size="icon" className="relative" onClick={() => setNotifOpen(!notifOpen)}>
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          )}
        </Button>
        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50"
            >
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-sm">Notifikasi</span>
                <Badge variant="secondary" className="text-[10px]">{notifications.length} baru</Badge>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Tidak ada notifikasi</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer">
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.prioritas === 'URGENT' ? 'bg-destructive' : n.prioritas === 'NORMAL' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{n.judul}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.konten}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {new Date(n.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2 hover:bg-accent">
            <Avatar className="w-8 h-8 border border-border">
              {user.avatar ? <img src={user.avatar} alt={user.name} /> : <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>}
            </Avatar>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold leading-tight max-w-[120px] truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="w-4 h-4 mr-2" /> Profil Saya
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => useAppStore.getState().setView('pengaturan')}>
            <Settings className="w-4 h-4 mr-2" /> Pengaturan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
