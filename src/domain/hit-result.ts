import { z } from 'zod'
import { uuidSchema } from './shared'
import { drumInstrumentSchema } from './interactive-exercise'

// Visual Drum Trainer — VISUAL_DRUM_TRAINER_SPEC.md §7/§11.
export const hitGradeSchema = z.enum(['perfect', 'early', 'late', 'miss'])
export type HitGrade = z.infer<typeof hitGradeSchema>

// A hit tied to a real DrumNoteEvent — expectedEventId always refers to one.
export const hitResultSchema = z.object({
  id: uuidSchema,
  expectedEventId: uuidSchema,
  instrument: drumInstrumentSchema,
  expectedTimeMs: z.number().nonnegative(),
  actualTimeMs: z.number().nonnegative().optional(),
  timingErrorMs: z.number().optional(),
  grade: hitGradeSchema,
})
export type HitResult = z.infer<typeof hitResultSchema>

// §11 step 5, "Extra Hit" — a keypress matching no pending event (wrong
// instrument, or outside every hit window). Not in the spec's literal §7
// type since it has no real expectedEventId to reference; kept as its own
// small type instead of forcing it into hitResultSchema/hitGradeSchema.
export const extraHitEventSchema = z.object({
  id: uuidSchema,
  instrument: drumInstrumentSchema,
  hitTimeMs: z.number().nonnegative(),
})
export type ExtraHitEvent = z.infer<typeof extraHitEventSchema>
