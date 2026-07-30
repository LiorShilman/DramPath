import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const resourceSourceTypeSchema = z.enum(['blob', 'link'])
export type ResourceSourceType = z.infer<typeof resourceSourceTypeSchema>

// Duck-typed rather than `instanceof FileSystemFileHandle` — that class
// doesn't exist in the Node/jsdom test environment, and this only needs to
// distinguish "a real file handle" from garbage at the schema boundary.
const fileSystemFileHandleSchema = z.custom<FileSystemFileHandle>(
  (value) => typeof value === 'object' && value !== null && 'getFile' in value,
)

// Exported separately (not just inline in resourceSchema below) so
// `.shape` stays available for partial-field validation, e.g.
// resourceRepository.updateTags() — wrapping in `.refine()` produces a
// ZodEffects, which drops `.shape`.
export const resourceObjectSchema = z.object({
  id: uuidSchema,
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  // Only meaningful for sourceType 'blob' — content-hash dedup has no
  // real analogue for a linked file we never read in full.
  checksum: z.string().min(1).optional(),
  blob: z.instanceof(Blob).optional(),
  // §20 originally covered only blob-backed uploads (PDF/PNG/JPG). Large
  // video files (200-300MB) risk browser storage eviction and blow up
  // backup archive size if copied in the same way, so 'link' stores a
  // live reference to the file on disk instead (Chromium desktop only —
  // see src/lib/file-system-access.ts).
  sourceType: resourceSourceTypeSchema.default('blob'),
  fileHandle: fileSystemFileHandleSchema.optional(),
  tags: z.array(z.string()),
  createdAt: isoDateTimeSchema,
})

export const resourceSchema = resourceObjectSchema
  .refine((resource) => (resource.sourceType === 'blob' ? resource.blob instanceof Blob : true), {
    message: 'בלוב חסר עבור משאב מסוג blob',
    path: ['blob'],
  })
  .refine((resource) => (resource.sourceType === 'link' ? resource.fileHandle != null : true), {
    message: 'קישור לקובץ חסר עבור משאב מסוג link',
    path: ['fileHandle'],
  })

export type Resource = z.infer<typeof resourceSchema>
