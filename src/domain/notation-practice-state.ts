import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

// id === the notation Resource's own id (one state row per uploaded song),
// not a separately-generated id — createRepository's HasId constraint wants
// a field literally named `id`, and this is a genuine 1:1 relationship.
export const notationPracticeStateSchema = z.object({
  id: uuidSchema,
  lastBpm: z.number().int().positive(),
  updatedAt: isoDateTimeSchema,
})

export type NotationPracticeState = z.infer<typeof notationPracticeStateSchema>
