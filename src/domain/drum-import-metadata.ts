import { z } from 'zod'
import { isoDateTimeSchema, uuidSchema } from './shared'

// ADR 0006: one row per approved drum-audio import, recording provenance —
// not per-event (unlike the full spec's ImportedDrumEventMetadata[]), since
// this scoped-down stage has no per-hit review/correction stage to track
// status against. Answers "did this exercise come from an import, from
// which files, how confident was the detection."
export const drumImportMetadataSchema = z.object({
  id: uuidSchema,
  interactiveExerciseId: uuidSchema,
  coreExerciseId: uuidSchema,
  sourceStemFileNames: z.array(z.string()),
  algorithmVersion: z.string(),
  detectedConstantBpm: z.number(),
  uncertainTomHitCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  createdAt: isoDateTimeSchema,
})
export type DrumImportMetadata = z.infer<typeof drumImportMetadataSchema>
