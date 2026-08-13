import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

// A practice routine (setlist) — an ordered chain of existing
// InteractiveExercise entities that auto-advance during a practice run
// (warm-up -> exercise -> exercise). exerciseIds order IS meaningful here
// (unlike Lesson/Song.exerciseIds, which are display-order-only checklists
// — see ADR 0003) since it's literally playback order. min(1): a routine
// with zero steps has nothing to play.
export const practiceRoutineSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1),
  exerciseIds: z.array(uuidSchema).min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type PracticeRoutine = z.infer<typeof practiceRoutineSchema>
