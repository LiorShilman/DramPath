import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const weekStatusSchema = z.enum(['locked', 'active', 'completed'])
export type WeekStatus = z.infer<typeof weekStatusSchema>

export const weekSchema = z.object({
  id: uuidSchema,
  coursePlanId: uuidSchema,
  order: z.number().int().positive(),
  title: z.string().min(1),
  focus: z.string().optional(),
  status: weekStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type Week = z.infer<typeof weekSchema>
