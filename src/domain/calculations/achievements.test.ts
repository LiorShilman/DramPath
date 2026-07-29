import { describe, expect, it } from 'vitest'
import { detectAchievements } from './achievements'
import { createId } from '../shared'
import type { Achievement } from '../achievement'
import type { Exercise } from '../exercise'
import type { PracticeEntry } from '../practice-entry'
import type { PracticeSession } from '../practice-session'

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
    durationSeconds: 60,
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

function makeSession(daysAgo: number, overrides: Partial<PracticeSession> = {}): PracticeSession {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const iso = date.toISOString()
  return {
    id: createId(),
    startedAt: iso,
    endedAt: iso,
    status: 'completed',
    plannedDurationMinutes: 20,
    actualDurationSeconds: 600,
    plannedExerciseIds: [],
    currentExerciseIndex: 0,
    createdAt: iso,
    updatedAt: iso,
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
    cleanRepetitions: 1,
    result: 'clean',
    ...overrides,
  }
}

describe('detectAchievements', () => {
  it('detects a new bpm personal best', () => {
    const exercise = makeExercise()
    const session = makeSession(0)
    const sessionEntries = [
      makeEntry({ sessionId: session.id, exerciseId: exercise.id, bpm: 110, result: 'clean' }),
    ]

    const result = detectAchievements({
      session,
      sessionEntries,
      allSessions: [session],
      historicalEntries: [makeEntry({ exerciseId: exercise.id, bpm: 100, result: 'clean' })],
      exercises: [exercise],
      existingAchievements: [],
    })

    expect(result).toContainEqual(
      expect.objectContaining({ type: 'bpm_personal_best', relatedEntityId: exercise.id }),
    )
  })

  it('does not award a personal best when the bpm does not beat history', () => {
    const exercise = makeExercise()
    const session = makeSession(0)
    const sessionEntries = [
      makeEntry({ sessionId: session.id, exerciseId: exercise.id, bpm: 90, result: 'clean' }),
    ]

    const result = detectAchievements({
      session,
      sessionEntries,
      allSessions: [session],
      historicalEntries: [makeEntry({ exerciseId: exercise.id, bpm: 100, result: 'clean' })],
      exercises: [exercise],
      existingAchievements: [],
    })

    expect(result.some((achievement) => achievement.type === 'bpm_personal_best')).toBe(false)
  })

  it('only awards the best bpm once per exercise per session', () => {
    const exercise = makeExercise()
    const session = makeSession(0)
    const sessionEntries = [
      makeEntry({ sessionId: session.id, exerciseId: exercise.id, bpm: 105, result: 'clean' }),
      makeEntry({ sessionId: session.id, exerciseId: exercise.id, bpm: 110, result: 'clean' }),
    ]

    const result = detectAchievements({
      session,
      sessionEntries,
      allSessions: [session],
      historicalEntries: [makeEntry({ exerciseId: exercise.id, bpm: 100, result: 'clean' })],
      exercises: [exercise],
      existingAchievements: [],
    })

    const bpmAchievements = result.filter((achievement) => achievement.type === 'bpm_personal_best')
    expect(bpmAchievements).toHaveLength(1)
    expect(bpmAchievements[0]?.title).toContain('110')
  })

  it('detects a streak milestone', () => {
    const today = makeSession(0)
    const allSessions = [today, makeSession(1), makeSession(2)]

    const result = detectAchievements({
      session: today,
      sessionEntries: [],
      allSessions,
      historicalEntries: [],
      exercises: [],
      existingAchievements: [],
    })

    expect(result).toContainEqual(
      expect.objectContaining({ type: 'streak', title: 'רצף של 3 ימים' }),
    )
  })

  it('does not re-award a streak milestone that was already recorded', () => {
    const today = makeSession(0)
    const allSessions = [today, makeSession(1), makeSession(2)]
    const existingAchievements: Achievement[] = [
      {
        id: createId(),
        type: 'streak',
        title: 'רצף של 3 ימים',
        achievedAt: new Date().toISOString(),
      },
    ]

    const result = detectAchievements({
      session: today,
      sessionEntries: [],
      allSessions,
      historicalEntries: [],
      exercises: [],
      existingAchievements,
    })

    expect(result.some((achievement) => achievement.type === 'streak')).toBe(false)
  })

  it('returns nothing when no milestone is hit and no pr happened', () => {
    const session = makeSession(0)
    const result = detectAchievements({
      session,
      sessionEntries: [],
      allSessions: [session],
      historicalEntries: [],
      exercises: [],
      existingAchievements: [],
    })
    expect(result).toEqual([])
  })
})
