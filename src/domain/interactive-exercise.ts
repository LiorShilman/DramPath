import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'
import { subdivisionSchema } from './exercise'

// Visual Drum Trainer — VISUAL_DRUM_TRAINER_SPEC.md §7.
export const drumInstrumentSchema = z.enum([
  'kick',
  'snare',
  'hihat_closed',
  'hihat_open',
  'ride',
  'crash',
  'tom_high',
  'tom_mid',
  'tom_floor',
])
export type DrumInstrument = z.infer<typeof drumInstrumentSchema>

export const timeSignatureSchema = z.object({
  numerator: z.number().int().positive(),
  denominator: z.number().int().positive(),
})
export type TimeSignature = z.infer<typeof timeSignatureSchema>

export const interactiveExerciseDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced'])
export type InteractiveExerciseDifficulty = z.infer<typeof interactiveExerciseDifficultySchema>

export const displayModeSchema = z.enum(['note_highway', 'staff_cursor'])
export type DisplayMode = z.infer<typeof displayModeSchema>

// §8: subdivisionIndex is 0-indexed (spec's own example: eighth notes
// "0 = the beat number, 1 = &"). bar/beat are 1-indexed, matching how
// musicians count — validated against this same convention below.
export const drumNoteEventSchema = z.object({
  id: uuidSchema,
  bar: z.number().int().positive(),
  beat: z.number().int().positive(),
  subdivisionIndex: z.number().int().nonnegative(),
  instrument: drumInstrumentSchema,
  // MIDI velocity convention (0-127) — prepares for §2's future MIDI support.
  velocity: z.number().int().min(0).max(127),
  durationBeats: z.number().positive().optional(),
  accent: z.boolean().optional(),
})
export type DrumNoteEvent = z.infer<typeof drumNoteEventSchema>

// Duplicated intentionally from lib/metronome-math's NOTES_PER_BEAT — domain
// must never import from lib (confirmed one-way lib -> domain dependency).
const SUBDIVISIONS_PER_BEAT: Record<z.infer<typeof subdivisionSchema>, number> = {
  quarter: 1,
  eighth: 2,
  sixteenth: 4,
}

export const interactiveExerciseSchema = z
  .object({
    id: uuidSchema,
    title: z.string().min(1),
    description: z.string().optional(),
    difficulty: interactiveExerciseDifficultySchema,
    bpm: z.number().int().positive(),
    minBpm: z.number().int().positive(),
    maxBpm: z.number().int().positive(),
    timeSignature: timeSignatureSchema,
    subdivision: subdivisionSchema,
    bars: z.number().int().positive(),
    loopCount: z.number().int().positive(),
    displayMode: displayModeSchema,
    // Notation-preview display preference — off by default (cymbals draw as
    // a plain X, no stem/beam). Optional so exercises saved before this
    // existed still validate without a backfill.
    beamCymbals: z.boolean().optional(),
    events: z.array(drumNoteEventSchema),
    lessonId: uuidSchema.optional(),
    exerciseId: uuidSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .superRefine((exercise, ctx) => {
    if (exercise.minBpm > exercise.maxBpm) {
      ctx.addIssue({ code: 'custom', message: 'minBpm must be <= maxBpm', path: ['minBpm'] })
    }
    if (exercise.bpm < exercise.minBpm || exercise.bpm > exercise.maxBpm) {
      ctx.addIssue({
        code: 'custom',
        message: 'bpm must be within [minBpm, maxBpm]',
        path: ['bpm'],
      })
    }
    const subdivisionsPerBeat = SUBDIVISIONS_PER_BEAT[exercise.subdivision]
    exercise.events.forEach((event, index) => {
      if (event.bar > exercise.bars) {
        ctx.addIssue({
          code: 'custom',
          message: 'event.bar exceeds exercise.bars',
          path: ['events', index, 'bar'],
        })
      }
      if (event.beat > exercise.timeSignature.numerator) {
        ctx.addIssue({
          code: 'custom',
          message: 'event.beat exceeds timeSignature.numerator',
          path: ['events', index, 'beat'],
        })
      }
      if (event.subdivisionIndex >= subdivisionsPerBeat) {
        ctx.addIssue({
          code: 'custom',
          message: 'event.subdivisionIndex out of range for subdivision',
          path: ['events', index, 'subdivisionIndex'],
        })
      }
    })
  })

export type InteractiveExercise = z.infer<typeof interactiveExerciseSchema>
