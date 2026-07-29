import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { PracticeSessionPage } from './PracticeSessionPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { practiceSessionRepository } from '../../data/repositories'
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/practice/session']}>
      <Routes>
        <Route path="/practice/session" element={<PracticeSessionPage />} />
        <Route path="/today" element={<p>תכנון היום</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PracticeSessionPage', () => {
  it('shows a link back to /today when there is no draft session', async () => {
    renderPage()
    expect(
      await screen.findByRole('link', { name: 'לתכנון האימון של היום' }),
    ).toBeInTheDocument()
  })

  it('walks a two-exercise plan, suggests a bpm bump, and finishes the session', async () => {
    await runSeedIfNeeded()
    const exercises = (await db.exercises.toArray()).slice(0, 2)
    const session = await practiceSessionRepository.create({
      startedAt: nowIso(),
      status: 'draft',
      plannedDurationMinutes: 20,
      actualDurationSeconds: 0,
      plannedExerciseIds: exercises.map((exercise) => exercise.id),
      currentExerciseIndex: 0,
    })

    renderPage()
    expect(await screen.findByText(exercises[0]!.name)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'בוצע נקי' }))
    await user.click(screen.getByRole('button', { name: 'בוצע נקי' }))
    await user.click(screen.getByRole('button', { name: 'בוצע נקי' }))

    expect(await screen.findByText(/שלוש חזרות נקיות/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'אישור' }))

    await user.click(screen.getByRole('button', { name: 'לתרגיל הבא' }))
    expect(await screen.findByText(exercises[1]!.name)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'סיום אימון' }))

    expect(await screen.findByText('האימון הושלם!')).toBeInTheDocument()
    await waitFor(async () => {
      const updated = await db.practiceSessions.get(session.id)
      expect(updated?.status).toBe('completed')
    })

    const entries = await db.practiceEntries.where('sessionId').equals(session.id).toArray()
    expect(entries.filter((entry) => entry.result === 'clean')).toHaveLength(3)
    expect(entries.every((entry) => entry.subdivision === exercises[0]!.subdivision)).toBe(true)

    expect(await screen.findByText(/הישגים חדשים/)).toBeInTheDocument()
    const achievements = await db.achievements.toArray()
    expect(achievements.some((achievement) => achievement.type === 'bpm_personal_best')).toBe(
      true,
    )
  })

  it('records the subdivision selected in the metronome controls', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!
    const session = await practiceSessionRepository.create({
      startedAt: nowIso(),
      status: 'draft',
      plannedDurationMinutes: 20,
      actualDurationSeconds: 0,
      plannedExerciseIds: [exercise.id],
      currentExerciseIndex: 0,
    })

    renderPage()
    await screen.findByText(exercise.name)

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('חלוקה'), 'sixteenth')
    await user.click(screen.getByRole('button', { name: 'דורש עבודה' }))

    const entries = await db.practiceEntries.where('sessionId').equals(session.id).toArray()
    expect(entries[0]?.subdivision).toBe('sixteenth')
  })

  it('toggles the metronome on and off without errors', async () => {
    class FakeAudioContext {
      currentTime = 0
      destination = {}
      createOscillator() {
        return { frequency: { value: 0 }, connect: () => {}, start: () => {}, stop: () => {} }
      }
      createGain() {
        return {
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: () => {},
        }
      }
      resume() {
        return Promise.resolve()
      }
      close() {
        return Promise.resolve()
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)

    try {
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

      renderPage()
      await screen.findByText(exercise.name)

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'הפעל מטרונום' }))
      expect(await screen.findByRole('button', { name: 'עצור מטרונום' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'עצור מטרונום' }))
      expect(await screen.findByRole('button', { name: 'הפעל מטרונום' })).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
