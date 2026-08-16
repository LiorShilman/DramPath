import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
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

  it('navigates to /today when starting practice, without minting its own draft session', async () => {
    // TodayPage's own load() is now the single place that finds-or-creates
    // today's draft session — Dashboard creating one here too used to mint
    // a brand-new EMPTY draft on every click regardless of whether one
    // already existed, leaving orphaned drafts behind.
    await runSeedIfNeeded()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/today" element={<p>האימון של היום</p>} />
        </Routes>
      </MemoryRouter>,
    )
    const user = userEvent.setup()

    const button = await screen.findByRole('button', { name: 'התחל אימון' })
    await user.click(button)

    expect(await screen.findByText('האימון של היום')).toBeInTheDocument()
    expect(await db.practiceSessions.toArray()).toHaveLength(0)
  })
})
