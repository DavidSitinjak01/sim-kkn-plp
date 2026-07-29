'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Upload,
  RotateCcw,
  Check,
  Loader2,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface PhotoEditorDialogProps {
  /** Controlled open state */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing foto (URL or data URL) — optional starting point. Reloaded every time the dialog opens. */
  initialFoto?: string | null
  /** Shown in dialog header for context */
  studentName?: string
  /** Called with a 560x560 base64 PNG data URL when the user applies the photo */
  onSave: (base64DataUrl: string) => void | Promise<void>
}

// Canvas geometry: 280 CSS px (visible) × 560 internal px (2× DPI for crisp rendering & export)
const CANVAS_CSS = 280
const CANVAS_PX = 560

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

export function PhotoEditorDialog({
  open,
  onOpenChange,
  initialFoto,
  studentName,
  onSave,
}: PhotoEditorDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [rotate, setRotate] = useState(0)
  const [urlInput, setUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingSrc, setLoadingSrc] = useState(false)

  const draggingRef = useRef(false)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)
  const wasOpenRef = useRef(false)

  const resetTransform = useCallback(() => {
    setZoom(1)
    setTx(0)
    setTy(0)
    setRotate(0)
  }, [])

  /** Load an image from a src. Uses crossOrigin='anonymous' for http(s) URLs so the canvas
   *  stays exportable (server must send CORS headers). Data URLs never taint the canvas. */
  const loadImageFromSrc = useCallback(
    (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const image = new Image()
        if (!src.startsWith('data:')) {
          image.crossOrigin = 'anonymous'
        }
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Failed to load image'))
        image.src = src
      })
    },
    [],
  )

  // Lifecycle: when dialog opens, reset transform + (re)load initialFoto.
  // When dialog closes, clear image so reopening shows a fresh state.
  // Rationale: the parent always passes the student's current `initialFoto`, so reloading
  // on each open guarantees the editor reflects the latest saved photo and discards any
  // abandoned edits from a previous session.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetTransform()
      if (initialFoto) {
        setLoadingSrc(true)
        loadImageFromSrc(initialFoto)
          .then((loaded) => setImg(loaded))
          .catch(() => {
            setImg(null)
            toast.error('Gagal memuat foto awal')
          })
          .finally(() => setLoadingSrc(false))
      } else {
        setImg(null)
      }
    }
    if (!open && wasOpenRef.current) {
      setImg(null)
      resetTransform()
      setUrlInput('')
    }
    wasOpenRef.current = open
  }, [open])

  /** Render the current image + transform onto a target canvas (used for both
   *  the live preview and the export canvas). */
  const renderTo = useCallback(
    (target: HTMLCanvasElement, image: HTMLImageElement | null) => {
      const ctx = target.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, target.width, target.height)
      if (!image) return
      const iw = image.naturalWidth
      const ih = image.naturalHeight
      if (!iw || !ih) return

      ctx.save()
      // Center of canvas + pan (tx/ty in CSS px → ×2 for canvas px)
      ctx.translate(CANVAS_PX / 2 + tx * 2, CANVAS_PX / 2 + ty * 2)
      ctx.rotate((rotate * Math.PI) / 180)
      // zoom ×2 for DPI; baseScale ensures the image "covers" the 280×280 frame
      const baseScale = Math.max(CANVAS_CSS / iw, CANVAS_CSS / ih)
      ctx.scale(zoom * 2 * baseScale, zoom * 2 * baseScale)
      ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih)
      ctx.restore()
    },
    [zoom, tx, ty, rotate],
  )

  // Re-render preview whenever the image or transform changes
  useEffect(() => {
    if (canvasRef.current) {
      renderTo(canvasRef.current, img)
    }
  }, [renderTo, img])

  // ----- File upload -----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so the same file can be re-selected later
    e.target.value = ''
    if (!file) return

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error('Tipe file tidak didukung. Gunakan JPG, PNG, atau WebP.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Ukuran file melebihi 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setLoadingSrc(true)
      loadImageFromSrc(dataUrl)
        .then((loaded) => {
          setImg(loaded)
          resetTransform()
          toast.success('Foto berhasil dimuat')
        })
        .catch(() => toast.error('Gagal memuat file gambar'))
        .finally(() => setLoadingSrc(false))
    }
    reader.onerror = () => toast.error('Gagal membaca file')
    reader.readAsDataURL(file)
  }

  // ----- URL load -----
  const handleLoadUrl = () => {
    const url = urlInput.trim()
    if (!url) {
      toast.error('Masukkan URL gambar terlebih dahulu')
      return
    }
    setLoadingSrc(true)
    loadImageFromSrc(url)
      .then((loaded) => {
        setImg(loaded)
        resetTransform()
        toast.success('Foto berhasil dimuat dari URL')
      })
      .catch(() => toast.error('Gagal memuat gambar dari URL'))
      .finally(() => setLoadingSrc(false))
  }

  // ----- Pointer drag for panning -----
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img) return
    draggingRef.current = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || !lastPointerRef.current) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    // Clamp pan to ±canvas size so the image can't drift too far off-frame
    setTx((v) => Math.max(-CANVAS_CSS, Math.min(CANVAS_CSS, v + dx)))
    setTy((v) => Math.max(-CANVAS_CSS, Math.min(CANVAS_CSS, v + dy)))
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false
    lastPointerRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  // ----- Apply / Save -----
  const handleApply = async () => {
    if (!img) return
    setSaving(true)
    try {
      const temp = document.createElement('canvas')
      temp.width = CANVAS_PX
      temp.height = CANVAS_PX
      renderTo(temp, img)
      const dataUrl = temp.toDataURL('image/png')
      await onSave(dataUrl)
      onOpenChange(false)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      const msg = err instanceof Error ? err.message : ''
      if (name === 'SecurityError' || /taint|security|cors/i.test(msg)) {
        toast.error(
          'Gambar dari URL tidak bisa diekspor (CORS). Silakan unggah file lokal.',
        )
      } else {
        toast.error('Gagal menerapkan foto. Silakan coba lagi.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atur Foto Mahasiswa</DialogTitle>
          {studentName ? (
            <DialogDescription>
              Sesuaikan posisi wajah{' '}
              <span className="font-medium text-foreground">{studentName}</span>{' '}
              agar pas di lingkaran ID Card.
            </DialogDescription>
          ) : (
            <DialogDescription>
              Sesuaikan posisi wajah agar pas di lingkaran ID Card.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
          {/* ----- Left: circular preview ----- */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative"
              style={{ width: CANVAS_CSS, height: CANVAS_CSS }}
            >
              {/* Circular frame with primary ring (simulates ID Card photo frame) */}
              <div className="absolute inset-0 overflow-hidden rounded-full border-4 border-primary bg-muted">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_PX}
                  height={CANVAS_PX}
                  className="block touch-none select-none cursor-grab active:cursor-grabbing"
                  style={{ width: CANVAS_CSS, height: CANVAS_CSS }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
                {/* Face-target dashed overlay (visual guide only) */}
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-primary-foreground/40"
                  style={{ width: CANVAS_CSS * 0.55, height: CANVAS_CSS * 0.55 }}
                />
                {/* Loading overlay */}
                {loadingSrc && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
                {/* Empty-state hint */}
                {!img && !loadingSrc && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
                    <AlertCircle className="size-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Belum ada foto</p>
                  </div>
                )}
              </div>
            </div>
            {img && (
              <p className="text-center text-xs text-muted-foreground">
                Seret gambar pada preview untuk menggeser posisi wajah
              </p>
            )}
          </div>

          {/* ----- Right: controls ----- */}
          <div className="flex flex-col gap-4">
            {!img ? (
              <>
                {/* Upload dropzone */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 p-6 text-center transition hover:border-primary hover:bg-accent"
                >
                  <Upload className="size-6 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Klik untuk memilih foto</p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, atau WebP — maksimal 5MB
                    </p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">atau</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* URL input */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="photo-url">Muat dari URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="photo-url"
                      placeholder="https://..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLoadUrl()
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleLoadUrl}
                      disabled={loadingSrc}
                    >
                      {loadingSrc ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LinkIcon />
                      )}
                      Muat
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Catatan: gambar dari URL tanpa CORS tidak dapat diekspor. Lebih
                    disarankan unggah file lokal.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Zoom slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Zoom</Label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {zoom.toFixed(2)}×
                    </span>
                  </div>
                  <Slider
                    value={[zoom]}
                    min={1}
                    max={3}
                    step={0.05}
                    onValueChange={(v) => setZoom(v[0])}
                  />
                </div>

                {/* Rotate slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Rotasi</Label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {rotate > 0 ? `+${rotate}°` : `${rotate}°`}
                    </span>
                  </div>
                  <Slider
                    value={[rotate]}
                    min={-45}
                    max={45}
                    step={1}
                    onValueChange={(v) => setRotate(v[0])}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Seret gambar pada preview untuk menggeser posisi wajah
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetTransform}
                  >
                    <RotateCcw />
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload />
                    Ganti Foto
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!img || saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check />
            )}
            Terapkan Foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
