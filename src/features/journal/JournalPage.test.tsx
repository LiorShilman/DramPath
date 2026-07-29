import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalPage } from './JournalPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { practiceSessionRepository, practiceEntryRepository } from '../../data/repositories'
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
  ])
})

async function seedCompletedSession(exerciseId: string) {
  const session = await practiceSessionRepository.create({
    startedAt: nowIso(),
    endedAt: nowIso(),
    status: 'completed',
    plannedDurationMinutes: 20,
    actualDurationSeconds: 300,
    plannedExerciseIds: [exerciseId],
    currentExerciseIndex: 0,
  })
  await practiceEntryRepository.create({
    sessionId: session.id,
    exerciseId,
    startedAt: nowIso(),
    durationSeconds: 300,
    bpm: 90,
    cleanRepetitions: 1,
    result: 'clean',
  })
  return session
}

describe('JournalPage', () => {
  it('shows an empty state when there are no sessions', async () => {
    render(<JournalPage />)
    expect(await screen.findByText('עדיין אין אימונים ביומן.')).toBeInTheDocument()
  })

  it('disables CSV export with no entries and enables it once there are some', async () => {
    const first = render(<JournalPage />)
    expect(await screen.findByRole('button', { name: 'ייצוא CSV' })).toBeDisabled()
    first.unmount()

    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    await seedCompletedSession(exercise.id)

    render(<JournalPage />)
    await waitFor(async () => {
      expect(await screen.findByRole('button', { name: 'ייצוא CSV' })).toBeEnabled()
    })
  })

  it('groups sessions and shows entries on expand', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    await seedCompletedSession(exercise.id)

    render(<JournalPage />)
    const toggle = await screen.findByRole('button', { name: /5 דק׳/ })
    const user = userEvent.setup()
    await user.click(toggle)

    expect(await screen.findByText(exercise.name)).toBeInTheDocument()
    expect(screen.getByText(/90 BPM/)).toBeInTheDocument()
  })

  it('autosaves a note added to a session', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    const session = await seedCompletedSession(exercise.id)

    render(<JournalPage />)
    const toggle = await screen.findByRole('button', { name: /5 דק׳/ })
    const user = userEvent.setup()
    await user.click(toggle)

    const noteInput = await screen.findByLabelText('הערה כללית')
    await user.type(noteInput, 'אימון טוב')

    await waitFor(async () => {
      const updated = await db.practiceSessions.get(session.id)
      expect(updated?.notes).toBe('אימון טוב')
    })
  })

  it('deletes a session and its entries after confirming', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    const session = await seedCompletedSession(exercise.id)

    render(<JournalPage />)
    const toggle = await screen.findByRole('button', { name: /5 דק׳/ })
    const user = userEvent.setup()
    await user.click(toggle)

    await user.click(screen.getByRole('button', { name: 'מחיקת אימון' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.practiceSessions.get(session.id)).toBeUndefined()
    })
    const remainingEntries = await db.practiceEntries.where('sessionId').equals(session.id).toArray()
    expect(remainingEntries).toHaveLength(0)
  })

  it('excludes draft sessions from the journal', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    await practiceSessionRepository.create({
      startedAt: nowIso(),
      status: 'draft',
      plannedDurationMinutes: 20,
      actualDurationSeconds: 0,
      plannedExerciseIds: [exercise.id],
      currentExerciseIndex: 0,
    })

    render(<JournalPage />)
    expect(await screen.findByText('עדיין אין אימונים ביומן.')).toBeInTheDocument()
  })
})
