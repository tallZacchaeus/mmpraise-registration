import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { db } from '@/lib/db'
import type { DocumentKind } from '@/generated/prisma/enums'
import { env } from '@/lib/env'
import { buildStorageKey, storage } from '@/lib/storage'

/**
 * File upload handling.
 *
 * Uploads are the highest-risk input in the system, so every file is checked
 * against declared type *and* actual bytes:
 *
 *  1. Size is capped before anything is read into memory.
 *  2. The magic bytes are inspected — a .png that is really a script is rejected.
 *  3. Images are re-encoded with sharp. Re-encoding discards EXIF (including GPS
 *     coordinates) and neutralises polyglot files that are valid in two formats.
 *  4. The stored key is a random UUID under our own extension, so a filename can
 *     never influence the path or the served content type.
 */

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const DOCUMENT_MIME_TYPES = ['application/pdf', ...IMAGE_MIME_TYPES] as const

export type UploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string }

/** Detect a file's true type from its leading bytes. */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }

  // WebP: "RIFF" .... "WEBP"
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }

  // PDF: "%PDF-"
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'

  return null
}

function maxBytes(overrideKb?: number | null): number {
  return overrideKb ? overrideKb * 1024 : env.MAX_UPLOAD_MB * 1024 * 1024
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Validate, normalise and persist an upload.
 * Images are resized and re-encoded to WebP; PDFs are stored byte-for-byte
 * after a magic-byte check.
 */
export async function storeUpload(params: {
  file: File
  userId: string
  applicationId?: string | null
  kind: DocumentKind
  allowedMimeTypes?: readonly string[]
  maxFileSizeKb?: number | null
  /** Longest edge for images, in pixels. */
  maxDimension?: number
}): Promise<UploadResult> {
  const { file, userId, kind } = params
  const allowed = params.allowedMimeTypes ?? (kind === 'PROFILE_PHOTO' ? IMAGE_MIME_TYPES : DOCUMENT_MIME_TYPES)
  const limit = maxBytes(params.maxFileSizeKb)

  if (!file || file.size === 0) return { ok: false, error: 'No file was uploaded' }
  if (file.size > limit) {
    return { ok: false, error: `File is too large. The maximum is ${humanFileSize(limit)}` }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const actualType = sniffMimeType(buffer)

  if (!actualType) {
    return { ok: false, error: 'Unsupported file type. Upload a JPG, PNG, WebP or PDF file' }
  }
  if (!allowed.includes(actualType)) {
    const names = allowed.map((m) => m.split('/')[1]!.toUpperCase()).join(', ')
    return { ok: false, error: `This field accepts ${names} files only` }
  }

  let body = buffer
  let storedType = actualType
  let extension = actualType === 'application/pdf' ? 'pdf' : 'webp'
  let width: number | null = null
  let height: number | null = null

  if (actualType !== 'application/pdf') {
    try {
      const image = sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate()
      const metadata = await image.metadata()
      const longest = params.maxDimension ?? (kind === 'PROFILE_PHOTO' ? 800 : 1600)

      const output = await image
        .resize({ width: longest, height: longest, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true })

      body = output.data
      width = output.info.width
      height = output.info.height
      storedType = 'image/webp'
      extension = 'webp'

      if (!metadata.width || !metadata.height) {
        return { ok: false, error: 'That image could not be read. Try a different file' }
      }
    } catch {
      return { ok: false, error: 'That image could not be processed. Try a different file' }
    }
  }

  const key = buildStorageKey(kind.toLowerCase(), extension)
  await storage.put(key, body, storedType)

  const document = await db.volunteerDocument.create({
    data: {
      userId,
      applicationId: params.applicationId ?? null,
      kind,
      storageKey: key,
      // The original name is kept for display only; it never touches the path.
      originalName: file.name.slice(0, 200).replace(/[\r\n]/g, ''),
      mimeType: storedType,
      sizeBytes: body.byteLength,
      checksum: createHash('sha256').update(body).digest('hex'),
      width,
      height,
    },
  })

  return { ok: true, documentId: document.id }
}

/** Remove a document record and its stored object. */
export async function deleteDocument(documentId: string): Promise<void> {
  const document = await db.volunteerDocument.findUnique({ where: { id: documentId } })
  if (!document) return
  await storage.delete(document.storageKey).catch(() => undefined)
  await db.volunteerDocument.delete({ where: { id: documentId } }).catch(() => undefined)
}
