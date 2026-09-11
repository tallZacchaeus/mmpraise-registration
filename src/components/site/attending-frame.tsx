'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Download, ImagePlus, Loader2, RotateCcw, Share2 } from 'lucide-react'
import { Alert, Button } from '@/components/ui/primitives'

/**
 * The "I will be attending" frame.
 *
 * A volunteer picks a photograph, positions it, and downloads a square-ish
 * card to post. Everything happens in the browser: the photograph is read from
 * disk into a canvas and never uploaded, so there is no storage to secure, no
 * moderation queue to staff, and nothing to delete afterwards. That is worth
 * stating on the page, because people are reasonably wary of handing a photo
 * of themselves to a website.
 *
 * The artwork is a PNG whose photo window is genuinely transparent, so the
 * composition is: clip to the window, draw the photograph, then paint the
 * frame over the top. The numbers below are measured from the file rather than
 * eyeballed — if the artwork is ever replaced, re-measure the transparent
 * rectangle and change them here.
 */
const FRAME_SRC = '/landing/ugc/frame.png'
const FRAME_W = 2000
const FRAME_H = 2500

/** The transparent window in the artwork, in frame pixels. */
const SLOT = { x: 345, y: 874, w: 1310, h: 993 }

const MIN_ZOOM = 1
const MAX_ZOOM = 3
/** One arrow-key press, in frame pixels. */
const NUDGE = 24

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type Status = { tone: 'info' | 'danger'; message: string } | null

export function AttendingFrame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLImageElement | null>(null)
  const photoRef = useRef<ImageBitmap | HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)

  const [frameReady, setFrameReady] = useState(false)
  const [hasPhoto, setHasPhoto] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const fileId = useId()
  const zoomId = useId()

  /*
   * Web Share with files is the mobile path that matters — a downloaded file on
   * a phone is several taps from the app the volunteer wants to post it in.
   *
   * Read through `useSyncExternalStore` rather than an effect: the server has
   * no `navigator`, so the value has to start false and become true on the
   * client without a hydration mismatch, and without the cascading render an
   * effect-plus-setState would cause.
   */
  const canShare = useSyncExternalStore(subscribeNever, hasShareSupport, () => false)

  useEffect(() => {
    const image = new window.Image()
    image.src = FRAME_SRC
    image.decoding = 'async'
    image.onload = () => {
      frameRef.current = image
      setFrameReady(true)
    }
    image.onerror = () =>
      setStatus({ tone: 'danger', message: 'The frame artwork could not be loaded. Please refresh the page.' })
  }, [])

  /**
   * How far the photograph may travel before an edge would show.
   *
   * Zero on an axis where the photograph only just covers the window — a 4:3
   * photo in this 4:3 window has a few pixels of slack and no more.
   */
  const panBounds = useCallback(() => {
    const photo = photoRef.current
    if (!photo) return { maxX: 0, maxY: 0 }
    const scale = Math.max(SLOT.w / photo.width, SLOT.h / photo.height) * zoom
    return {
      maxX: Math.max(0, (photo.width * scale - SLOT.w) / 2),
      maxY: Math.max(0, (photo.height * scale - SLOT.h) / 2),
    }
  }, [zoom])

  /**
   * Move the photograph, clamping as it is stored rather than only as it is
   * drawn.
   *
   * Clamping at draw time alone let the stored offset run away: holding an
   * arrow key against the edge banked hundreds of pixels of movement that had
   * to be unwound before the picture moved back the other way, so the control
   * felt stuck.
   */
  const pan = useCallback(
    (dx: number, dy: number) => {
      const { maxX, maxY } = panBounds()
      setOffset((current) => ({
        x: clamp(current.x + dx, -maxX, maxX),
        y: clamp(current.y + dy, -maxY, maxY),
      }))
    },
    [panBounds],
  )

  /** Draw the whole card: photograph inside the window, artwork over the top. */
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, FRAME_W, FRAME_H)

    /*
     * Paint white underneath everything. The export is a JPEG, which has no
     * alpha, so any transparent pixel — an anti-aliased edge in the artwork,
     * or the photo window before a photo is chosen — would otherwise come out
     * black rather than simply unfilled.
     */
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, FRAME_W, FRAME_H)

    const photo = photoRef.current
    if (photo) {
      const photoW = photo.width
      const photoH = photo.height

      // Cover the window at zoom 1, so there is never a gap to see through.
      const scale = Math.max(SLOT.w / photoW, SLOT.h / photoH) * zoom
      const drawW = photoW * scale
      const drawH = photoH * scale

      // Clamp panning to the overhang, so dragging can never expose an edge.
      const maxX = Math.max(0, (drawW - SLOT.w) / 2)
      const maxY = Math.max(0, (drawH - SLOT.h) / 2)

      const x = SLOT.x + (SLOT.w - drawW) / 2 + clamp(offset.x, -maxX, maxX)
      const y = SLOT.y + (SLOT.h - drawH) / 2 + clamp(offset.y, -maxY, maxY)

      context.save()
      context.beginPath()
      context.rect(SLOT.x, SLOT.y, SLOT.w, SLOT.h)
      context.clip()
      context.drawImage(photo, x, y, drawW, drawH)
      context.restore()
    }

    context.drawImage(frame, 0, 0, FRAME_W, FRAME_H)
  }, [zoom, offset])

  useEffect(() => {
    render()
  }, [render, frameReady])

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setStatus({ tone: 'danger', message: 'That file is not an image. Choose a JPEG, PNG or HEIC photo.' })
      return
    }

    setBusy(true)
    setStatus(null)
    try {
      /*
       * `createImageBitmap` with `imageOrientation` applies the EXIF rotation
       * that phone cameras record, which is the difference between a portrait
       * photograph appearing upright and appearing on its side.
       */
      photoRef.current = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        photoRef.current = await loadViaObjectUrl(file)
      } catch {
        setStatus({ tone: 'danger', message: 'That photo could not be opened. Try a different one.' })
        setBusy(false)
        return
      }
    }

    setHasPhoto(true)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setBusy(false)
    setStatus({ tone: 'info', message: 'Photo added. Drag it to reposition, or use the zoom slider.' })
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasPhoto) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    // The canvas is displayed smaller than it is drawn, so a pixel of finger
    // movement is more than a pixel of image movement.
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = FRAME_W / rect.width

    const dx = (event.clientX - drag.startX) * ratio
    const dy = (event.clientY - drag.startY) * ratio
    dragRef.current = { ...drag, startX: event.clientX, startY: event.clientY }
    pan(dx, dy)
  }

  function endDrag(event: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!hasPhoto) return
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -NUDGE],
      ArrowDown: [0, NUDGE],
      ArrowLeft: [-NUDGE, 0],
      ArrowRight: [NUDGE, 0],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    pan(move[0], move[1])
  }

  function reset() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setStatus({ tone: 'info', message: 'Position reset.' })
  }

  /*
   * JPEG, not PNG. The same card is 4.6MB as a PNG and under 1MB as a quality
   * 0.92 JPEG, and it is a photograph heading for WhatsApp or Instagram, both
   * of which re-encode on upload anyway. The PNG also sat close enough to the
   * 5MB limit some share targets enforce to be a real risk on a big photo.
   */
  async function toBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current
    if (!canvas) return null
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92))
  }

  async function download() {
    setBusy(true)
    const blob = await toBlob()
    setBusy(false)
    if (!blob) {
      setStatus({ tone: 'danger', message: 'The image could not be created. Please try again.' })
      return
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'i-will-be-attending-85-hours-mmp.jpg'
    document.body.append(link)
    link.click()
    link.remove()
    // Revoke on the next tick: revoking immediately can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setStatus({ tone: 'info', message: 'Saved to your downloads.' })
  }

  async function share() {
    setBusy(true)
    const blob = await toBlob()
    setBusy(false)
    if (!blob) return

    const file = new File([blob], 'i-will-be-attending-85-hours-mmp.jpg', { type: 'image/jpeg' })
    if (!navigator.canShare?.({ files: [file] })) {
      setStatus({ tone: 'info', message: 'Sharing is not available here — use Download instead.' })
      return
    }

    try {
      await navigator.share({ files: [file], title: 'I will be attending 85 Hours MMP' })
    } catch {
      // A cancelled share is not an error worth reporting.
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        {/*
          `touch-action: none` so a drag pans the photograph instead of
          scrolling the page under the finger.
        */}
        <canvas
          ref={canvasRef}
          width={FRAME_W}
          height={FRAME_H}
          tabIndex={hasPhoto ? 0 : -1}
          role="img"
          aria-label={
            hasPhoto
              ? 'Your "I will be attending 85 Hours MMP" card. Use the arrow keys to reposition your photo.'
              : 'The "I will be attending 85 Hours MMP" frame, waiting for a photo.'
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className={`w-full max-w-xl rounded-card border border-line bg-surface-sunken shadow-[var(--shadow-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            hasPhoto ? 'cursor-grab touch-none active:cursor-grabbing' : ''
          }`}
        />
        {!frameReady && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading the frame…
          </p>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor={fileId} className="mb-1 block text-sm font-semibold text-ink">
            1. Choose your photo
          </label>
          <p className="mb-2 text-sm text-muted">
            A landscape photo fits the window best. Your photo stays on your device.
          </p>
          <input
            id={fileId}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="block w-full min-h-11 rounded-field border border-line-strong bg-surface px-3 py-2 text-sm text-body file:mr-3 file:rounded-field file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
        </div>

        <div>
          <label htmlFor={zoomId} className="mb-1 block text-sm font-semibold text-ink">
            2. Zoom
          </label>
          <input
            id={zoomId}
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!hasPhoto}
            onChange={(event) => {
              setZoom(Number(event.target.value))
              // Zooming out shrinks the overhang; pull the stored offset back
              // inside the new bounds so the picture cannot sit off-centre.
              pan(0, 0)
            }}
            className="w-full accent-[var(--color-primary)] disabled:opacity-50"
          />
          <p className="mt-1 text-sm text-muted">
            Drag the photo to reposition it, or focus the card and use the arrow keys.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={download} disabled={!hasPhoto || busy} isLoading={busy}>
            <Download aria-hidden className="size-4" />
            Download
          </Button>
          {canShare && (
            <Button variant="outline" onClick={share} disabled={!hasPhoto || busy}>
              <Share2 aria-hidden className="size-4" />
              Share
            </Button>
          )}
          <Button variant="ghost" onClick={reset} disabled={!hasPhoto}>
            <RotateCcw aria-hidden className="size-4" />
            Reset
          </Button>
        </div>

        {!hasPhoto && (
          <p className="flex items-start gap-2 text-sm text-muted">
            <ImagePlus aria-hidden className="mt-0.5 size-4 shrink-0" />
            Choose a photo to begin. Nothing is uploaded — the card is made on your device.
          </p>
        )}

        {/*
          `Alert` already carries role="status" (or role="alert" when it is a
          danger), so it announces itself. Wrapping it in another live region
          would nest two and read the message twice.
        */}
        {status && <Alert tone={status.tone}>{status.message}</Alert>}
      </div>
    </div>
  )
}

/** Share support never changes within a page view, so there is nothing to subscribe to. */
function subscribeNever() {
  return () => {}
}

function hasShareSupport() {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
}

/** Fallback for browsers without `createImageBitmap` options support. */
function loadViaObjectUrl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode failed'))
    }
    image.src = url
  })
}
