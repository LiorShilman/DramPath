import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'

export interface StaleExercise {
  exercise: Exercise
  lastPracticedAt?: string
}

/**
 * §21: "רשימת תרגילים שלא תורגלו לאחרונה." Archived exercises are excluded
 * — they're intentionally retired, not neglected.
 */
export function getExercisesNotPracticedRecently(
  exercises: Exercise[],
  entries: PracticeEntry[],
  thresholdDays: number,
  referenceDate: Date = new Date(),
): StaleExercise[] {
  const lastPracticedByExerciseId = new Map<string, string>()
  for (const entry of entries) {
    const current = lastPracticedByExerciseId.get(entry.exerciseId)
    if (!current || entry.startedAt > current) {
      lastPracticedByExerciseId.set(entry.exerciseId, entry.startedAt)
    }
  }

  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000

  return exercises
    .filter((exercise) => !exercise.isArchived)
    .map((exercise) => ({
      exercise,
      lastPracticedAt: lastPracticedByExerciseId.get(exercise.id),
    }))
    .filter(({ lastPracticedAt }) => {
      if (!lastPracticedAt) return true
      return referenceDate.getTime() - new Date(lastPracticedAt).getTime() > thresholdMs
    })
    .sort((a, b) => (a.lastPracticedAt ?? '').localeCompare(b.lastPracticedAt ?? ''))
}
