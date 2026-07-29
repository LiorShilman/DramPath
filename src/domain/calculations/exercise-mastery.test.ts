import { describe, expect, it } from 'vitest'
import { calculateExerciseMastery } from './exercise-mastery'
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

function makeEntry(overrides: Partial<PracticeEntry> = {}): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId: '',
    startedAt: new Date().toISOString(),
    durationSeconds: 60,
    cleanRepetitions: 1,
    result: 'clean',
    ...overrides,
  }
}

describe('calculateExerciseMastery', () => {
  it('returns new when there are no entries', () => {
    expect(calculateExerciseMastery([], makeExercise())).toBe('new')
  })

  it('returns learning when clean reps have not met the 3-reps/2-sessions bar', () => {
    const exercise = makeExercise()
    const entries = [
      makeEntry({ exerciseId: exercise.id, bpm: 80 }),
      makeEntry({ exerciseId: exercise.id, bpm: 80 }),
    ]
    expect(calculateExerciseMastery(entries, exercise)).toBe('learning')
  })

  it('returns learning when 3 clean reps happen in a single session', () => {
    const exercise = makeExercise()
    const sessionId = createId()
    const entries = [
      makeEntry({ exerciseId: exercise.id, bpm: 80, sessionId }),
      makeEntry({ exerciseId: exercise.id, bpm: 80, sessionId }),
      makeEntry({ exerciseId: exercise.id, bpm: 80, sessionId }),
    ]
    expect(calculateExerciseMastery(entries, exercise)).toBe('learning')
  })

  it('returns stable when the qualifying bpm is below target', () => {
    const exercise = makeExercise({ targetBpm: 100 })
    const entries = [
      makeEntry({ exerciseId: exercise.id, bpm: 80, sessionId: 's1' }),
      makeEntry({ exerciseId: exercise.id, bpm: 80, sessionId: 's1' }),
      makeEntry({ exerciseId: exercise.id, bpm: 80, sessionId: 's2' }),
    ]
    expect(calculateExerciseMastery(entries, exercise)).toBe('stable')
  })

  it('returns mastered when the qualifying bpm is at or above target', () => {
    const exercise = makeExercise({ targetBpm: 100 })
    const entries = [
      makeEntry({ exerciseId: exercise.id, bpm: 100, sessionId: 's1' }),
      makeEntry({ exerciseId: exercise.id, bpm: 100, sessionId: 's1' }),
      makeEntry({ exerciseId: exercise.id, bpm: 100, sessionId: 's2' }),
    ]
    expect(calculateExerciseMastery(entries, exercise)).toBe('mastered')
  })

  it('ignores entries for other exercises and non-clean results', () => {
    const exercise = makeExercise({ targetBpm: 100 })
    const entries = [
      makeEntry({ exerciseId: 'other-exercise', bpm: 100, sessionId: 's1' }),
      makeEntry({ exerciseId: exercise.id, bpm: 100, sessionId: 's1', result: 'needs_work' }),
    ]
    expect(calculateExerciseMastery(entries, exercise)).toBe('new')
  })
})
