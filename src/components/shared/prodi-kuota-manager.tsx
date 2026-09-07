'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, Save, RotateCcw, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_MAX_PER_PRODI } from '@/lib/prodi-kuota'

interface ProdiKuotaStatus {
  prodiId: string
  prodiNama: string
  prodiKode: string
  jenjang: string
  current: number
  max: number
  overridden: boolean
  exceeded: boolean
}

interface ProdiKuotaManagerProps {
  /** 'sekolah' | 'desa' */
  lokasiType: 'sekolah' | 'desa'
  /** ID sekolah/desa */
  lokasiId: string
  /** Nama lokasi (sekolah/desa) untuk header */
  lokasiNama: string;
  /** Callback setelah simpan berhasil */
  onSaved?: () => void
}

/**
 * Komponen UI untuk mengelola batas maksimal mahasiswa per prodi per lokasi.
 * Digunakan bersama oleh sekolah-view dan desa-view.
 *
 * Default batas = DEFAULT_MAX_PER_PRODI (3) kalau tidak ada override.
 * Admin bisa atur batas per-prodi, simpan, reset ke default.
 */
export function ProdiKuotaManager({ lokasiType, lokasiId, lokasiNama, onSaved }: ProdiKuotaManagerProps) {
  const [list, setList] = useState<ProdiKuotaStatus[]>([])
  const [editMap, setEditMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchStatus = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/${lokasiType}/${lokasiId}/prodi-kuota`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Gagal memuat status kuota prodi')
      const json = await res.json()
      setList(json)
      // Reset editMap ke nilai current max
      const initMap: Record<string, string> = {}
      for (const s of json as ProdiKuotaStatus[]) {
        initMap[s.prodiId] = String(s.max)
      }
      setEditMap(initMap)
    } catch {
      toast.error('Gagal memuat status kuota prodi')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [lokasiType, lokasiId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSave = async () => {
    setSaving(true)
    try {
      const items = Object.entries(editMap).map(([prodiId, val]) => ({
        prodiId,
        maxKuota: Number(val),
      }))
      // Validasi
      for (const it of items) {
        if (!Number.isInteger(it.maxKuota) || it.maxKuota < 0) {
          toast.error('Semua batas harus angka >= 0 (0 = unlimited)')
          setSaving(false)
          return
        }
      }
      const res = await fetch(`/api/${lokasiType}/${lokasiId}/prodi-kuota`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan')
      toast.success('Batas prodi berhasil disimpan')
      setList(json.status)
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const resetMap: Record<string, string> = {}
    for (const s of list) {
      resetMap[s.prodiId] = String(DEFAULT_MAX_PER_PRODI)
    }
    setEditMap(resetMap)
    toast.info(`Semua batas di-reset ke ${DEFAULT_MAX_PER_PRODI} (default). Klik Simpan untuk menyimpan.`)
  }

  const exceededCount = list.filter((s) => s.exceeded).length

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="flex items-start gap-2">
        <Users2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Batas Mahasiswa per Prodi</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Maksimal mahasiswa dari prodi yang sama di {lokasiType === 'sekolah' ? 'sekolah' : 'desa'} <span className="font-medium">{lokasiNama}</span>. Default: {DEFAULT_MAX_PER_PRODI} per prodi. 0 = unlimited.
          </p>
        </div>
      </div>

      {exceededCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{exceededCount} prodi melebihi batas</p>
            <p className="mt-0.5">Mahasiswa yang sudah terdaftar tetap ada — silakan pindahkan manual lewat menu Pembagian.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar prodi...
        </div>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Tidak ada prodi terdaftar.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-md border">
          <div className="divide-y">
            {list.map((s) => {
              const val = editMap[s.prodiId] ?? String(s.max)
              const isExceeded = s.exceeded
              return (
                <div key={s.prodiId} className="flex items-center gap-3 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate">{s.prodiNama}</span>
                      {s.overridden && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">custom</Badge>
                      )}
                      {isExceeded && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1">
                          {s.current}/{s.max} ⚠
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{s.prodiKode}</span>
                      <span>·</span>
                      <span>{s.jenjang}</span>
                      <span>·</span>
                      <span>terdaftar: <span className={isExceeded ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>{s.current}</span> / {s.max}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Label htmlFor={`max-${s.prodiId}`} className="text-[10px] text-muted-foreground">Max</Label>
                    <Input
                      id={`max-${s.prodiId}`}
                      type="number"
                      min={0}
                      max={50}
                      value={val}
                      onChange={(e) => setEditMap((m) => ({ ...m, [s.prodiId]: e.target.value }))}
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || loading || list.length === 0}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Batas
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={saving || loading || list.length === 0}>
          <RotateCcw className="w-3.5 h-3.5" /> Reset ke Default
        </Button>
      </div>
    </div>
  )
}
