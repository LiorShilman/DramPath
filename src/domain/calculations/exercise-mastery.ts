import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'

export type ExerciseMastery = 'new' | 'learning' | 'stable' | 'mastered'

const CLEAN_REPS_REQUIRED = 3
const SESSIONS_REQUIRED = 2

/**
 * §26 mastery states, "מחושב מהיסטוריית clean ו-BPM" — computed, never
 * stored. §13's "quick completion" rule: 3 clean reps at the same BPM,
 * across 2 separate sessions. Below that, `learning`; met below the
 * exercise's targetBpm → `stable`; met at/above targetBpm → `mastered`.
 * No entries at all → `new`.
 */
export function calculateExerciseMastery(
  entries: PracticeEntry[],
  exercise: Exercise,
): ExerciseMastery {
  const cleanEntries = entries.filter(
    (entry) =>
      entry.exerciseId === exercise.id && entry.result === 'clean' && entry.bpm !== undefined,
  )
  if (cleanEntries.length === 0) return 'new'

  const cleanRepsByBpm = new Map<number, number>()
  const sessionsByBpm = new Map<number, Set<string>>()

  for (const entry of cleanEntries) {
    const bpm = entry.bpm as number
    cleanRepsByBpm.set(bpm, (cleanRepsByBpm.get(bpm) ?? 0) + entry.cleanRepetitions)
    const sessions = sessionsByBpm.get(bpm) ?? new Set<string>()
    sessions.add(entry.sessionId)
    sessionsByBpm.set(bpm, sessions)
  }

  let bestQualifyingBpm: number | undefined
  for (const [bpm, reps] of cleanRepsByBpm) {
    const sessionCount = sessionsByBpm.get(bpm)?.size ?? 0
    if (reps >= CLEAN_REPS_REQUIRED && sessionCount >= SESSIONS_REQUIRED) {
      if (bestQualifyingBpm === undefined || bpm > bestQualifyingBpm) {
        bestQualifyingBpm = bpm
      }
    }
  }

  if (bestQualifyingBpm === undefined) return 'learning'
  return bestQualifyingBpm >= exercise.targetBpm ? 'mastered' : 'stable'
}
