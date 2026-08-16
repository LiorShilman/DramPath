import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsPage } from './AnalyticsPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import {
  practiceSessionRepository,
  practiceEntryRepository,
  achievementRepository,
} from '../../data/repositories'
import { nowIso } from '../../domain'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
    db.practiceSessions.clear(),
    db.practiceEntries.clear(),
    db.achievements.clear(),
  ])
})

describe('AnalyticsPage', () => {
  it('shows empty states with no practice history', async () => {
    render(<AnalyticsPage />)

    expect(await screen.findByText('אין עדיין נתוני אימון.')).toBeInTheDocument()
    expect(screen.getByText('עדיין אין הישגים.')).toBeInTheDocument()
  })

  it('shows a weekly practice-time chart once a completed session has entries', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    const session = await practiceSessionRepository.create({
      startedAt: nowIso(),
      endedAt: nowIso(),
      status: 'completed',
      plannedDurationMinutes: 20,
      actualDurationSeconds: 120,
      plannedExerciseIds: [exercise.id],
      currentExerciseIndex: 0,
    })
    await practiceEntryRepository.create({
      sessionId: session.id,
      exerciseId: exercise.id,
      startedAt: nowIso(),
      durationSeconds: 120,
      bpm: 90,
      cleanRepetitions: 1,
      result: 'clean',
    })

    render(<AnalyticsPage />)

    expect(await screen.findAllByText('2 דק׳')).toHaveLength(1)
  })

  it('lists achievements when they exist', async () => {
    await achievementRepository.create({
      type: 'streak',
      title: 'רצף של 3 ימים',
      achievedAt: nowIso(),
    })

    render(<AnalyticsPage />)
    expect(await screen.findByText('רצף של 3 ימים')).toBeInTheDocument()
  })
})
