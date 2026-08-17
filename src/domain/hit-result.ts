import { z } from 'zod'
import { uuidSchema } from './shared'
import { drumInstrumentSchema } from './interactive-exercise'

// Visual Drum Trainer — VISUAL_DRUM_TRAINER_SPEC.md §7/§11.
export const hitGradeSchema = z.enum(['perfect', 'early', 'late', 'miss'])
export type HitGrade = z.infer<typeof hitGradeSchema>

// Whether an accented note was actually struck harder than its own
// authored velocity (see hit-matcher.ts's gradeDynamics/ACCENT_VELOCITY_MARGIN)
// — kept as its own parallel schema rather than added to hitGradeSchema,
// since that's a closed enum consumed by exhaustive Record<HitGrade,...>
// maps elsewhere (HitFeedback.tsx, SessionResults.tsx) that have nothing
// to do with dynamics. Only ever set for a real MIDI hit (the only input
// source with genuine per-hit velocity) matched against an accented event
// — undefined for every other case (keyboard/phone hits, non-accented
// notes, misses).
export const dynamicsGradeSchema = z.enum(['correct', 'too-soft'])
export type DynamicsGrade = z.infer<typeof dynamicsGradeSchema>

// A hit tied to a real DrumNoteEvent — expectedEventId always refers to one.
export const hitResultSchema = z.object({
  id: uuidSchema,
  expectedEventId: uuidSchema,
  instrument: drumInstrumentSchema,
  expectedTimeMs: z.number().nonnegative(),
  actualTimeMs: z.number().nonnegative().optional(),
  timingErrorMs: z.number().optional(),
  grade: hitGradeSchema,
  // The real MIDI velocity (0-127) of the strike that produced this hit —
  // undefined for keyboard/phone input, which have no genuine per-hit
  // velocity. Set regardless of whether the matched event was accented
  // (feeds the post-session velocity-consistency graph); dynamicsGrade
  // below is the narrower "was this specific accent hit hard enough" signal.
  actualVelocity: z.number().int().min(0).max(127).optional(),
  dynamicsGrade: dynamicsGradeSchema.optional(),
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
  // Same "real MIDI velocity, undefined for keyboard/phone" convention as
  // HitResult.actualVelocity — added for render-recording.ts, which needs
  // every real hit's actual loudness, extra hits included, to reproduce a
  // faithful recording.
  velocity: z.number().int().min(0).max(127).optional(),
})
export type ExtraHitEvent = z.infer<typeof extraHitEventSchema>
