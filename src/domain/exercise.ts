import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const exerciseCategorySchema = z.enum([
  'technique',
  'coordination',
  'reading',
  'groove',
  'fill',
  'combo',
  'song',
])
export type ExerciseCategory = z.infer<typeof exerciseCategorySchema>

export const subdivisionSchema = z.enum(['quarter', 'eighth', 'sixteenth'])
export type Subdivision = z.infer<typeof subdivisionSchema>

export const exerciseSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    category: exerciseCategorySchema,
    instructions: z.string(),
    notationResourceId: uuidSchema.optional(),
    startBpm: z.number().int().positive(),
    targetBpm: z.number().int().positive(),
    minBpm: z.number().int().positive(),
    maxBpm: z.number().int().positive(),
    durationSeconds: z.number().int().positive(),
    repetitionsTarget: z.number().int().positive(),
    subdivision: subdivisionSchema,
    difficulty: z.number().int().min(1).max(5),
    tags: z.array(z.string()),
    isArchived: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .refine((exercise) => exercise.minBpm <= exercise.maxBpm, {
    message: 'minBpm must be <= maxBpm',
    path: ['minBpm'],
  })

export type Exercise = z.infer<typeof exerciseSchema>
