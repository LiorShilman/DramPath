import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { TodayPage } from './TodayPage'
import { db } from '../../data/db'
import { exerciseRepository, lessonRepository, practiceSessionRepository } from '../../data/repositories'
import { nowIso } from '../../domain'
import type { Exercise } from '../../domain'

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

async function seedLessonWithExercise(): Promise<{ exercise: Exercise; lessonTitle: string }> {
  const exercise = await exerciseRepository.create({
    name: 'תרגיל בדיקה',
    category: 'technique',
    instructions: '',
    startBpm: 60,
    targetBpm: 100,
    minBpm: 40,
    maxBpm: 160,
    durationSeconds: 120,
    repetitionsTarget: 1,
    subdivision: 'quarter',
    difficulty: 1,
    tags: [],
    isArchived: false,
  })
  const lessonTitle = 'שיעור בדיקה — קואורדינציה'
  await lessonRepository.create({
    order: 1,
    title: lessonTitle,
    category: 'coordination',
    resourceIds: [],
    exerciseIds: [exercise.id],
    tags: [],
    status: 'not_started',
  })
  return { exercise, lessonTitle }
}

describe('TodayPage', () => {
  it('shows an empty state when there are no lessons yet', async () => {
    renderToday()
    expect(await screen.findByRole('link', { name: 'לאשף ההפעלה' })).toBeInTheDocument()
  })

  it('creates a fresh empty draft session when none exists yet — no algorithmic auto-fill', async () => {
    // Explicit user request: the old warmup/focus/needs-work/fun
    // recommendation had no real relationship to independent, self-directed
    // practice — a fresh session now starts empty, waiting for the player
    // to pick a real lesson.
    await seedLessonWithExercise()
    renderToday()

    await screen.findByRole('button', { name: "20 דק'" })
    const session = (await db.practiceSessions.toArray())[0]
    expect(session).toBeDefined()
    expect(session!.plannedExerciseIds).toEqual([])
  })

  it("picking a lesson populates the plan from that lesson's own linked exercises, with no per-exercise step", async () => {
    const { exercise, lessonTitle } = await seedLessonWithExercise()
    renderToday()
    await screen.findByRole('button', { name: "20 דק'" })

    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'בחירת שיעור להיום' }), lessonTitle)

    await waitFor(async () => {
      const session = (await db.practiceSessions.toArray())[0]!
      expect(session.plannedExerciseIds).toEqual([exercise.id])
      expect(session.lessonId).toBeDefined()
    })
    // No exercise-level UI is rendered — the exercise's own name never appears.
    expect(screen.queryByText(exercise.name)).not.toBeInTheDocument()
  })

  it('a duration preset persists on its own, without touching the current plan', async () => {
    const { exercise, lessonTitle } = await seedLessonWithExercise()
    renderToday()
    await screen.findByRole('button', { name: "20 דק'" })
    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'בחירת שיעור להיום' }), lessonTitle)
    await waitFor(async () => {
      const session = (await db.practiceSessions.toArray())[0]!
      expect(session.plannedExerciseIds).toEqual([exercise.id])
    })

    await user.click(screen.getByRole('button', { name: "45 דק'" }))

    await waitFor(async () => {
      const session = (await db.practiceSessions.toArray())[0]!
      expect(session.plannedDurationMinutes).toBe(45)
      expect(session.plannedExerciseIds).toEqual([exercise.id])
    })
  })

  it('changing the date field persists the new date on the draft session', async () => {
    await seedLessonWithExercise()
    renderToday()
    const dateInput = await screen.findByDisplayValue(new Date().toISOString().slice(0, 10))

    fireEvent.change(dateInput, { target: { value: '2026-01-05' } })

    await waitFor(async () => {
      const session = (await db.practiceSessions.toArray())[0]!
      expect(session.startedAt.slice(0, 10)).toBe('2026-01-05')
    })
  })

  it('trusts an already-emptied draft instead of silently regenerating it on the next load', async () => {
    // Direct user report: removing every planned exercise used to get
    // treated (on the following load) as "no draft yet" and silently
    // replaced with a freshly regenerated plan — a removal never actually
    // stuck. A draft with 0 planned exercises is real, intentional state.
    await seedLessonWithExercise()
    await practiceSessionRepository.create({
      startedAt: nowIso(),
      status: 'draft',
      plannedDurationMinutes: 30,
      actualDurationSeconds: 0,
      plannedExerciseIds: [],
      currentExerciseIndex: 0,
    })

    renderToday()

    await screen.findByRole('button', { name: "30 דק'" })
    const sessions = await db.practiceSessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.plannedExerciseIds).toEqual([])
  })

  it('the start button stays disabled with an empty plan, and navigates once a lesson is picked', async () => {
    const { lessonTitle } = await seedLessonWithExercise()
    renderToday()
    await screen.findByRole('button', { name: "20 דק'" })

    expect(screen.getByRole('button', { name: 'התחל אימון' })).toBeDisabled()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'בחירת שיעור להיום' }), lessonTitle)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'התחל אימון' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'התחל אימון' }))

    expect(await screen.findByText('מסך אימון')).toBeInTheDocument()
  })
})
