import type { Achievement } from '../achievement'
import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'
import type { PracticeSession } from '../practice-session'
import { calculateStreakDays } from './streak'
import { getPersonalBestBpm } from './personal-best-bpm'

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const

export interface DetectAchievementsInput {
  /** The session that just finished (status/endedAt already set). */
  session: PracticeSession
  /** Entries recorded during this session only. */
  sessionEntries: PracticeEntry[]
  /** All sessions, including this one (for the streak calculation). */
  allSessions: PracticeSession[]
  /** Entries from *before* this session, used as the "previous" personal best. */
  historicalEntries: PracticeEntry[]
  exercises: Exercise[]
  existingAchievements: Achievement[]
}

/**
 * Pure detection of newly-earned achievements at the natural completion
 * points the spec implies (§21 personal bests, streaks). No side effects —
 * the caller persists whatever comes back via achievementRepository.
 */
export function detectAchievements(input: DetectAchievementsInput): Omit<Achievement, 'id'>[] {
  const {
    session,
    sessionEntries,
    allSessions,
    historicalEntries,
    exercises,
    existingAchievements,
  } = input

  const achievedAt = session.endedAt ?? session.startedAt
  const newAchievements: Omit<Achievement, 'id'>[] = []

  const streakDays = calculateStreakDays(allSessions, new Date(achievedAt))
  const milestone = STREAK_MILESTONES.find((candidate) => candidate === streakDays)
  if (milestone !== undefined) {
    const title = `רצף של ${milestone} ימים`
    const alreadyAwarded = existingAchievements.some(
      (achievement) => achievement.type === 'streak' && achievement.title === title,
    )
    if (!alreadyAwarded) {
      newAchievements.push({ type: 'streak', title, achievedAt })
    }
  }

  const bestThisSessionByExercise = new Map<string, number>()
  for (const entry of sessionEntries) {
    if (entry.result !== 'clean' || entry.bpm === undefined) continue
    const current = bestThisSessionByExercise.get(entry.exerciseId)
    if (current === undefined || entry.bpm > current) {
      bestThisSessionByExercise.set(entry.exerciseId, entry.bpm)
    }
  }
  for (const [exerciseId, bpm] of bestThisSessionByExercise) {
    const previousBest = getPersonalBestBpm(historicalEntries, exerciseId)
    if (previousBest === undefined || bpm > previousBest) {
      const exercise = exercises.find((candidate) => candidate.id === exerciseId)
      newAchievements.push({
        type: 'bpm_personal_best',
        title: exercise ? `שיא BPM חדש: ${exercise.name} ב-${bpm}` : `שיא BPM חדש: ${bpm}`,
        relatedEntityId: exerciseId,
        achievedAt,
      })
    }
  }

  return newAchievements
}
