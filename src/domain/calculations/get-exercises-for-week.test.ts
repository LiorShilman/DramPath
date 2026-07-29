import { describe, expect, it } from 'vitest'
import { getExercisesForWeek } from './get-exercises-for-week'
import { createId } from '../shared'
import type { Exercise } from '../exercise'
import type { Lesson } from '../lesson'

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

function makeLesson(exerciseIds: string[]): Lesson {
  const now = new Date().toISOString()
  return {
    id: createId(),
    order: 1,
    title: 'שיעור',
    category: 'technique',
    resourceIds: [],
    exerciseIds,
    tags: [],
    status: 'not_started',
    createdAt: now,
    updatedAt: now,
  }
}

describe('getExercisesForWeek', () => {
  it('returns exercises linked via the week lessons', () => {
    const linked = makeExercise()
    const unrelated = makeExercise()
    const lessons = [makeLesson([linked.id])]

    expect(getExercisesForWeek(lessons, [linked, unrelated])).toEqual([linked])
  })

  it('falls back to non-archived exercises when nothing is linked', () => {
    const active = makeExercise()
    const archived = makeExercise({ isArchived: true })

    expect(getExercisesForWeek([makeLesson([])], [active, archived])).toEqual([active])
  })
})
