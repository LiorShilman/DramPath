import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const lessonCategorySchema = z.enum([
  'technique',
  'coordination',
  'reading',
  'groove',
  'fill',
  'song',
])
export type LessonCategory = z.infer<typeof lessonCategorySchema>

export const lessonStatusSchema = z.enum([
  'not_started',
  'active',
  'completed',
])
export type LessonStatus = z.infer<typeof lessonStatusSchema>

export const lessonSchema = z.object({
  id: uuidSchema,
  order: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  weekId: uuidSchema.optional(),
  category: lessonCategorySchema,
  externalVideoUrl: z.url().optional(),
  resourceIds: z.array(uuidSchema),
  exerciseIds: z.array(uuidSchema),
  // §14 requires filtering lessons by tag, but the original field table
  // (Stage 1) didn't include one — added here, symmetric with Exercise.tags.
  tags: z.array(z.string()),
  status: lessonStatusSchema,
  completionCriteria: z.string().optional(),
  notes: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type Lesson = z.infer<typeof lessonSchema>
