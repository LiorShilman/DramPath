import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { CoursePage } from './CoursePage'
import { WeekDetailPage } from './WeekDetailPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
    db.achievements.clear(),
  ])
})

describe('CoursePage', () => {
  it('lists all 12 weeks with status and completion', async () => {
    await runSeedIfNeeded()
    render(
      <MemoryRouter>
        <CoursePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('שבוע 1')).toBeInTheDocument()
    expect(screen.getAllByText('פעיל')).toHaveLength(1)
    expect(screen.getAllByRole('link')).toHaveLength(12)
  })
})

describe('WeekDetailPage', () => {
  it('shows the week form and updates status', async () => {
    await runSeedIfNeeded()
    const week1 = await db.weeks.where('order').equals(1).first()
    if (!week1) throw new Error('seeded week1 missing')

    render(
      <MemoryRouter initialEntries={[`/course/weeks/${week1.id}`]}>
        <Routes>
          <Route path="/course/weeks/:weekId" element={<WeekDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const titleInput = await screen.findByLabelText('שם השבוע')
    expect(titleInput).toHaveValue('שבוע 1')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'סמן כהושלם' }))

    await waitFor(async () => {
      const updated = await db.weeks.get(week1.id)
      expect(updated?.status).toBe('completed')
    })

    await waitFor(async () => {
      const achievements = await db.achievements.toArray()
      expect(
        achievements.some(
          (achievement) =>
            achievement.type === 'week_completed' && achievement.relatedEntityId === week1.id,
        ),
      ).toBe(true)
    })
  })
})
