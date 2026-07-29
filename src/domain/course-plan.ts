import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const coursePlanSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type CoursePlan = z.infer<typeof coursePlanSchema>
