import { describe, expect, it } from 'vitest'
import { calculateStreakDays } from './streak'
import { createId } from '../shared'
import type { PracticeSession } from '../practice-session'

function makeSession(
  daysAgo: number,
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const iso = date.toISOString()
  return {
    id: createId(),
    startedAt: iso,
    endedAt: iso,
    status: 'completed',
    plannedDurationMinutes: 20,
    actualDurationSeconds: 600,
    plannedExerciseIds: [],
    currentExerciseIndex: 0,
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  }
}

describe('calculateStreakDays', () => {
  it('counts consecutive qualifying days ending today', () => {
    const sessions = [makeSession(0), makeSession(1), makeSession(2)]
    expect(calculateStreakDays(sessions)).toBe(3)
  })

  it('allows a grace day when today has no session yet, but not two', () => {
    const sessions = [makeSession(1), makeSession(2)]
    expect(calculateStreakDays(sessions)).toBe(2)

    const brokenStreak = [makeSession(2), makeSession(3)]
    expect(calculateStreakDays(brokenStreak)).toBe(0)
  })

  it('ignores sessions under 5 minutes or not completed', () => {
    const sessions = [
      makeSession(0, { actualDurationSeconds: 60 }),
      makeSession(1, { status: 'abandoned' }),
    ]
    expect(calculateStreakDays(sessions)).toBe(0)
  })

  it('returns 0 for no sessions', () => {
    expect(calculateStreakDays([])).toBe(0)
  })
})
