import { describe, expect, it } from 'vitest'
import { groupSessionsByPeriod } from './group-sessions'
import { createId } from '../../domain'
import type { PracticeSession } from '../../domain'

function makeSession(startedAt: string): PracticeSession {
  return {
    id: createId(),
    startedAt,
    endedAt: startedAt,
    status: 'completed',
    plannedDurationMinutes: 20,
    actualDurationSeconds: 600,
    plannedExerciseIds: [],
    currentExerciseIndex: 0,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

describe('groupSessionsByPeriod', () => {
  it('groups by day, newest first', () => {
    const groups = groupSessionsByPeriod(
      [makeSession('2026-01-01T10:00:00.000Z'), makeSession('2026-01-02T10:00:00.000Z')],
      'day',
    )
    expect(groups.map((group) => group.key)).toEqual(['2026-01-02', '2026-01-01'])
    expect(groups[0]?.sessions).toHaveLength(1)
  })

  it('groups by month', () => {
    const groups = groupSessionsByPeriod(
      [makeSession('2026-01-05T10:00:00.000Z'), makeSession('2026-01-20T10:00:00.000Z')],
      'month',
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('2026-01')
    expect(groups[0]?.sessions).toHaveLength(2)
  })

  it('groups by week', () => {
    // 2026-01-04 is a Sunday
    const groups = groupSessionsByPeriod(
      [makeSession('2026-01-04T10:00:00.000Z'), makeSession('2026-01-06T10:00:00.000Z')],
      'week',
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('2026-01-04')
  })
})
