import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const achievementTypeSchema = z.enum([
  'streak',
  'bpm_personal_best',
  'lesson_completed',
  'week_completed',
])
export type AchievementType = z.infer<typeof achievementTypeSchema>

export const achievementSchema = z.object({
  id: uuidSchema,
  type: achievementTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  relatedEntityId: uuidSchema.optional(),
  achievedAt: isoDateTimeSchema,
})

export type Achievement = z.infer<typeof achievementSchema>
