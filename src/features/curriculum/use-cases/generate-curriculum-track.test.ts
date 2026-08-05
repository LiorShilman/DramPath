import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../../../data/db'
import { lessonRepository, interactiveExerciseRepository } from '../../../data/repositories'
import { generateCurriculumTrackUseCase, hasGeneratedCurriculumTrack } from './generate-curriculum-track'
import { resetCurriculumTrackUseCase } from './reset-curriculum-track'

afterEach(async () => {
  await db.lessons.clear()
  await db.lessonExercises.clear()
  await db.interactiveExercises.clear()
})

describe('generateCurriculumTrackUseCase', () => {
  it('creates one linked Lesson+InteractiveExercise pair per generated item', async () => {
    expect(await hasGeneratedCurriculumTrack()).toBe(false)

    const result = await generateCurriculumTrackUseCase()

    expect(result.lessonIds.length).toBeGreaterThan(0)
    expect(await hasGeneratedCurriculumTrack()).toBe(true)

    for (const lessonId of result.lessonIds) {
      const lesson = await lessonRepository.getById(lessonId)
      expect(lesson?.tags).toContain('generated-track')
      expect(lesson?.weekId).toBeUndefined()

      const linkedExercises = await interactiveExerciseRepository.findByLessonId(lessonId)
      expect(linkedExercises).toHaveLength(1)
      expect(linkedExercises[0]!.lessonId).toBe(lessonId)
    }
  })

  it('assigns sequential order continuing from existing lessons', async () => {
    await lessonRepository.create({
      order: 5,
      title: 'שיעור קיים',
      category: 'technique',
      status: 'not_started',
      resourceIds: [],
      exerciseIds: [],
      tags: [],
    })

    const result = await generateCurriculumTrackUseCase()
    const generatedLessons = await Promise.all(result.lessonIds.map((id) => lessonRepository.getById(id)))
    const orders = generatedLessons.map((lesson) => lesson!.order).sort((a, b) => a - b)

    expect(orders[0]).toBe(6)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('rejects generating a second track without a reset first', async () => {
    await generateCurriculumTrackUseCase()
    await expect(generateCurriculumTrackUseCase()).rejects.toThrow('already generated')
  })
})

describe('resetCurriculumTrackUseCase', () => {
  it('removes every generated lesson and its linked exercise, leaving hand-authored ones untouched', async () => {
    const handAuthored = await lessonRepository.create({
      order: 1,
      title: 'שיעור ידני',
      category: 'technique',
      status: 'not_started',
      resourceIds: [],
      exerciseIds: [],
      tags: [],
    })

    const generated = await generateCurriculumTrackUseCase()

    const result = await resetCurriculumTrackUseCase()

    expect(result.removedLessonCount).toBe(generated.lessonIds.length)
    for (const lessonId of generated.lessonIds) {
      expect(await lessonRepository.getById(lessonId)).toBeUndefined()
    }
    expect(await lessonRepository.getById(handAuthored.id)).toBeDefined()
    expect(await hasGeneratedCurriculumTrack()).toBe(false)
  })
})
