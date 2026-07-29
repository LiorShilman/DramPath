import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { exerciseRepository } from './exercise-repository'
import { lessonRepository } from './lesson-repository'
import { songRepository } from './song-repository'

afterEach(async () => {
  await db.exercises.clear()
  await db.lessons.clear()
  await db.lessonExercises.clear()
  await db.songs.clear()
})

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

describe('exerciseRepository.removeAndUnlink', () => {
  it('deletes the exercise and unlinks it from every lesson that referenced it', async () => {
    const exerciseA = await makeExercise()
    const exerciseB = await makeExercise()

    const lesson = await lessonRepository.create({
      order: 1,
      title: 'שיעור',
      category: 'technique',
      status: 'not_started',
      resourceIds: [],
      exerciseIds: [exerciseA.id, exerciseB.id],
      tags: [],
    })

    await exerciseRepository.removeAndUnlink(exerciseA.id)

    expect(await exerciseRepository.getById(exerciseA.id)).toBeUndefined()
    const updatedLesson = await lessonRepository.getById(lesson.id)
    expect(updatedLesson?.exerciseIds).toEqual([exerciseB.id])
    expect(await lessonRepository.findLessonsByExerciseId(exerciseA.id)).toEqual([])
    expect(await lessonRepository.findLessonsByExerciseId(exerciseB.id)).toEqual([updatedLesson])
  })

  it('also unlinks the exercise from every song that referenced it', async () => {
    const exercise = await makeExercise()
    const song = await songRepository.create({
      title: 'שיר',
      exerciseIds: [exercise.id],
      sections: [],
      status: 'new',
    })

    await exerciseRepository.removeAndUnlink(exercise.id)

    expect((await songRepository.getById(song.id))?.exerciseIds).toEqual([])
  })
})
