import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

// A rendered MP3 of one finished InteractiveExercise run's own real hits
// (real timing + real velocity, replayed through the same drum sounds the
// exercise itself uses) — see render-recording.ts. Only a run that actually
// reaches 'finished' produces one; a reset/restart mid-run has nothing
// saved for it. exerciseTitle is a denormalized snapshot (not a live join)
// so a recording still shows a meaningful label after its exercise is
// renamed or deleted, same reasoning as InteractiveExercise's own
// snapshot-y fields elsewhere in this domain.
export const practiceRecordingSchema = z.object({
  id: uuidSchema,
  exerciseId: uuidSchema,
  exerciseTitle: z.string().min(1),
  durationMs: z.number().nonnegative(),
  accuracyPercent: z.number().min(0).max(100),
  audioBlob: z.instanceof(Blob),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type PracticeRecording = z.infer<typeof practiceRecordingSchema>
