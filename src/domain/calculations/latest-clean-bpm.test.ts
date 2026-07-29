import { describe, expect, it } from 'vitest'
import { getLatestCleanBpm } from './latest-clean-bpm'
import { createId } from '../shared'
import type { PracticeEntry } from '../practice-entry'

const exerciseId = createId()
const otherExerciseId = createId()

function makeEntry(overrides: Partial<PracticeEntry>): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId,
    startedAt: new Date().toISOString(),
    durationSeconds: 60,
    cleanRepetitions: 3,
    result: 'clean',
    ...overrides,
  }
}

describe('getLatestCleanBpm', () => {
  it('returns the most recent clean bpm for the exercise', () => {
    const entries = [
      makeEntry({ startedAt: '2026-01-01T10:00:00.000Z', bpm: 80 }),
      makeEntry({ startedAt: '2026-01-05T10:00:00.000Z', bpm: 95 }),
      makeEntry({ startedAt: '2026-01-03T10:00:00.000Z', bpm: 90 }),
    ]
    expect(getLatestCleanBpm(entries, exerciseId)).toBe(95)
  })

  it('ignores needs_work entries and other exercises', () => {
    const entries = [
      makeEntry({ startedAt: '2026-01-05T10:00:00.000Z', bpm: 120, result: 'needs_work' }),
      makeEntry({ startedAt: '2026-01-04T10:00:00.000Z', bpm: 70, exerciseId: otherExerciseId }),
      makeEntry({ startedAt: '2026-01-01T10:00:00.000Z', bpm: 80 }),
    ]
    expect(getLatestCleanBpm(entries, exerciseId)).toBe(80)
  })

  it('returns undefined when there is no clean entry', () => {
    expect(getLatestCleanBpm([], exerciseId)).toBeUndefined()
  })
})
