import { useCallback, useEffect, useState } from 'react'
import { db } from '../../data/db'
import {
  coursePlanRepository,
  weekRepository,
  lessonRepository,
  exerciseRepository,
  achievementRepository,
  practiceSessionRepository,
  settingsRepository,
} from '../../data/repositories'
import {
  calculateStreakDays,
  calculateWeekCompletion,
  sumDurationSeconds,
  getLatestCleanBpm,
  getExercisesForWeek,
} from '../../domain/calculations'
import type {
  Achievement,
  CoursePlan,
  Exercise,
  Week,
} from '../../domain'

const WEEKLY_WINDOW_DAYS = 7
const MAX_ACTIVE_EXERCISES = 5

export interface ActiveExerciseSummary {
  exercise: Exercise
  currentBpm?: number
}

export type DashboardData =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      coursePlan: CoursePlan
      activeWeek?: Week
      weekCompletion: number
      streakDays: number
      weeklyPracticeSeconds: number
      weeklyGoalMinutes: number
      activeExercises: ActiveExerciseSummary[]
      latestAchievement?: Achievement
      daysSinceLastSession?: number
      daysSinceLastBackup: number
    }

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({ status: 'loading' })

  const reload = useCallback(async () => {
    const coursePlans = await coursePlanRepository.getAll()
    const activePlan = coursePlans.find((plan) => plan.isActive) ?? coursePlans[0]

    if (!activePlan) {
      setData({ status: 'empty' })
      return
    }

    const [weeks, lessons, exercises, sessions, entries, settings, achievements] =
      await Promise.all([
        weekRepository.getAll(),
        lessonRepository.getAll(),
        exerciseRepository.getAll(),
        practiceSessionRepository.getAll(),
        db.practiceEntries.toArray(),
        settingsRepository.getSettings(),
        achievementRepository.getAll(),
      ])

    const activeWeek = weeks.find(
      (week) => week.coursePlanId === activePlan.id && week.status === 'active',
    )
    const lessonsThisWeek = activeWeek
      ? lessons.filter((lesson) => lesson.weekId === activeWeek.id)
      : []

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - WEEKLY_WINDOW_DAYS)
    const weeklyEntries = entries.filter((entry) => new Date(entry.startedAt) >= weekAgo)

    const candidateExercises = getExercisesForWeek(lessonsThisWeek, exercises)

    const activeExercises: ActiveExerciseSummary[] = candidateExercises
      .slice(0, MAX_ACTIVE_EXERCISES)
      .map((exercise) => ({
        exercise,
        currentBpm: getLatestCleanBpm(entries, exercise.id),
      }))

    const latestAchievement = [...achievements].sort((a, b) =>
      b.achievedAt.localeCompare(a.achievedAt),
    )[0]

    const completedSessions = sessions
      .filter((session) => session.status === 'completed')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const daysSinceLastSession = completedSessions[0]
      ? Math.floor(
          (Date.now() - new Date(completedSessions[0].startedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : undefined

    // §29: 14-day backup reminder. Before the first-ever export, the clock
    // starts from when the course was created — otherwise a brand-new
    // install would nag on day one.
    const backupClockStart = settings.lastBackupExportAt ?? activePlan.createdAt
    const daysSinceLastBackup = Math.floor(
      (Date.now() - new Date(backupClockStart).getTime()) / (1000 * 60 * 60 * 24),
    )

    setData({
      status: 'ready',
      coursePlan: activePlan,
      activeWeek,
      weekCompletion: calculateWeekCompletion(lessonsThisWeek),
      streakDays: calculateStreakDays(sessions),
      weeklyPracticeSeconds: sumDurationSeconds(weeklyEntries),
      weeklyGoalMinutes: settings.weeklyGoalMinutes,
      activeExercises,
      latestAchievement,
      daysSinceLastSession,
      daysSinceLastBackup,
    })
  }, [])

  useEffect(() => {
    // Fetch-on-mount from Dexie (not React state) — there's no external
    // subscription to attach here, and routing loaders are out of scope
    // for this stage (see plan's Stage 2 scope decisions).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  return { data, reload }
}
