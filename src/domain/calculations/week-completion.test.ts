import { describe, expect, it } from 'vitest'
import { calculateWeekCompletion } from './week-completion'
import { createId } from '../shared'
import type { Lesson, LessonStatus } from '../lesson'

function makeLesson(status: LessonStatus): Lesson {
  const now = new Date().toISOString()
  return {
    id: createId(),
    order: 1,
    title: 'שיעור',
    category: 'technique',
    resourceIds: [],
    exerciseIds: [],
    tags: [],
    status,
    createdAt: now,
    updatedAt: now,
  }
}

describe('calculateWeekCompletion', () => {
  it('returns the unrounded fraction of completed lessons', () => {
    const lessons = [makeLesson('completed'), makeLesson('not_started'), makeLesson('active')]
    expect(calculateWeekCompletion(lessons)).toBeCloseTo(1 / 3)
  })

  it('returns 0 for an empty week', () => {
    expect(calculateWeekCompletion([])).toBe(0)
  })

  it('returns 1 when every lesson is completed', () => {
    expect(calculateWeekCompletion([makeLesson('completed'), makeLesson('completed')])).toBe(1)
  })
})
