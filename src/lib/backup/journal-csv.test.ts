import { describe, expect, it } from 'vitest'
import { buildJournalCsv } from './journal-csv'
import { createId } from '../../domain'
import type { Exercise, PracticeEntry } from '../../domain'

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name: 'תרגיל, עם פסיק',
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

describe('buildJournalCsv', () => {
  it('builds a header row plus one row per entry, sorted by date', () => {
    const exercise = makeExercise()
    const entries: PracticeEntry[] = [
      {
        id: createId(),
        sessionId: createId(),
        exerciseId: exercise.id,
        startedAt: '2026-01-02T10:00:00.000Z',
        durationSeconds: 60,
        bpm: 90,
        cleanRepetitions: 1,
        result: 'clean',
      },
      {
        id: createId(),
        sessionId: createId(),
        exerciseId: exercise.id,
        startedAt: '2026-01-01T10:00:00.000Z',
        durationSeconds: 30,
        cleanRepetitions: 0,
        result: 'skipped',
      },
    ]

    const csv = buildJournalCsv(entries, [exercise])
    const lines = csv.split('\r\n')

    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('תאריך,שם תרגיל,קטגוריה,BPM,תוצאה,משך (שניות),הערה')
    // Sorted chronologically: the 2026-01-01 entry comes before 2026-01-02.
    expect(lines[1]).toContain('דילוג')
    expect(lines[2]).toContain('נקי')
  })

  it('quotes fields containing commas', () => {
    const exercise = makeExercise({ name: 'תרגיל, עם פסיק' })
    const entries: PracticeEntry[] = [
      {
        id: createId(),
        sessionId: createId(),
        exerciseId: exercise.id,
        startedAt: new Date().toISOString(),
        durationSeconds: 60,
        cleanRepetitions: 1,
        result: 'clean',
      },
    ]

    const csv = buildJournalCsv(entries, [exercise])
    expect(csv).toContain('"תרגיל, עם פסיק"')
  })

  it('returns just the header for no entries', () => {
    expect(buildJournalCsv([], [])).toBe(
      'תאריך,שם תרגיל,קטגוריה,BPM,תוצאה,משך (שניות),הערה',
    )
  })
})
