import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const resourceSchema = z.object({
  id: uuidSchema,
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  blob: z.instanceof(Blob),
  tags: z.array(z.string()),
  createdAt: isoDateTimeSchema,
})

export type Resource = z.infer<typeof resourceSchema>
