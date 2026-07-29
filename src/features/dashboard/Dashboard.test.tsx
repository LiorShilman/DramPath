import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Dashboard } from './Dashboard'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { settingsRepository } from '../../data/repositories'
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
    db.settings.clear(),
  ])
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('shows an empty state with a single action when there is no course plan', async () => {
    renderDashboard()
    expect(await screen.findByRole('link', { name: 'לאשף ההפעלה' })).toBeInTheDocument()
  })

  it('shows real cards after seeding', async () => {
    await runSeedIfNeeded()
    renderDashboard()

    expect(await screen.findByText('שבוע 1')).toBeInTheDocument()
    expect(screen.getByText('0 ימים')).toBeInTheDocument()
  })

  it('shows a backup reminder once 14 days pass with no export', async () => {
    await runSeedIfNeeded()
    const plan = (await db.coursePlans.toArray())[0]!
    const twentyDaysAgo = new Date()
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)
    await db.coursePlans.update(plan.id, { createdAt: twentyDaysAgo.toISOString() })

    renderDashboard()
    expect(await screen.findByText(/לא בוצע גיבוי כבר \d+ ימים/)).toBeInTheDocument()
  })

  it('hides the backup reminder once an export was made recently', async () => {
    await runSeedIfNeeded()
    const plan = (await db.coursePlans.toArray())[0]!
    const twentyDaysAgo = new Date()
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)
    await db.coursePlans.update(plan.id, { createdAt: twentyDaysAgo.toISOString() })
    await settingsRepository.updateSettings({ lastBackupExportAt: nowIso() })

    renderDashboard()
    await screen.findByText('שבוע 1')
    expect(screen.queryByText(/לא בוצע גיבוי כבר/)).not.toBeInTheDocument()
  })

  it('creates a draft PracticeSession when starting practice', async () => {
    await runSeedIfNeeded()
    renderDashboard()
    const user = userEvent.setup()

    const button = await screen.findByRole('button', { name: 'התחל אימון' })
    await user.click(button)

    await waitFor(async () => {
      const sessions = await db.practiceSessions.toArray()
      expect(sessions).toHaveLength(1)
      expect(sessions[0]?.status).toBe('draft')
    })
  })
})
