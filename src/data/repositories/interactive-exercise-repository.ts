import { db } from '../db'
import { interactiveExerciseSchema, type InteractiveExercise } from '../../domain'
import { createTimestampedRepository } from './base-repository'

const base = createTimestampedRepository<InteractiveExercise>(db.interactiveExercises, interactiveExerciseSchema)

export const interactiveExerciseRepository = {
  ...base,
  // In-memory filter, not a Dexie index — lessonId has no index on this
  // table and this is a small, single-user local dataset (same tradeoff
  // LessonDetailPage already makes for its own client-side filters).
  async findByLessonId(lessonId: string): Promise<InteractiveExercise[]> {
    const all = await base.getAll()
    return all.filter((exercise) => exercise.lessonId === lessonId)
  },
}
