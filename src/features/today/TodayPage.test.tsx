import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { TodayPage } from './TodayPage'
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
    db.practiceSessions.clear(),
    db.practiceEntries.clear(),
  ])
})

function renderToday() {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/practice/session" element={<p>מסך אימון</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TodayPage', () => {
  it('shows an empty state when there are no exercises yet', async () => {
    renderToday()
    expect(await screen.findByRole('link', { name: 'לאשף ההפעלה' })).toBeInTheDocument()
  })

  it('builds and persists a plan from seeded data', async () => {
    await runSeedIfNeeded()
    renderToday()

    await screen.findByRole('button', { name: "20 דק'" })
    const session = (await db.practiceSessions.toArray())[0]
    expect(session).toBeDefined()
    expect(session!.plannedExerciseIds.length).toBeGreaterThan(0)
  })

  it('removes an item from the plan and persists it', async () => {
    await runSeedIfNeeded()
    renderToday()

    await screen.findByRole('button', { name: "20 דק'" })
    const before = (await db.practiceSessions.toArray())[0]!.plannedExerciseIds.length

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /הסר את/ })[0]!)

    await waitFor(async () => {
      const session = (await db.practiceSessions.toArray())[0]!
      expect(session.plannedExerciseIds.length).toBe(before - 1)
    })
  })

  it('regenerates the plan when a different duration preset is chosen', async () => {
    await runSeedIfNeeded()
    renderToday()
    await screen.findByRole('button', { name: "20 דק'" })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: "45 דק'" }))

    await waitFor(async () => {
      const session = (await db.practiceSessions.toArray())[0]!
      expect(session.plannedDurationMinutes).toBe(45)
    })
  })

  it('navigates to the practice session on start', async () => {
    await runSeedIfNeeded()
    renderToday()
    await screen.findByRole('button', { name: "20 דק'" })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'התחל אימון' }))

    expect(await screen.findByText('מסך אימון')).toBeInTheDocument()
  })
})
