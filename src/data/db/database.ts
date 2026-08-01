import Dexie, { type EntityTable } from 'dexie'
import type { CoursePlan } from '../../domain/course-plan'
import type { Week } from '../../domain/week'
import type { Lesson } from '../../domain/lesson'
import type { Exercise } from '../../domain/exercise'
import type { Song } from '../../domain/song'
import type { Resource } from '../../domain/resource'
import type { PracticeSession } from '../../domain/practice-session'
import type { PracticeEntry } from '../../domain/practice-entry'
import type { Achievement } from '../../domain/achievement'
import type { UserSettings } from '../../domain/user-settings'
import type { NotationPracticeState } from '../../domain/notation-practice-state'
import type { InteractiveExercise } from '../../domain/interactive-exercise'
import { buildLessonSeed } from '../seed/course-seed'

// ADR 0003: lessonExercises is a derived join table maintained by
// lesson-repository, alongside Lesson.exerciseIds (source of truth).
export interface LessonExerciseLink {
  lessonId: string
  exerciseId: string
}

export class DrumPathDatabase extends Dexie {
  coursePlans!: EntityTable<CoursePlan, 'id'>
  weeks!: EntityTable<Week, 'id'>
  lessons!: EntityTable<Lesson, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  lessonExercises!: Dexie.Table<LessonExerciseLink, [string, string]>
  songs!: EntityTable<Song, 'id'>
  resources!: EntityTable<Resource, 'id'>
  practiceSessions!: EntityTable<PracticeSession, 'id'>
  practiceEntries!: EntityTable<PracticeEntry, 'id'>
  // ADR 0004: singleton settings row, primary key 'key' = 'user-settings'.
  settings!: EntityTable<UserSettings, 'key'>
  achievements!: EntityTable<Achievement, 'id'>
  // Free Notation Practice's "remember the last BPM used per song" — id is
  // the notation Resource's own id, one row per uploaded song.
  notationPracticeState!: EntityTable<NotationPracticeState, 'id'>
  // User-created graded exercises from the manual builder — same shape as
  // the hardcoded DEMO_EXERCISES, just persisted.
  interactiveExercises!: EntityTable<InteractiveExercise, 'id'>

  constructor(name = 'drumpath') {
    super(name)

    const storesV1 = {
      coursePlans: 'id, name, isActive, updatedAt',
      weeks: 'id, coursePlanId, order, status',
      lessons: 'id, weekId, order, category, status, updatedAt',
      exercises: 'id, category, difficulty, isArchived, updatedAt',
      lessonExercises: '[lessonId+exerciseId], lessonId, exerciseId',
      songs: 'id, artist, title, status, updatedAt',
      resources: 'id, checksum, mimeType, createdAt',
      practiceSessions: 'id, startedAt, endedAt, status, weekId',
      practiceEntries: 'id, sessionId, exerciseId, result, bpm, startedAt',
      settings: 'key',
      achievements: 'id, type, achievedAt',
    }

    this.version(1).stores(storesV1)

    // §14's Lesson.tags was added retroactively (ADR 0001-era decision),
    // after real local databases had already persisted lessons created
    // before that point. Zod validates on write, not on read, so a lesson
    // missing `tags` sat silently valid-looking until something re-saved
    // the full record (e.g. patch()'s read-merge-revalidate-write), which
    // then threw a ZodError out of nowhere. Same defensive backfill for
    // Exercise.tags, which has always been required but costs nothing to
    // guard here too. Index definitions are unchanged from v1 — Dexie
    // still requires repeating them for any table kept in a later version.
    this.version(2)
      .stores(storesV1)
      .upgrade(async (tx) => {
        await tx
          .table('lessons')
          .toCollection()
          .modify((lesson) => {
            if (!Array.isArray(lesson.tags)) lesson.tags = []
          })
        await tx
          .table('exercises')
          .toCollection()
          .modify((exercise) => {
            if (!Array.isArray(exercise.tags)) exercise.tags = []
          })
      })

    // Free Notation Practice's remembered-BPM-per-song — a new table, no
    // upgrade/backfill needed.
    this.version(3).stores({
      ...storesV1,
      notationPracticeState: 'id',
    })

    // The manual exercise builder's persisted exercises — another new
    // table, no upgrade/backfill needed.
    this.version(4).stores({
      ...storesV1,
      notationPracticeState: 'id',
      interactiveExercises: 'id, difficulty, updatedAt',
    })

    // ExerciseBuilderPage's save always hardcoded loopCount: 2, even though
    // it never exposed loop configuration and the grid/notation
    // preview/NoteHighway only ever show a single playthrough — every
    // builder-made exercise silently looped twice, so a correct hit only
    // counted for half its expected score. Every row in this table was
    // created by the builder (the built-in demo catalog stays in-memory,
    // never persisted here), so it's safe to force loopCount back to 1 for
    // all of them, not just newly-saved ones.
    this.version(5)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('interactiveExercises')
          .toCollection()
          .modify((exercise) => {
            exercise.loopCount = 1
          })
      })

    // The course's 30 lessons were always structural placeholders
    // (course-seed.ts's WEEK_PLAN generated titles like "שיעור 12 — ...",
    // no real description) — the real curriculum has 32 lessons, each with
    // a real title/description. buildLessonSeed() is the single source of
    // truth for that content (also used by seed-runner.ts for fresh
    // installs), reused here so this migration can't drift from it. Only
    // title/description are overwritten on lessons that already exist —
    // status/notes/tags/resourceIds/exerciseIds/weekId are live user state
    // and must survive untouched. Lessons 31/32 are new to every existing
    // install, so those get inserted in full.
    this.version(6)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        const seedLessons = buildLessonSeed()
        const weeks = await tx.table('weeks').toArray()
        const weekIdByOrder = new Map(weeks.map((week) => [week.order, week.id]))
        const now = new Date().toISOString()

        for (const seedLesson of seedLessons) {
          const existing = await tx.table('lessons').where('order').equals(seedLesson.order).first()
          if (existing) {
            await tx.table('lessons').update(existing.id, {
              title: seedLesson.title,
              description: seedLesson.description,
            })
          } else {
            await tx.table('lessons').add({
              id: crypto.randomUUID(),
              order: seedLesson.order,
              title: seedLesson.title,
              description: seedLesson.description,
              weekId: weekIdByOrder.get(seedLesson.weekOrder),
              category: seedLesson.category,
              status: seedLesson.status,
              resourceIds: seedLesson.resourceIds,
              exerciseIds: seedLesson.exerciseIds,
              tags: seedLesson.tags,
              createdAt: now,
              updatedAt: now,
            })
          }
        }
      })
  }
}
