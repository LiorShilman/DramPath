import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'
import { getLatestCleanBpm } from './latest-clean-bpm'

export interface DailyPlanInput {
  /** Exercises tied to the active week (from getExercisesForWeek). */
  weekExercises: Exercise[]
  /** The full exercise library, for warmup/needs-work/fun picks outside the week's scope. */
  allExercises: Exercise[]
  /** Recent PracticeEntry history, used to find the last "needs work" exercise and mastery-for-fun candidates. */
  recentEntries: PracticeEntry[]
  plannedDurationMinutes: number
}

// §25.2 allows the total to overrun the planned time by up to 10%.
const TIME_BUDGET_OVERRUN_RATIO = 1.1

/**
 * §25.2 daily-plan selection rule:
 * 1. At least one technique warmup.
 * 2. One focus exercise from the current week.
 * 3. One exercise that needed work in the last session.
 * 4. If time remains, one song/already-mastered exercise, for enjoyment.
 * 5. Total default durations must not exceed the planned time by more than 10%.
 * (Rule 6 — the user may edit the plan before starting — is a UI concern, not this function's.)
 */
export function buildDailyPlan(input: DailyPlanInput): Exercise[] {
  const { weekExercises, allExercises, recentEntries, plannedDurationMinutes } = input
  const budgetSeconds = plannedDurationMinutes * 60 * TIME_BUDGET_OVERRUN_RATIO

  const picked: Exercise[] = []
  const pickedIds = new Set<string>()

  function tryAdd(exercise: Exercise | undefined): void {
    if (!exercise || pickedIds.has(exercise.id)) return
    const projectedSeconds =
      picked.reduce((sum, item) => sum + item.durationSeconds, 0) + exercise.durationSeconds
    if (picked.length > 0 && projectedSeconds > budgetSeconds) return
    picked.push(exercise)
    pickedIds.add(exercise.id)
  }

  const warmup =
    weekExercises.find((exercise) => exercise.category === 'technique') ??
    allExercises.find((exercise) => exercise.category === 'technique')
  tryAdd(warmup)

  const focus = weekExercises.find((exercise) => !pickedIds.has(exercise.id))
  tryAdd(focus)

  const lastNeedsWorkEntry = [...recentEntries]
    .filter((entry) => entry.result === 'needs_work')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  const needsWorkExercise = lastNeedsWorkEntry
    ? allExercises.find((exercise) => exercise.id === lastNeedsWorkEntry.exerciseId)
    : undefined
  tryAdd(needsWorkExercise)

  const funCandidate =
    allExercises.find(
      (exercise) => exercise.category === 'song' && !pickedIds.has(exercise.id),
    ) ??
    allExercises.find((exercise) => {
      if (pickedIds.has(exercise.id)) return false
      const bestCleanBpm = getLatestCleanBpm(recentEntries, exercise.id)
      return bestCleanBpm !== undefined && bestCleanBpm >= exercise.targetBpm
    })
  tryAdd(funCandidate)

  return picked
}
