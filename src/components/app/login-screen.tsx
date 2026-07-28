'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Users, MapPin, BookOpen } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useBranding } from '@/lib/branding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/app/theme-toggle'

const DEMO_ACCOUNTS = [
  { username: 'superadmin', label: 'Super Admin' },
  { username: 'admin.fkip', label: 'Admin Fakultas' },
  { username: 'admin.prodi', label: 'Admin Prodi' },
  { username: 'pimpinan', label: 'Pimpinan' },
  { username: 'suparman', label: 'Dosen' },
  { username: 'mhs1', label: 'Mahasiswa' },
]

export function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser)
  const branding = useBranding()
  const [username, setUsername] = useState('superadmin')
  const [password, setPassword] = useState('password123')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaAns, setCaptchaAns] = useState('')
  const [captcha, setCaptcha] = useState({ a: 0, b: 0 })

  useEffect(() => {
    setCaptcha({ a: Math.floor(Math.random() * 9) + 1, b: Math.floor(Math.random() * 9) + 1 })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (parseInt(captchaAns) !== captcha.a + captcha.b) {
      toast.error('Jawaban captcha salah')
      setCaptchaAns('')
      setCaptcha({ a: Math.floor(Math.random() * 9) + 1, b: Math.floor(Math.random() * 9) + 1 })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login gagal')
      setUser(data)
      toast.success(`Selamat datang, ${data.name}!`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (un: string) => {
    setUsername(un)
    setPassword('password123')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="w-12 h-12 object-contain rounded-xl bg-white/90 p-1"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <GraduationCap className="w-7 h-7" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">SIM KKN & PLP</h1>
              <p className="text-xs text-white/80">{branding.namaKampus}</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-4xl font-bold leading-tight">
              Sistem Informasi<br />Manajemen KKN & PLP
            </h2>
            <p className="text-white/80 text-lg max-w-md">
              Platform terintegrasi untuk pengelolaan Kuliah Kerja Nyata dan Praktik Lapangan Persekolahan secara digital, modern, dan efisien.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-md pt-4">
              {[
                { icon: Users, label: '120+ Mahasiswa' },
                { icon: MapPin, label: '14 Lokasi' },
                { icon: BookOpen, label: '5 Fakultas' },
                { icon: ShieldCheck, label: '6 Level Akses' },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-lg px-3 py-2"
                >
                  <f.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{f.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <p className="text-white/60 text-sm">© 2024 {branding.namaKampus}. All rights reserved.</p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="w-12 h-12 object-contain rounded-xl bg-muted p-1"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
                <GraduationCap className="w-7 h-7" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">SIM KKN & PLP</h1>
              <p className="text-xs text-muted-foreground">{branding.namaKampus}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold">Selamat Datang 👋</h2>
            <p className="text-muted-foreground mt-1">Silakan masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. superadmin, admin.fkip, suparman"
                  className="pl-9"
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Masukkan username (bukan email) yang dibuat oleh Super Admin.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs text-primary hover:underline">
                  Lupa password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="captcha">Verifikasi Keamanan</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-input font-mono text-sm">
                  {captcha.a} + {captcha.b} = ?
                </div>
                <Input
                  id="captcha"
                  type="number"
                  value={captchaAns}
                  onChange={(e) => setCaptchaAns(e.target.value)}
                  placeholder="Jawaban"
                  className="flex-1"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Masuk <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground mb-3 text-center">Akun Demo (klik untuk isi otomatis)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => quickLogin(acc.username)}
                  className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors text-left"
                >
                  <span className="font-medium">{acc.label}</span>
                  <span className="block text-[10px] text-muted-foreground font-mono">{acc.username}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/70 text-center mt-3">
              Password semua akun: <span className="font-mono font-semibold">password123</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
