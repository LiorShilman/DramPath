import { describe, expect, it } from 'vitest'
import { sumDurationSeconds } from './practice-time'
import { createId } from '../shared'
import type { PracticeEntry } from '../practice-entry'

function makeEntry(durationSeconds: number): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId: createId(),
    startedAt: new Date().toISOString(),
    durationSeconds,
    cleanRepetitions: 0,
    result: 'clean',
  }
}

describe('sumDurationSeconds', () => {
  it('sums entry durations, not wall-clock time', () => {
    expect(sumDurationSeconds([makeEntry(120), makeEntry(300), makeEntry(60)])).toBe(480)
  })

  it('returns 0 for no entries', () => {
    expect(sumDurationSeconds([])).toBe(0)
  })
})
