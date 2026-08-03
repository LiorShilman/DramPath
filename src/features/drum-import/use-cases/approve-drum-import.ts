import { db } from '../../../data/db'
import { exerciseRepository, interactiveExerciseRepository, drumImportMetadataRepository } from '../../../data/repositories'
import { createId, nowIso } from '../../../domain'
import type { DrumNoteEvent } from '../../../domain'
import { analyzeResponseToDrumNoteEvents } from '../adapters/analyze-response-to-drum-note-events'
import type { AnalyzeResponse } from '../domain/analyze-response'

export interface ApproveDrumImportInput {
  title: string
  response: AnalyzeResponse
  sourceStemFileNames: string[]
}

export interface ApproveDrumImportResult {
  interactiveExerciseId: string
  events: DrumNoteEvent[]
  excludedResidualCount: number
}

// ADR 0006: the only write path from an approved import into Dexie — always
// through the existing Repository+Zod pattern, never a direct table write.
// Creates a core Exercise (so this shows up in the existing exercise
// library like any other) linked to a new InteractiveExercise (so it's
// playable in the existing Visual Trainer runner), plus one
// DrumImportMetadata provenance row — all three or none, in one transaction.
export async function approveDrumImport(input: ApproveDrumImportInput): Promise<ApproveDrumImportResult> {
  const { events, excludedResidualCount } = analyzeResponseToDrumNoteEvents(input.response)
  const bpm = Math.round(input.response.detectedConstantBpm)
  const durationSeconds = Math.max(1, Math.round(input.response.sourceDurationMs / 1000))

  return db.transaction('rw', db.exercises, db.interactiveExercises, db.drumImportMetadata, async () => {
    const coreExercise = await exerciseRepository.create({
      name: input.title,
      category: 'song',
      instructions: 'תרגיל שיובא אוטומטית מהקלטת אודיו.',
      startBpm: bpm,
      targetBpm: bpm,
      minBpm: Math.max(1, bpm - 30),
      maxBpm: bpm + 50,
      durationSeconds,
      repetitionsTarget: 1,
      subdivision: 'sixteenth',
      difficulty: 3,
      tags: ['imported'],
      isArchived: false,
    })

    const interactiveExercise = await interactiveExerciseRepository.create({
      title: input.title,
      difficulty: 'intermediate',
      bpm,
      minBpm: Math.max(1, bpm - 30),
      maxBpm: bpm + 50,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'sixteenth',
      bars: input.response.measures,
      loopCount: 1,
      displayMode: 'note_highway',
      events,
      exerciseId: coreExercise.id,
    })

    await drumImportMetadataRepository.add({
      id: createId(),
      interactiveExerciseId: interactiveExercise.id,
      coreExerciseId: coreExercise.id,
      sourceStemFileNames: input.sourceStemFileNames,
      algorithmVersion: input.response.algorithmVersion,
      detectedConstantBpm: input.response.detectedConstantBpm,
      uncertainTomHitCount: input.response.uncertainTomHitCount,
      warnings: input.response.warnings,
      createdAt: nowIso(),
    })

    return { interactiveExerciseId: interactiveExercise.id, events, excludedResidualCount }
  })
}
