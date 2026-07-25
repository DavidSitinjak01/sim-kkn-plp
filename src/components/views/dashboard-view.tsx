'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, GraduationCap, MapPin, School, GitBranch, FileText, QrCode, Megaphone,
  CalendarDays, TrendingUp, Activity, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

const COLORS = ['oklch(0.55 0.2 255)', 'oklch(0.65 0.16 180)', 'oklch(0.7 0.18 145)', 'oklch(0.75 0.18 70)', 'oklch(0.6 0.22 300)']

const STAT_CARDS = [
  { key: 'mahasiswa', label: 'Total Mahasiswa', icon: Users, color: 'from-blue-500 to-blue-600', trend: '+12%' },
  { key: 'dosen', label: 'Dosen Pendamping', icon: GraduationCap, color: 'from-emerald-500 to-emerald-600', trend: '+5%' },
  { key: 'desa', label: 'Desa KKN', icon: MapPin, color: 'from-amber-500 to-orange-600', trend: '+2' },
  { key: 'sekolah', label: 'Sekolah PLP', icon: School, color: 'from-purple-500 to-purple-600', trend: '+1' },
  { key: 'kelompok', label: 'Kelompok Aktif', icon: GitBranch, color: 'from-cyan-500 to-cyan-600', trend: '+3' },
  { key: 'surat', label: 'Total Surat', icon: FileText, color: 'from-rose-500 to-rose-600', trend: '+8' },
  { key: 'absensiToday', label: 'Absensi Hari Ini', icon: QrCode, color: 'from-indigo-500 to-indigo-600', trend: 'Live' },
  { key: 'pengumuman', label: 'Pengumuman', icon: Megaphone, color: 'from-pink-500 to-pink-600', trend: '+2' },
]

export function DashboardView() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  const { stats, charts, recentPengumuman, upcomingAgenda, recentAktivitas } = data

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-primary rounded-2xl p-6 text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 right-20 w-40 h-40 bg-white/10 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold">Selamat Datang di Dashboard KKN & PLP</h2>
          <p className="text-white/80 mt-1">
            Tahun Akademik 2024/2025 — Semester Ganjil. Pantau seluruh kegiatan KKN dan PLP dalam satu layar.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur rounded-lg px-4 py-2">
              <p className="text-xs text-white/70">Total Peserta</p>
              <p className="text-lg font-bold">{stats.mahasiswa} Mahasiswa</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-lg px-4 py-2">
              <p className="text-xs text-white/70">Lokasi Aktif</p>
              <p className="text-lg font-bold">{stats.desa + stats.sekolah} Titik</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-lg px-4 py-2">
              <p className="text-xs text-white/70">Kelompok</p>
              <p className="text-lg font-bold">{stats.kelompok} Kelompok</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map((card, i) => {
          const value = (stats as any)[card.key]
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="card-hover overflow-hidden relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                      <p className="text-2xl font-bold mt-1">{value ?? 0}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {card.trend !== 'Live' ? (
                          <>
                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                            <span className="text-xs text-emerald-500 font-medium">{card.trend}</span>
                          </>
                        ) : (
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">bulan ini</span>
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shrink-0`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Absensi trend - 7 days */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Tren Absensi 7 Hari Terakhir</CardTitle>
                <CardDescription className="text-xs">Rekap kehadiran mahasiswa</CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1"><Activity className="w-3 h-3" /> Real-time</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={charts.absensiTrend}>
                <defs>
                  <linearGradient id="gHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.2 255)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.55 0.2 255)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gIzin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.75 0.18 70)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.75 0.18 70)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Hadir" stroke="oklch(0.55 0.2 255)" fill="url(#gHadir)" strokeWidth={2} />
                <Area type="monotone" dataKey="Izin" stroke="oklch(0.75 0.18 70)" fill="url(#gIzin)" strokeWidth={2} />
                <Area type="monotone" dataKey="Sakit" stroke="oklch(0.7 0.18 145)" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="Alpha" stroke="oklch(0.58 0.22 27)" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribusi KKN/PLP */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribusi Peserta</CardTitle>
            <CardDescription className="text-xs">KNN vs PLP 1 vs PLP 2</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={charts.distribusi}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={(entry: any) => entry.name}
                >
                  {charts.distribusi.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {charts.distribusi.map((d: any, i: number) => (
                <div key={i} className="text-center">
                  <p className="text-xs text-muted-foreground">{d.name}</p>
                  <p className="font-bold text-sm">{d.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Peserta per prodi */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Peserta per Program Studi</CardTitle>
            <CardDescription className="text-xs">Top 8 prodi berdasarkan jumlah mahasiswa</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.pesertaPerProdi} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" className="text-xs" tick={{ fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'oklch(0.55 0.2 255 / 0.05)' }} />
                <Bar dataKey="value" fill="oklch(0.55 0.2 255)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Mahasiswa per angkatan + Kelompok by tipe */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mahasiswa per Angkatan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={charts.mhsPerAngkatan}>
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'oklch(0.55 0.2 255 / 0.05)' }} />
                  <Bar dataKey="value" fill="oklch(0.65 0.16 180)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Kelompok per Tipe</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={charts.kelompokByTipe}>
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'oklch(0.55 0.2 255 / 0.05)' }} />
                  <Bar dataKey="value" fill="oklch(0.6 0.22 300)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: Agenda + Pengumuman + Aktivitas */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Agenda */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" /> Agenda Mendatang</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[260px] pr-3">
              <div className="space-y-3">
                {upcomingAgenda.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Tidak ada agenda</p>
                ) : upcomingAgenda.map((a: any) => {
                  const days = Math.ceil((new Date(a.tanggal).getTime() - Date.now()) / 86400000)
                  return (
                    <div key={a.id} className="flex gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary/10 rounded-lg shrink-0">
                        <span className="text-xs text-primary font-bold">{new Date(a.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
                        <span className="text-lg font-bold text-primary leading-none">{new Date(a.tanggal).getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{a.judul}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {a.lokasi || '-'}
                        </p>
                        <Badge variant="outline" className="text-[10px] mt-1">{a.tipe}</Badge>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{days}h lagi</Badge>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pengumuman */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Pengumuman Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[260px] pr-3">
              <div className="space-y-3">
                {recentPengumuman.map((p: any) => (
                  <div key={p.id} className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={p.prioritas === 'URGENT' ? 'destructive' : 'secondary'}
                        className="text-[9px] h-4 px-1"
                      >
                        {p.prioritas}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{p.judul}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.konten}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Aktivitas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Aktivitas Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[260px] pr-3">
              <div className="space-y-1">
                {recentAktivitas.map((a: any, i: number) => (
                  <div key={a.id} className="flex gap-3 relative">
                    {i < recentAktivitas.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      a.aksi === 'LOGIN' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      a.aksi === 'CREATE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      a.aksi === 'UPDATE' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{a.user?.name || 'Sistem'}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{a.detail}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {new Date(a.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
