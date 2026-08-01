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
    // The v6 migration (separately tested below) also runs here and
    // backfills the other 31 lessons it doesn't find yet — this test only
    // cares about the original lesson's tags surviving the v1→v2 upgrade.
    const originalLesson = lessons.find((lesson) => lesson.order === 1)
    expect(originalLesson?.tags).toEqual([])
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

  it('replaces placeholder lesson content with the real curriculum while preserving user state, and adds lessons 31/32', async () => {
    const dbName = `drumpath-test-migration-${createId()}`

    const legacyDb = new Dexie(dbName)
    legacyDb.version(5).stores({
      weeks: 'id, coursePlanId, order, status',
      lessons: 'id, weekId, order, category, status, updatedAt',
    })
    await legacyDb.open()
    const weekId = createId()
    await legacyDb.table('weeks').add({
      id: weekId,
      coursePlanId: createId(),
      order: 2,
      title: 'שבוע 2',
      focus: 'טכניקה עם מטרונום',
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    // Lesson 5 falls in week 2's range per WEEK_PLAN — pre-migration it only
    // has the old auto-generated placeholder title and no description, plus
    // real user state (status/notes/tags) that the migration must not touch.
    await legacyDb.table('lessons').add({
      id: createId(),
      order: 5,
      title: 'שיעור 5 — טכניקה עם מטרונום',
      weekId,
      category: 'technique',
      status: 'completed',
      resourceIds: [],
      exerciseIds: [],
      tags: ['technique', 'שלי'],
      notes: 'הערה אישית שלי',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    legacyDb.close()

    const upgraded = new DrumPathDatabase(dbName)
    await upgraded.open()

    const lessons = await upgraded.lessons.toArray()
    const lessonFive = lessons.find((lesson) => lesson.order === 5)
    expect(lessonFive?.title).toBe('טכניקה ברגל על פדל הבס')
    expect(lessonFive?.description).toBe(
      'שתי שיטות לנגינה מהירה, נוחה ויעילה על תוף הבס, לשיפור שליטה וקצב ברגל.',
    )
    // Untouched user state.
    expect(lessonFive?.status).toBe('completed')
    expect(lessonFive?.notes).toBe('הערה אישית שלי')
    expect(lessonFive?.tags).toEqual(['technique', 'שלי'])
    expect(lessonFive?.weekId).toBe(weekId)

    const lesson31 = lessons.find((lesson) => lesson.order === 31)
    const lesson32 = lessons.find((lesson) => lesson.order === 32)
    expect(lesson31?.title).toBe('זיהוי מקצבים בשירים ונגינה איתם')
    expect(lesson32?.title).toBe('סיכום הקורס')
    expect(lesson31?.status).toBe('not_started')

    upgraded.close()
    await Dexie.delete(dbName)
  })
})
