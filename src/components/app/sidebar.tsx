'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, GraduationCap, MapPin, School, QrCode,
  GitBranch, FileText, ClipboardCheck, UserCog, FileBarChart,
  Settings, CalendarDays, Megaphone, History, ChevronLeft,
  GraduationCap as Logo, Menu
} from 'lucide-react'
import { useAppStore, MENU_ACCESS, ROLE_LABELS, type ViewKey } from '@/lib/store'
import { useBranding } from '@/lib/branding'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const MENU_GROUPS: { title: string; items: { key: ViewKey; label: string; icon: any }[] }[] = [
  {
    title: 'Utama',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Data Master',
    items: [
      { key: 'mahasiswa', label: 'Data Mahasiswa', icon: Users },
      { key: 'dosen', label: 'Data Dosen', icon: GraduationCap },
      { key: 'desa', label: 'Desa KKN', icon: MapPin },
      { key: 'sekolah', label: 'Sekolah PLP', icon: School },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { key: 'absensi', label: 'Absensi', icon: QrCode },
      { key: 'pembagian', label: 'Pembagian KKN & PLP', icon: GitBranch },
      { key: 'persuratan', label: 'Persuratan', icon: FileText },
      { key: 'penilaian', label: 'Penilaian', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Informasi',
    items: [
      { key: 'agenda', label: 'Agenda', icon: CalendarDays },
      { key: 'pengumuman', label: 'Pengumuman', icon: Megaphone },
      { key: 'aktivitas', label: 'Log Aktivitas', icon: History },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { key: 'laporan', label: 'Laporan', icon: FileBarChart },
      { key: 'akun', label: 'Manajemen Akun', icon: UserCog },
      { key: 'pengaturan', label: 'Pengaturan', icon: Settings },
    ],
  },
]

export function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const { user, currentView, setView, sidebarCollapsed, toggleSidebar } = useAppStore()
  const branding = useBranding()
  if (!user) return null

  const allowed = MENU_ACCESS[user.role as keyof typeof MENU_ACCESS] || []

  const handleNav = (key: ViewKey) => {
    setView(key)
    setMobileOpen(false)
  }

  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen bg-gradient-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-[72px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border shrink-0">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`Logo ${branding.namaKampus}`}
              className="w-10 h-10 object-contain rounded-xl shrink-0 bg-white/80 dark:bg-white/10 p-0.5"
              onError={(e) => {
                // Fallback ke icon jika logo gagal load
                (e.currentTarget as HTMLImageElement).style.display = 'none'
                const fallback = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className={`w-10 h-10 bg-gradient-primary rounded-xl items-center justify-center text-white shrink-0 ${branding.logoUrl ? 'hidden' : 'flex'}`}
          >
            <Logo className="w-6 h-6" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm leading-tight truncate">SIM KKN & PLP</h1>
              <p className="text-[11px] text-muted-foreground truncate">{branding.namaKampus}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:flex hidden h-8 w-8"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
          </Button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
          {MENU_GROUPS.map((group) => {
            const items = group.items.filter(i => allowed.includes(i.key))
            if (items.length === 0) return null
            return (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 mb-1.5">
                    {group.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = currentView === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNav(item.key)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative group",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          sidebarCollapsed && "justify-center"
                        )}
                      >
                        <item.icon className={cn("w-[18px] h-[18px] shrink-0", !active && "text-muted-foreground group-hover:text-foreground")} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        {active && !sidebarCollapsed && (
                          <motion.div
                            layoutId="active-dot"
                            className="absolute right-2 w-1.5 h-1.5 bg-primary-foreground rounded-full"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-sidebar-border shrink-0">
          <div className={cn("flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50", sidebarCollapsed && "justify-center")}>
            <Avatar className="w-9 h-9 shrink-0 border-2 border-primary/20">
              {user.avatar ? <img src={user.avatar} alt={user.name} /> : <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>}
            </Avatar>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{user.name}</p>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 mt-0.5">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</Badge>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
