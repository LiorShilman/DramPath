import { db } from '../../../data/db'
import { lessonRepository, interactiveExerciseRepository } from '../../../data/repositories'
import { GENERATED_TRACK_TAG } from './generate-curriculum-track'

export interface ResetCurriculumTrackResult {
  removedLessonCount: number
}

// Companion to generateCurriculumTrackUseCase — needed because tuning
// curriculum-stages.ts/pattern-library.ts later means regenerating from
// scratch. Removes every generated-track Lesson and its linked
// InteractiveExercise transactionally; hand-authored lessons/exercises are
// never touched (only rows tagged generated-track are found this way).
export async function resetCurriculumTrackUseCase(): Promise<ResetCurriculumTrackResult> {
  const lessons = await lessonRepository.getAll()
  const generatedLessons = lessons.filter((lesson) => lesson.tags.includes(GENERATED_TRACK_TAG))

  return db.transaction('rw', db.lessons, db.lessonExercises, db.interactiveExercises, async () => {
    for (const lesson of generatedLessons) {
      const linkedExercises = await interactiveExerciseRepository.findByLessonId(lesson.id)
      for (const exercise of linkedExercises) {
        await interactiveExerciseRepository.remove(exercise.id)
      }
      await lessonRepository.remove(lesson.id)
    }
    return { removedLessonCount: generatedLessons.length }
  })
}
