import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { DrumPathDatabase } from './database'
import { createId, nowIso } from '../../domain'

describe('DrumPathDatabase', () => {
  it('opens with the expected stores', async () => {
    const database = new DrumPathDatabase('drumpath-test-schema')
    await database.open()

    const tableNames = database.tables.map((table) => table.name).sort()
    expect(tableNames).toEqual(
      [
        'achievements',
        'coursePlans',
        'exercises',
        'interactiveExercises',
        'lessonExercises',
        'lessons',
        'notationPracticeState',
        'practiceEntries',
        'practiceSessions',
        'resources',
        'settings',
        'songs',
        'weeks',
      ].sort(),
    )

    database.close()
  })

  it('backfills missing Lesson/Exercise tags when upgrading a v1-only database', async () => {
    // Real-world scenario found via a live ZodError report: a lesson
    // persisted before Lesson.tags became required has no `tags` field at
    // all — Zod only validates on write, so this sits silently until
    // something re-saves the full record. Reproduce that exact shape by
    // writing through a raw Dexie instance that only knows version 1
    // (bypassing this app's own Zod-validated repositories entirely).
    const dbName = `drumpath-test-migration-${createId()}`

    const legacyDb = new Dexie(dbName)
    legacyDb.version(1).stores({
      lessons: 'id, weekId, order, category, status, updatedAt',
      exercises: 'id, category, difficulty, isArchived, updatedAt',
    })
    await legacyDb.open()
    await legacyDb.table('lessons').add({
      id: createId(),
      order: 1,
      title: 'שיעור ישן',
      category: 'technique',
      resourceIds: [],
      exerciseIds: [],
      status: 'not_started',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      // tags intentionally omitted — this is the drift being tested.
    })
    await legacyDb.table('exercises').add({
      id: createId(),
      name: 'תרגיל ישן',
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
      isArchived: false,
      // tags intentionally omitted here too.
    })
    legacyDb.close()

    // Opening the real DrumPathDatabase against the same name runs the
    // registered version(2).upgrade() automatically.
    const upgraded = new DrumPathDatabase(dbName)
    await upgraded.open()

    const lessons = await upgraded.lessons.toArray()
    const exercises = await upgraded.exercises.toArray()
    expect(lessons).toHaveLength(1)
    expect(lessons[0]?.tags).toEqual([])
    expect(exercises[0]?.tags).toEqual([])

    upgraded.close()
    await Dexie.delete(dbName)
  })

  it('backfills loopCount back to 1 for interactiveExercises saved before the builder\'s hardcoded loopCount: 2 was fixed', async () => {
    const dbName = `drumpath-test-migration-${createId()}`

    const legacyDb = new Dexie(dbName)
    legacyDb.version(4).stores({
      interactiveExercises: 'id, difficulty, updatedAt',
    })
    await legacyDb.open()
    await legacyDb.table('interactiveExercises').add({
      id: createId(),
      title: 'תרגיל ישן',
      difficulty: 'beginner',
      bpm: 90,
      minBpm: 60,
      maxBpm: 140,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'eighth',
      bars: 2,
      loopCount: 2,
      displayMode: 'note_highway',
      events: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    legacyDb.close()

    const upgraded = new DrumPathDatabase(dbName)
    await upgraded.open()

    const exercises = await upgraded.interactiveExercises.toArray()
    expect(exercises).toHaveLength(1)
    expect(exercises[0]?.loopCount).toBe(1)

    upgraded.close()
    await Dexie.delete(dbName)
  })
})
