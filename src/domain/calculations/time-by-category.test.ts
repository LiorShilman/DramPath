import { describe, expect, it } from 'vitest'
import { sumDurationSecondsByCategory } from './time-by-category'
import { createId } from '../shared'
import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  const now = new Date().toISOString()
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

function makeEntry(exerciseId: string, durationSeconds: number): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId,
    startedAt: new Date().toISOString(),
    durationSeconds,
    cleanRepetitions: 1,
    result: 'clean',
  }
}

describe('sumDurationSecondsByCategory', () => {
  it('sums durations per exercise category and zero-fills the rest', () => {
    const technique = makeExercise({ category: 'technique' })
    const groove = makeExercise({ category: 'groove' })

    const totals = sumDurationSecondsByCategory(
      [makeEntry(technique.id, 60), makeEntry(technique.id, 30), makeEntry(groove.id, 90)],
      [technique, groove],
    )

    expect(totals.technique).toBe(90)
    expect(totals.groove).toBe(90)
    expect(totals.reading).toBe(0)
  })

  it('ignores entries whose exercise no longer exists', () => {
    const totals = sumDurationSecondsByCategory([makeEntry('missing-exercise', 60)], [])
    expect(Object.values(totals).every((seconds) => seconds === 0)).toBe(true)
  })
})
