import { db } from '../db'
import { lessonSchema, type Lesson } from '../../domain'
import { createTimestampedRepository } from './base-repository'

const base = createTimestampedRepository<Lesson>(db.lessons, lessonSchema)

// ADR 0003: lessonExercises is a derived join table kept in sync here,
// alongside Lesson.exerciseIds (source of truth), for reverse lookups.
async function syncExerciseLinks(lessonId: string, exerciseIds: string[]) {
  await db.transaction('rw', db.lessonExercises, async () => {
    await db.lessonExercises.where('lessonId').equals(lessonId).delete()
    await db.lessonExercises.bulkAdd(
      exerciseIds.map((exerciseId) => ({ lessonId, exerciseId })),
    )
  })
}

export const lessonRepository = {
  ...base,
  async create(input: Parameters<typeof base.create>[0]) {
    const lesson = await base.create(input)
    await syncExerciseLinks(lesson.id, lesson.exerciseIds)
    return lesson
  },
  async patch(id: string, patch: Parameters<typeof base.patch>[1]) {
    const lesson = await base.patch(id, patch)
    if (patch.exerciseIds) {
      await syncExerciseLinks(lesson.id, lesson.exerciseIds)
    }
    return lesson
  },
  async remove(id: string) {
    await db.lessonExercises.where('lessonId').equals(id).delete()
    await base.remove(id)
  },
  async findLessonsByExerciseId(exerciseId: string): Promise<Lesson[]> {
    const links = await db.lessonExercises
      .where('exerciseId')
      .equals(exerciseId)
      .toArray()
    const lessons = await db.lessons.bulkGet(links.map((link) => link.lessonId))
    return lessons.filter((lesson): lesson is Lesson => lesson !== undefined)
  },
}
