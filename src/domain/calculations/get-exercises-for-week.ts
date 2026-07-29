import type { Exercise } from '../exercise'
import type { Lesson } from '../lesson'

/**
 * Exercises relevant to a week's lessons, via each Lesson.exerciseIds.
 * Falls back to every non-archived exercise when nothing is linked yet
 * (lessons and exercises aren't associated by the Stage 1 seed data — the
 * user links them from the Stage 3 lesson editor).
 */
export function getExercisesForWeek(
  lessonsThisWeek: Lesson[],
  allExercises: Exercise[],
): Exercise[] {
  const linkedExerciseIds = new Set(
    lessonsThisWeek.flatMap((lesson) => lesson.exerciseIds),
  )

  if (linkedExerciseIds.size > 0) {
    return allExercises.filter((exercise) => linkedExerciseIds.has(exercise.id))
  }

  return allExercises.filter((exercise) => !exercise.isArchived)
}
