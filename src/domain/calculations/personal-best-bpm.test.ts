import { describe, expect, it } from 'vitest'
import { getPersonalBestBpm } from './personal-best-bpm'
import { createId } from '../shared'
import type { PracticeEntry } from '../practice-entry'

const exerciseId = createId()

function makeEntry(overrides: Partial<PracticeEntry> = {}): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId,
    startedAt: new Date().toISOString(),
    durationSeconds: 60,
    cleanRepetitions: 1,
    result: 'clean',
    ...overrides,
  }
}

describe('getPersonalBestBpm', () => {
  it('returns the highest clean bpm, not the most recent', () => {
    const entries = [
      makeEntry({ bpm: 90, startedAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ bpm: 120, startedAt: '2026-01-02T00:00:00.000Z' }),
      makeEntry({ bpm: 100, startedAt: '2026-01-03T00:00:00.000Z' }),
    ]
    expect(getPersonalBestBpm(entries, exerciseId)).toBe(120)
  })

  it('ignores needs_work entries even at a higher bpm', () => {
    const entries = [
      makeEntry({ bpm: 90, result: 'clean' }),
      makeEntry({ bpm: 150, result: 'needs_work' }),
    ]
    expect(getPersonalBestBpm(entries, exerciseId)).toBe(90)
  })

  it('returns undefined when there are no clean entries', () => {
    expect(getPersonalBestBpm([], exerciseId)).toBeUndefined()
  })
})
