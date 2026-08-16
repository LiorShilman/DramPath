import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

export const sessionStatusSchema = z.enum(['draft', 'completed', 'abandoned'])
export type SessionStatus = z.infer<typeof sessionStatusSchema>

// ADR 0002: entries are NOT embedded here — they live in the separate
// practiceEntries store, keyed by sessionId, and are composed on read.
export const practiceSessionSchema = z.object({
  id: uuidSchema,
  startedAt: isoDateTimeSchema,
  endedAt: isoDateTimeSchema.optional(),
  status: sessionStatusSchema,
  plannedDurationMinutes: z.number().int().positive(),
  actualDurationSeconds: z.number().int().nonnegative(),
  weekId: uuidSchema.optional(),
  // Manual journal entries ("הוספת אימון") log a lesson that was practiced
  // on a given date without going through /today's live-run flow.
  lessonId: uuidSchema.optional(),
  // Stage 4: a resumable exercise queue — §17 requires resuming an
  // unfinished session after refresh/close, which needs the plan itself
  // persisted, not just kept in router/component state.
  plannedExerciseIds: z.array(uuidSchema),
  currentExerciseIndex: z.number().int().nonnegative(),
  notes: z.string().optional(),
  mood: z.number().int().min(1).max(5).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type PracticeSession = z.infer<typeof practiceSessionSchema>
