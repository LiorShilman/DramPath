import { z } from 'zod'

// Wire contract for the local drum-import service's POST /api/v1/analyze —
// mirrors server/drum-import-service/app/schemas.py's AnalyzeResponse.
// External-API boundary (ADR 0006): validated here like any external input,
// never trusted directly. Lives under features/drum-import/domain (not
// src/domain, which is reserved for persisted entities) because this shape
// is never stored as-is — only the adapted DrumNoteEvent[] output is.
export const drumHitInstrumentSchema = z.enum([
  'kick',
  'snare',
  'tom_floor',
  'tom_mid',
  'tom_high',
  'hihat',
  'ride',
  'crash',
  'residual',
])
export type DrumHitInstrument = z.infer<typeof drumHitInstrumentSchema>

export const quantizedDrumHitSchema = z.object({
  instrument: drumHitInstrumentSchema,
  midiNote: z.number().int(),
  sourceTimeMs: z.number().nonnegative(),
  absoluteSlot: z.number().int().nonnegative(),
  measure: z.number().int().positive(),
  beatInMeasure: z.number().positive(),
  subdivisionIndex: z.number().int().min(0).max(3),
  velocity: z.number().int().min(0).max(127),
  detectionConfidence: z.number().min(0).max(1),
  // Pydantic's `float | None = None` serializes as a present `null`, not an
  // absent key — nullable, not optional.
  classificationConfidence: z.number().min(0).max(1).nullable(),
  isUncertain: z.boolean(),
})
export type QuantizedDrumHit = z.infer<typeof quantizedDrumHitSchema>

export const analyzeResponseSchema = z.object({
  schemaVersion: z.literal('1.0'),
  algorithmVersion: z.string(),
  sourceDurationMs: z.number().nonnegative(),
  detectedConstantBpm: z.number().positive(),
  beatFitScore: z.number(),
  firstDownbeatMs: z.number(),
  measures: z.number().int().positive(),
  // Same nullable-not-optional reasoning as classificationConfidence above.
  tomResonanceCentersHz: z.tuple([z.number(), z.number(), z.number()]).nullable(),
  events: z.array(quantizedDrumHitSchema),
  // partialRecord, not record: instruments with zero detected hits (e.g. a
  // silent/omitted ride stem) are absent from the wire object entirely, not
  // present with value 0 — confirmed against the real service response.
  eventCountsByInstrument: z.partialRecord(drumHitInstrumentSchema, z.number().int().nonnegative()),
  uncertainTomHitCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
})
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>

export const healthResponseSchema = z.object({
  status: z.string(),
  ffmpegAvailable: z.boolean(),
  ffmpegPath: z.string().nullable(),
  version: z.string(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>
