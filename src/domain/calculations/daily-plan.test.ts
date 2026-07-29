import { describe, expect, it } from 'vitest'
import { buildDailyPlan } from './daily-plan'
import { createId } from '../shared'
import type { Exercise, ExerciseCategory } from '../exercise'
import type { PracticeEntry } from '../practice-entry'

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name: 'תרגיל',
    category: 'technique',
    instructions: '',
    startBpm: 60,
    targetBpm: 100,
    minBpm: 40,
    maxBpm: 160,
    durationSeconds: 300,
    repetitionsTarget: 8,
    subdivision: 'quarter',
    difficulty: 2,
    tags: [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<PracticeEntry> = {}): PracticeEntry {
  return {
    id: createId(),
    sessionId: createId(),
    exerciseId: createId(),
    startedAt: new Date().toISOString(),
    durationSeconds: 60,
    cleanRepetitions: 0,
    result: 'needs_work',
    ...overrides,
  }
}

describe('buildDailyPlan', () => {
  it('picks a warmup, week focus, needs-work, and fun exercise when time allows', () => {
    const warmup = makeExercise({ category: 'technique', durationSeconds: 60 })
    const focus = makeExercise({ category: 'groove', durationSeconds: 60 })
    const needsWork = makeExercise({ category: 'fill', durationSeconds: 60 })
    const song = makeExercise({ category: 'song', durationSeconds: 60 })

    const plan = buildDailyPlan({
      weekExercises: [warmup, focus],
      allExercises: [warmup, focus, needsWork, song],
      recentEntries: [makeEntry({ exerciseId: needsWork.id, result: 'needs_work' })],
      plannedDurationMinutes: 30,
    })

    expect(plan.map((exercise) => exercise.id)).toEqual([
      warmup.id,
      focus.id,
      needsWork.id,
      song.id,
    ])
  })

  it('never picks the same exercise twice', () => {
    const onlyExercise = makeExercise({ category: 'technique', durationSeconds: 60 })

    const plan = buildDailyPlan({
      weekExercises: [onlyExercise],
      allExercises: [onlyExercise],
      recentEntries: [],
      plannedDurationMinutes: 30,
    })

    expect(plan).toHaveLength(1)
  })

  it('respects the 10%-overrun time budget', () => {
    const warmup = makeExercise({ category: 'technique', durationSeconds: 600 })
    const focus = makeExercise({ category: 'groove', durationSeconds: 600 })

    // 10 minutes planned -> 660s budget; warmup alone (600s) fits, but
    // warmup + focus (1200s) would blow well past the 10% allowance.
    const plan = buildDailyPlan({
      weekExercises: [warmup, focus],
      allExercises: [warmup, focus],
      recentEntries: [],
      plannedDurationMinutes: 10,
    })

    expect(plan.map((exercise) => exercise.id)).toEqual([warmup.id])
  })

  it('skips the needs-work slot when the last entry was clean', () => {
    const warmup = makeExercise({ category: 'technique' })
    const clean = makeExercise({ category: 'groove' })

    const plan = buildDailyPlan({
      weekExercises: [warmup],
      allExercises: [warmup, clean],
      recentEntries: [makeEntry({ exerciseId: clean.id, result: 'clean' })],
      plannedDurationMinutes: 30,
    })

    expect(plan.some((exercise) => exercise.category === ('fill' as ExerciseCategory))).toBe(
      false,
    )
  })

  it('falls back to the full library for a warmup when the week has no technique exercise', () => {
    const focus = makeExercise({ category: 'groove' })
    const libraryWarmup = makeExercise({ category: 'technique' })

    const plan = buildDailyPlan({
      weekExercises: [focus],
      allExercises: [focus, libraryWarmup],
      recentEntries: [],
      plannedDurationMinutes: 30,
    })

    expect(plan.map((exercise) => exercise.id)).toContain(libraryWarmup.id)
  })

  it('picks the exercise from the most recent needs-work entry when there are several', () => {
    const warmup = makeExercise({ category: 'technique' })
    const olderNeedsWork = makeExercise({ category: 'fill' })
    const newerNeedsWork = makeExercise({ category: 'groove' })

    const plan = buildDailyPlan({
      weekExercises: [warmup],
      allExercises: [warmup, olderNeedsWork, newerNeedsWork],
      recentEntries: [
        makeEntry({
          exerciseId: olderNeedsWork.id,
          result: 'needs_work',
          startedAt: '2026-01-01T10:00:00.000Z',
        }),
        makeEntry({
          exerciseId: newerNeedsWork.id,
          result: 'needs_work',
          startedAt: '2026-01-02T10:00:00.000Z',
        }),
      ],
      plannedDurationMinutes: 30,
    })

    expect(plan.map((exercise) => exercise.id)).toContain(newerNeedsWork.id)
    expect(plan.map((exercise) => exercise.id)).not.toContain(olderNeedsWork.id)
  })

  it('returns an empty plan when there are no exercises at all', () => {
    expect(
      buildDailyPlan({
        weekExercises: [],
        allExercises: [],
        recentEntries: [],
        plannedDurationMinutes: 20,
      }),
    ).toEqual([])
  })
})
