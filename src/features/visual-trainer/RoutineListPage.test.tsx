import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { RoutineListPage } from './RoutineListPage'
import { practiceRoutineRepository, interactiveExerciseRepository } from '../../data/repositories'
import { createId } from '../../domain'
import { db } from '../../data/db'

function renderPage() {
  return render(
    <MemoryRouter>
      <RoutineListPage />
    </MemoryRouter>,
  )
}

afterEach(async () => {
  await db.practiceRoutines.clear()
  await db.interactiveExercises.clear()
})

describe('RoutineListPage', () => {
  it('shows an empty-state message when there are no routines yet', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/עדיין אין רצפי תרגול/)).toBeInTheDocument())
  })

  it('lists a seeded routine with its step count', async () => {
    const exercise = await interactiveExerciseRepository.create({
      title: 'Exercise A',
      difficulty: 'beginner',
      bpm: 100,
      minBpm: 60,
      maxBpm: 160,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'quarter',
      bars: 1,
      loopCount: 1,
      displayMode: 'staff_cursor',
      events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
    })
    await practiceRoutineRepository.create({ title: 'My Routine', exerciseIds: [exercise.id] })

    renderPage()

    await waitFor(() => expect(screen.getByText('My Routine')).toBeInTheDocument())
    expect(screen.getByText('1 תרגילים')).toBeInTheDocument()
  })

  it('deletes a routine after confirming', async () => {
    await practiceRoutineRepository.create({ title: 'Doomed Routine', exerciseIds: [createId()] })
    renderPage()
    await waitFor(() => expect(screen.getByText('Doomed Routine')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'מחיקת Doomed Routine' }))
    await user.click(screen.getByRole('button', { name: 'מחיקה' }))

    await waitFor(() => expect(screen.queryByText('Doomed Routine')).not.toBeInTheDocument())
    expect(await practiceRoutineRepository.getAll()).toEqual([])
  })
})
