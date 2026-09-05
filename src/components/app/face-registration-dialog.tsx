'use client'

/**
 * FaceRegistrationDialog
 *
 * Dialog used by admin/dosen to register (or re-register / delete) a mahasiswa's
 * face descriptor. Consumes the reusable <FaceCamera /> component and the
 * `/api/mahasiswa/[id]/face` endpoints.
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ScanFace, CheckCircle2, Trash2, Loader2, RotateCcw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FaceCamera, type FaceCaptureResult } from '@/components/app/face-camera'

export interface FaceRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mahasiswa: { id: string; nim: string; nama: string } | null
  /** Called after a successful registration / re-registration / deletion so the parent can refresh. */
  onRegistered?: () => void
}

type View = 'loading' | 'registered' | 'camera' | 'success'

export function FaceRegistrationDialog({
  open,
  onOpenChange,
  mahasiswa,
  onRegistered,
}: FaceRegistrationDialogProps) {
  const [view, setView] = useState<View>('loading')
  const [registeredAt, setRegisteredAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // ---------- Fetch registration status when dialog opens ----------
  useEffect(() => {
    if (!open || !mahasiswa) {
      setView('loading')
      setRegisteredAt(null)
      setCapturedPhoto(null)
      setSuccessMessage('')
      return
    }
    let cancelled = false
    setView('loading')
    setCapturedPhoto(null)
    setSuccessMessage('')

    ;(async () => {
      try {
        const res = await fetch(`/api/mahasiswa/${mahasiswa.id}/face`)
        if (!res.ok) throw new Error('Gagal memeriksa status wajah')
        const json = await res.json()
        if (cancelled) return
        if (json.registered) {
          setRegisteredAt(json.registeredAt ?? null)
          setView('registered')
        } else {
          setRegisteredAt(null)
          setView('camera')
        }
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Gagal memeriksa status wajah'
        toast.error(msg)
        // Allow manual retry by going to camera view
        setView('camera')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, mahasiswa])

  // ---------- Save captured face descriptor ----------
  const handleCapture = useCallback(
    async (result: FaceCaptureResult) => {
      if (!mahasiswa) return
      setSaving(true)
      try {
        const res = await fetch(`/api/mahasiswa/${mahasiswa.id}/face`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptor: result.descriptor }),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json?.error || 'Gagal mendaftarkan wajah')
        }
        setCapturedPhoto(result.dataUrl)
        setRegisteredAt(new Date().toISOString())
        setSuccessMessage(json?.message || `Wajah ${mahasiswa.nama} berhasil terdaftar`)
        setView('success')
        toast.success(json?.message || 'Wajah berhasil terdaftar')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal mendaftarkan wajah'
        toast.error(msg)
      } finally {
        setSaving(false)
      }
    },
    [mahasiswa]
  )

  // ---------- Delete existing face descriptor ----------
  const handleDelete = useCallback(async () => {
    if (!mahasiswa) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/mahasiswa/${mahasiswa.id}/face`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal menghapus data wajah')
      }
      toast.success(json?.message || 'Data wajah berhasil dihapus')
      setRegisteredAt(null)
      setView('camera')
      // Notify parent so the table can refresh (status becomes "Belum")
      onRegistered?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal menghapus data wajah'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }, [mahasiswa, onRegistered])

  // ---------- Done (from success view) ----------
  const handleDone = useCallback(() => {
    onRegistered?.()
    onOpenChange(false)
  }, [onOpenChange, onRegistered])

  const formattedRegisteredAt = registeredAt
    ? new Date(registeredAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-primary" />
            Registrasi Wajah
          </DialogTitle>
          <DialogDescription>
            Daftarkan wajah mahasiswa untuk verifikasi absensi berbasis pengenalan wajah.
          </DialogDescription>
        </DialogHeader>

        {mahasiswa && (
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
              {mahasiswa.nama.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{mahasiswa.nama}</p>
              <p className="text-xs text-muted-foreground font-mono">{mahasiswa.nim}</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 flex flex-col items-center justify-center gap-3"
            >
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Memeriksa status registrasi...</p>
            </motion.div>
          )}

          {view === 'registered' && (
            <motion.div
              key="registered"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-700 dark:text-emerald-300 text-sm">
                    Wajah sudah terdaftar
                  </p>
                  {formattedRegisteredAt && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Terdaftar sejak {formattedRegisteredAt}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setView('camera')}
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Daftar Ulang
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Hapus Data Wajah
                </Button>
              </div>
            </motion.div>
          )}

          {view === 'camera' && mahasiswa && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <FaceCamera
                onCapture={handleCapture}
                busy={saving}
                captureLabel="Daftarkan Wajah"
              />
            </motion.div>
          )}

          {view === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Registrasi Berhasil!
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    {successMessage}
                  </p>
                </div>
              </div>

              {capturedPhoto && (
                <div className="flex justify-center">
                  <div className="relative">
                    <img
                      src={capturedPhoto}
                      alt="Foto wajah terdaftar"
                      className="w-32 h-32 object-cover rounded-lg border-2 border-emerald-300 dark:border-emerald-700"
                    />
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-background">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button onClick={handleDone} className="w-full">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Selesai
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
