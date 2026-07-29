import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'
import { subdivisionSchema } from './exercise'

export const practiceResultSchema = z.enum(['clean', 'needs_work', 'skipped'])
export type PracticeResult = z.infer<typeof practiceResultSchema>

export const practiceEntrySchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  exerciseId: uuidSchema,
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.optional(),
  durationSeconds: z.number().int().nonnegative(),
  bpm: z.number().int().positive().optional(),
  cleanRepetitions: z.number().int().nonnegative(),
  result: practiceResultSchema,
  // Stage 5: records the metronome subdivision used for this attempt, so
  // "last settings per exercise" (§16) is derivable the same way the last
  // clean BPM already is (getLatestCleanBpm) — no separate settings store.
  subdivision: subdivisionSchema.optional(),
  difficultyRating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
})

export type PracticeEntry = z.infer<typeof practiceEntrySchema>
