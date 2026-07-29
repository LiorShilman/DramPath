import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { lessonRepository } from './lesson-repository'
import { exerciseRepository } from './exercise-repository'

async function makeExercise() {
  return exerciseRepository.create({
    name: 'תרגיל בדיקה',
    category: 'technique',
    instructions: 'הוראות',
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
  })
}

afterEach(async () => {
  await db.lessons.clear()
  await db.exercises.clear()
  await db.lessonExercises.clear()
})

describe('lessonRepository', () => {
  it('creates a lesson linked to exercises and keeps the join table in sync', async () => {
    const exerciseA = await makeExercise()
    const exerciseB = await makeExercise()

    const lesson = await lessonRepository.create({
      order: 1,
      title: 'שיעור בדיקה',
      category: 'technique',
      status: 'not_started',
      resourceIds: [],
      exerciseIds: [exerciseA.id, exerciseB.id],
      tags: [],
    })

    expect(await db.lessonExercises.count()).toBe(2)
    expect(await lessonRepository.findLessonsByExerciseId(exerciseA.id)).toEqual([lesson])
    expect(await lessonRepository.findLessonsByExerciseId(exerciseB.id)).toEqual([lesson])

    const patched = await lessonRepository.patch(lesson.id, { exerciseIds: [exerciseA.id] })

    expect(await db.lessonExercises.count()).toBe(1)
    expect(await lessonRepository.findLessonsByExerciseId(exerciseB.id)).toEqual([])
    expect(patched.exerciseIds).toEqual([exerciseA.id])

    await lessonRepository.remove(lesson.id)
    expect(await db.lessonExercises.count()).toBe(0)
  })
})
