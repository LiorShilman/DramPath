import { describe, expect, it } from 'vitest'
import { getExercisesNotPracticedRecently } from './stale-exercises'
import { createId } from '../shared'
import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'

const NOW = new Date('2026-02-01T00:00:00.000Z')

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  const now = NOW.toISOString()
  return {
    id: createId(),
    name: 'תרגיל',
    category: 'technique',
    instructions: '',
    startBpm: 60,
    targetBpm: 100,
    minBpm: 40,
    maxBpm: 160,
    durationSeconds: 60,
    repetitionsTarget: 8,
    subdivision: 'quarter',
    difficulty: 2,
    tags: [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeEntry(exerciseId: string, startedAt: string): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId,
    startedAt,
    durationSeconds: 60,
    cleanRepetitions: 1,
    result: 'clean',
  }
}

describe('getExercisesNotPracticedRecently', () => {
  it('includes exercises never practiced', () => {
    const exercise = makeExercise()
    const result = getExercisesNotPracticedRecently([exercise], [], 14, NOW)
    expect(result).toEqual([{ exercise, lastPracticedAt: undefined }])
  })

  it('includes exercises last practiced beyond the threshold', () => {
    const exercise = makeExercise()
    const entries = [makeEntry(exercise.id, '2026-01-01T00:00:00.000Z')]
    const result = getExercisesNotPracticedRecently([exercise], entries, 14, NOW)
    expect(result).toHaveLength(1)
  })

  it('excludes exercises practiced within the threshold', () => {
    const exercise = makeExercise()
    const entries = [makeEntry(exercise.id, '2026-01-30T00:00:00.000Z')]
    const result = getExercisesNotPracticedRecently([exercise], entries, 14, NOW)
    expect(result).toHaveLength(0)
  })

  it('uses the latest entry even when an older one for the same exercise appears later in the list', () => {
    const exercise = makeExercise()
    const entries = [
      makeEntry(exercise.id, '2026-01-30T00:00:00.000Z'),
      makeEntry(exercise.id, '2025-06-01T00:00:00.000Z'),
    ]
    const result = getExercisesNotPracticedRecently([exercise], entries, 14, NOW)
    expect(result).toHaveLength(0)
  })

  it('excludes archived exercises', () => {
    const exercise = makeExercise({ isArchived: true })
    expect(getExercisesNotPracticedRecently([exercise], [], 14, NOW)).toHaveLength(0)
  })
})
