import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../../../data/db'
import { approveDrumImport } from './approve-drum-import'
import type { AnalyzeResponse, QuantizedDrumHit } from '../domain/analyze-response'

afterEach(async () => {
  await db.exercises.clear()
  await db.interactiveExercises.clear()
  await db.drumImportMetadata.clear()
})

function buildHit(overrides: Partial<QuantizedDrumHit> = {}): QuantizedDrumHit {
  return {
    instrument: 'kick',
    midiNote: 36,
    sourceTimeMs: 0,
    absoluteSlot: 0,
    measure: 1,
    beatInMeasure: 1,
    subdivisionIndex: 0,
    velocity: 100,
    detectionConfidence: 0.9,
    classificationConfidence: null,
    isUncertain: false,
    ...overrides,
  }
}

function buildResponse(events: QuantizedDrumHit[]): AnalyzeResponse {
  return {
    schemaVersion: '1.0',
    algorithmVersion: 'drum-import-service-0.1.0',
    sourceDurationMs: 12000,
    detectedConstantBpm: 102.0061,
    beatFitScore: 0.6645,
    firstDownbeatMs: 250,
    measures: 2,
    tomResonanceCentersHz: null,
    events,
    eventCountsByInstrument: { kick: 1 },
    uncertainTomHitCount: 0,
    warnings: [],
  }
}

describe('approveDrumImport', () => {
  it('creates a linked Exercise + InteractiveExercise + DrumImportMetadata', async () => {
    const response = buildResponse([
      buildHit({ instrument: 'kick', measure: 1, beatInMeasure: 1, subdivisionIndex: 0 }),
      buildHit({ instrument: 'snare', measure: 1, beatInMeasure: 3, subdivisionIndex: 0 }),
      buildHit({ instrument: 'residual', measure: 1, beatInMeasure: 2, subdivisionIndex: 0 }),
    ])

    const result = await approveDrumImport({
      title: 'שיר מיובא',
      response,
      sourceStemFileNames: ['kick.mp3', 'snare.mp3'],
    })

    expect(result.events).toHaveLength(2)
    expect(result.excludedResidualCount).toBe(1)

    const interactiveExercise = await db.interactiveExercises.get(result.interactiveExerciseId)
    expect(interactiveExercise?.title).toBe('שיר מיובא')
    expect(interactiveExercise?.bpm).toBe(102)
    expect(interactiveExercise?.subdivision).toBe('sixteenth')
    expect(interactiveExercise?.events).toHaveLength(2)

    const coreExercise = await db.exercises.get(interactiveExercise!.exerciseId!)
    expect(coreExercise?.name).toBe('שיר מיובא')
    expect(coreExercise?.category).toBe('song')

    const metadataRows = await db.drumImportMetadata.toArray()
    expect(metadataRows).toHaveLength(1)
    expect(metadataRows[0]!.interactiveExerciseId).toBe(result.interactiveExerciseId)
    expect(metadataRows[0]!.coreExerciseId).toBe(interactiveExercise!.exerciseId)
    expect(metadataRows[0]!.sourceStemFileNames).toEqual(['kick.mp3', 'snare.mp3'])
    expect(metadataRows[0]!.detectedConstantBpm).toBeCloseTo(102.0061)
  })

  it('rounds the detected BPM for the playable exercise but keeps the precise value in metadata', async () => {
    const response = buildResponse([buildHit()])
    const result = await approveDrumImport({ title: 'x', response, sourceStemFileNames: [] })

    const interactiveExercise = await db.interactiveExercises.get(result.interactiveExerciseId)
    expect(interactiveExercise?.bpm).toBe(102)

    const metadataRows = await db.drumImportMetadata.toArray()
    expect(metadataRows[0]!.detectedConstantBpm).toBe(102.0061)
  })
})
