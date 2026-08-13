import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { RoutineBuilderPage } from './RoutineBuilderPage'
import { practiceRoutineRepository, interactiveExerciseRepository } from '../../data/repositories'
import { createId } from '../../domain'
import { db } from '../../data/db'

function renderNewPage() {
  return render(
    <MemoryRouter initialEntries={['/practice/visual/routines/build']}>
      <Routes>
        <Route path="/practice/visual/routines/build" element={<RoutineBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage(routineId: string) {
  return render(
    <MemoryRouter initialEntries={[`/practice/visual/routines/build/${routineId}`]}>
      <Routes>
        <Route path="/practice/visual/routines/build/:routineId" element={<RoutineBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function seedExercise(title: string) {
  return interactiveExerciseRepository.create({
    title,
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
}

afterEach(async () => {
  await db.practiceRoutines.clear()
  await db.interactiveExercises.clear()
})

describe('RoutineBuilderPage', () => {
  it('keeps the save button disabled until a title and at least one step exist', async () => {
    const exercise = await seedExercise('Exercise A')
    renderNewPage()
    const user = userEvent.setup()

    const saveButton = await screen.findByRole('button', { name: 'שמירה' })
    expect(saveButton).toBeDisabled()

    await user.type(screen.getByLabelText('שם הרצף'), 'My Routine')
    expect(saveButton).toBeDisabled() // still no steps

    await user.click(await screen.findByRole('button', { name: new RegExp(exercise.title) }))
    expect(saveButton).toBeEnabled()
  })

  it('adds a step from the catalog and saves a new routine with it', async () => {
    const exercise = await seedExercise('Exercise A')
    renderNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('שם הרצף'), 'My Routine')
    await user.click(await screen.findByRole('button', { name: new RegExp(exercise.title) }))
    await user.click(screen.getByRole('button', { name: 'שמירה' }))

    await waitFor(async () => {
      const all = await practiceRoutineRepository.getAll()
      expect(all).toHaveLength(1)
      expect(all[0]).toMatchObject({ title: 'My Routine', exerciseIds: [exercise.id] })
    })
  })

  it('reorders steps with the up/down buttons before saving', async () => {
    const exerciseA = await seedExercise('Exercise A')
    const exerciseB = await seedExercise('Exercise B')
    renderNewPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('שם הרצף'), 'My Routine')
    await user.click(await screen.findByRole('button', { name: new RegExp(exerciseA.title) }))
    await user.click(await screen.findByRole('button', { name: new RegExp(exerciseB.title) }))

    // Step B (index 2, just added) moves up above step A.
    const moveUpButtons = screen.getAllByRole('button', { name: 'הזזה למעלה' })
    await user.click(moveUpButtons[1]!)

    await user.click(screen.getByRole('button', { name: 'שמירה' }))

    await waitFor(async () => {
      const all = await practiceRoutineRepository.getAll()
      expect(all[0]?.exerciseIds).toEqual([exerciseB.id, exerciseA.id])
    })
  })

  it('loads an existing routine\'s title and steps for editing, and patches it on save', async () => {
    const exercise = await seedExercise('Exercise A')
    const routine = await practiceRoutineRepository.create({ title: 'Original title', exerciseIds: [exercise.id] })

    renderEditPage(routine.id)

    await waitFor(() => expect(screen.getByDisplayValue('Original title')).toBeInTheDocument())
    // The exercise appears twice — once as the loaded step, once still
    // listed in the "add exercise" catalog below it.
    expect(screen.getAllByText(exercise.title).length).toBeGreaterThan(0)

    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('שם הרצף'))
    await user.type(screen.getByLabelText('שם הרצף'), 'Renamed')
    await user.click(screen.getByRole('button', { name: 'שמירה' }))

    await waitFor(async () => {
      const updated = await practiceRoutineRepository.getById(routine.id)
      expect(updated?.title).toBe('Renamed')
    })
  })
})
