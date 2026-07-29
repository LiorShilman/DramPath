import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SetupWizard } from './SetupWizard'
import { db } from '../../data/db'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
    db.settings.clear(),
  ])
})

function renderWizard() {
  return render(
    <MemoryRouter>
      <SetupWizard />
    </MemoryRouter>,
  )
}

describe('SetupWizard', () => {
  it('seeds starter data when clicking the seed button', async () => {
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'טען נתוני התחלה' }))

    expect(await screen.findByRole('button', { name: /נטענו/ })).toBeInTheDocument()
    expect(await db.coursePlans.count()).toBe(1)
  })

  it('persists the weekly goal setting on finish', async () => {
    renderWizard()
    const user = userEvent.setup()

    const input = await screen.findByLabelText('יעד דקות אימון שבועי')
    await user.clear(input)
    await user.type(input, '200')
    await user.click(screen.getByRole('button', { name: 'סיום' }))

    await waitFor(async () => {
      const settings = await db.settings.get('user-settings')
      expect(settings?.weeklyGoalMinutes).toBe(200)
    })
  })
})
