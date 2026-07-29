import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const songStatusSchema = z.enum(['new', 'practicing', 'fluent'])
export type SongStatus = z.infer<typeof songStatusSchema>

export const songSectionSchema = z.object({
  label: z.string().min(1),
  startSeconds: z.number().nonnegative().optional(),
  endSeconds: z.number().nonnegative().optional(),
})
export type SongSection = z.infer<typeof songSectionSchema>

export const songSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1),
  artist: z.string().optional(),
  externalUrl: z.url().optional(),
  bpm: z.number().int().positive().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  exerciseIds: z.array(uuidSchema),
  sections: z.array(songSectionSchema),
  status: songStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type Song = z.infer<typeof songSchema>
