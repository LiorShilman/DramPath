import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ExercisesListPage } from './ExercisesListPage'
import { ExerciseDetailPage } from './ExerciseDetailPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { practiceEntryRepository, resourceRepository } from '../../data/repositories'
import { createId } from '../../domain'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
    db.practiceEntries.clear(),
    db.resources.clear(),
  ])
})

function renderList() {
  return render(
    <MemoryRouter>
      <ExercisesListPage />
    </MemoryRouter>,
  )
}

describe('ExercisesListPage', () => {
  it('lists seeded exercises and filters by category', async () => {
    await runSeedIfNeeded()
    renderList()

    await screen.findByText('מקצב שמיניות #1')
    const grooveCount = await db.exercises.where('category').equals('groove').count()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('סינון לפי קטגוריה'), 'groove')

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'שכפול' })).toHaveLength(grooveCount)
    })
  })

  it('creates a new exercise via the repository', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText('מקצב שמיניות #1')

    const before = await db.exercises.count()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ תרגיל חדש' }))

    await waitFor(async () => {
      expect(await db.exercises.count()).toBe(before + 1)
    })
    const created = (await db.exercises.toArray()).find((ex) => ex.name === 'תרגיל חדש')
    expect(created).toBeDefined()
  })

  it('archives an exercise from the list', async () => {
    await runSeedIfNeeded()
    renderList()
    const target = await screen.findByText('מקצב שמיניות #1')

    const row = target.closest('li')
    if (!row) throw new Error('row not found')
    const targetHref = within(row).getByRole('link').getAttribute('href')
    const exerciseId = targetHref?.split('/').pop()

    const user = userEvent.setup()
    await user.click(within(row).getByRole('button', { name: 'העבר לארכיון' }))

    await waitFor(async () => {
      const updated = exerciseId ? await db.exercises.get(exerciseId) : undefined
      expect(updated?.isArchived).toBe(true)
    })
  })

  it('deletes an exercise after confirming', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText('מקצב שמיניות #1')

    const before = await db.exercises.count()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'מחיקה' })[0]!)

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.exercises.count()).toBe(before - 1)
    })
  })
})

describe('ExerciseDetailPage', () => {
  it('loads the exercise, autosaves an edit, and shows practice history', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]
    if (!exercise) throw new Error('seeded exercise missing')

    await practiceEntryRepository.create({
      sessionId: createId(),
      exerciseId: exercise.id,
      startedAt: new Date().toISOString(),
      durationSeconds: 60,
      bpm: 90,
      cleanRepetitions: 3,
      result: 'clean',
    })

    render(
      <MemoryRouter initialEntries={[`/exercises/${exercise.id}`]}>
        <Routes>
          <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const nameInput = await screen.findByLabelText('שם התרגיל')
    expect(nameInput).toHaveValue(exercise.name)
    expect(await screen.findByText('90 BPM')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.clear(nameInput)
    await user.type(nameInput, 'תרגיל ערוך')

    await waitFor(async () => {
      const updated = await db.exercises.get(exercise.id)
      expect(updated?.name).toBe('תרגיל ערוך')
    })
  })

  it('links a notation resource from the library', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]
    if (!exercise) throw new Error('seeded exercise missing')
    const resource = await resourceRepository.save({
      fileName: 'groove-notation.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
    })

    render(
      <MemoryRouter initialEntries={[`/exercises/${exercise.id}`]}>
        <Routes>
          <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const select = await screen.findByLabelText('קובץ תווים')
    const user = userEvent.setup()
    await user.selectOptions(select, resource.id)

    await waitFor(async () => {
      const updated = await db.exercises.get(exercise.id)
      expect(updated?.notationResourceId).toBe(resource.id)
    })
  })

  it('deletes the exercise after confirming', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]
    if (!exercise) throw new Error('seeded exercise missing')

    render(
      <MemoryRouter initialEntries={[`/exercises/${exercise.id}`]}>
        <Routes>
          <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByLabelText('שם התרגיל')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'מחיקת תרגיל' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.exercises.get(exercise.id)).toBeUndefined()
    })
  })
})
