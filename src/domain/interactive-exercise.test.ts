import { describe, expect, it } from 'vitest'
import { createId, nowIso } from './shared'
import { interactiveExerciseSchema } from './interactive-exercise'
import type { DrumNoteEvent, InteractiveExercise } from './interactive-exercise'

function baseEvent(overrides: Partial<DrumNoteEvent> = {}): DrumNoteEvent {
  return {
    id: createId(),
    bar: 1,
    beat: 1,
    subdivisionIndex: 0,
    instrument: 'kick',
    velocity: 100,
    ...overrides,
  }
}

function baseExercise(overrides: Partial<InteractiveExercise> = {}): InteractiveExercise {
  const now = nowIso()
  return {
    id: createId(),
    title: 'תרגיל בסיסי',
    difficulty: 'beginner',
    bpm: 100,
    minBpm: 60,
    maxBpm: 160,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'quarter',
    bars: 2,
    loopCount: 1,
    displayMode: 'note_highway',
    events: [baseEvent()],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('interactiveExerciseSchema', () => {
  it('accepts a valid exercise', () => {
    expect(interactiveExerciseSchema.safeParse(baseExercise()).success).toBe(true)
  })

  it('rejects minBpm greater than maxBpm', () => {
    const result = interactiveExerciseSchema.safeParse(baseExercise({ minBpm: 160, maxBpm: 60 }))
    expect(result.success).toBe(false)
  })

  it('rejects a bpm outside the [minBpm, maxBpm] range', () => {
    const result = interactiveExerciseSchema.safeParse(baseExercise({ bpm: 200, minBpm: 60, maxBpm: 160 }))
    expect(result.success).toBe(false)
  })

  it('rejects an event whose bar exceeds the exercise length', () => {
    const result = interactiveExerciseSchema.safeParse(
      baseExercise({ bars: 2, events: [baseEvent({ bar: 3 })] }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects an event whose beat exceeds the time signature numerator', () => {
    const result = interactiveExerciseSchema.safeParse(
      baseExercise({ timeSignature: { numerator: 4, denominator: 4 }, events: [baseEvent({ beat: 5 })] }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects an event whose subdivisionIndex is out of range for the subdivision', () => {
    // 'quarter' allows only subdivisionIndex 0 (1 subdivision per beat).
    const result = interactiveExerciseSchema.safeParse(
      baseExercise({ subdivision: 'quarter', events: [baseEvent({ subdivisionIndex: 1 })] }),
    )
    expect(result.success).toBe(false)
  })
})
