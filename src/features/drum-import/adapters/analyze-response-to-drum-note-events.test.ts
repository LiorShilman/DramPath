import { describe, expect, it } from 'vitest'
import { analyzeResponseToDrumNoteEvents } from './analyze-response-to-drum-note-events'
import type { AnalyzeResponse, QuantizedDrumHit } from '../domain/analyze-response'

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
    sourceDurationMs: 10000,
    detectedConstantBpm: 100,
    beatFitScore: 0.7,
    firstDownbeatMs: 0,
    measures: 4,
    tomResonanceCentersHz: null,
    events,
    eventCountsByInstrument: {},
    uncertainTomHitCount: 0,
    warnings: [],
  }
}

describe('analyzeResponseToDrumNoteEvents', () => {
  it('maps a wire hit to a DrumNoteEvent, deriving the integer beat from beatInMeasure', () => {
    // slot 5 -> measure 1, beatInMeasure 2.25, subdivisionIndex 1 (matches
    // analyze.py's own arithmetic: (5 % 16) / 4 + 1 = 2.25, 5 % 4 = 1).
    const response = buildResponse([
      buildHit({ instrument: 'snare', measure: 1, beatInMeasure: 2.25, subdivisionIndex: 1, velocity: 90 }),
    ])

    const { events, excludedResidualCount } = analyzeResponseToDrumNoteEvents(response)

    expect(excludedResidualCount).toBe(0)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      bar: 1,
      beat: 2,
      subdivisionIndex: 1,
      instrument: 'snare',
      velocity: 90,
    })
    expect(events[0]!.id).toBeTruthy()
  })

  it('maps hihat to hihat_closed (no open/closed distinction available)', () => {
    const response = buildResponse([buildHit({ instrument: 'hihat' })])
    const { events } = analyzeResponseToDrumNoteEvents(response)
    expect(events[0]!.instrument).toBe('hihat_closed')
  })

  it('maps every other wire instrument straight through by name', () => {
    const response = buildResponse([
      buildHit({ instrument: 'tom_floor' }),
      buildHit({ instrument: 'tom_mid' }),
      buildHit({ instrument: 'tom_high' }),
      buildHit({ instrument: 'ride' }),
      buildHit({ instrument: 'crash' }),
    ])
    const { events } = analyzeResponseToDrumNoteEvents(response)
    expect(events.map((e) => e.instrument)).toEqual(['tom_floor', 'tom_mid', 'tom_high', 'ride', 'crash'])
  })

  it('drops residual hits and counts them instead of emitting an event', () => {
    const response = buildResponse([buildHit({ instrument: 'kick' }), buildHit({ instrument: 'residual' })])

    const { events, excludedResidualCount } = analyzeResponseToDrumNoteEvents(response)

    expect(events).toHaveLength(1)
    expect(events[0]!.instrument).toBe('kick')
    expect(excludedResidualCount).toBe(1)
  })

  it('assigns each event a fresh unique id', () => {
    const response = buildResponse([buildHit(), buildHit({ measure: 2 })])
    const { events } = analyzeResponseToDrumNoteEvents(response)
    expect(events[0]!.id).not.toBe(events[1]!.id)
  })
})
