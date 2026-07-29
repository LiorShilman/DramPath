import type { Exercise, ExerciseCategory } from '../exercise'
import type { PracticeEntry } from '../practice-entry'

const CATEGORIES: ExerciseCategory[] = [
  'technique',
  'coordination',
  'reading',
  'groove',
  'fill',
  'combo',
  'song',
]

/** §21: "פילוח זמן לפי קטגוריה" — practice time summed per exercise category. */
export function sumDurationSecondsByCategory(
  entries: PracticeEntry[],
  exercises: Exercise[],
): Record<ExerciseCategory, number> {
  const totals = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<
    ExerciseCategory,
    number
  >
  const categoryByExerciseId = new Map(exercises.map((exercise) => [exercise.id, exercise.category]))

  for (const entry of entries) {
    const category = categoryByExerciseId.get(entry.exerciseId)
    if (category) {
      totals[category] += entry.durationSeconds
    }
  }

  return totals
}
