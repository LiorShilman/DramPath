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
import { buildInteractiveExerciseSeed } from '../seed/interactive-exercise-seed'

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

    // A real, editable practice exercise (not a hardcoded DEMO_EXERCISES
    // entry, which has no edit path through the UI) — see
    // interactive-exercise-seed.ts for the content and its source. Also
    // used by seed-runner.ts for fresh installs; reused here (rather than
    // duplicated) so this migration can't drift from that seed. Keyed by
    // title for idempotency — Dexie only runs this once per database
    // anyway, but this guards against ever re-inserting a duplicate if the
    // migration is revisited.
    this.version(7)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        const seedExercises = buildInteractiveExerciseSeed()
        const existingExercises = await tx.table('interactiveExercises').toArray()
        const now = new Date().toISOString()

        for (const seedExercise of seedExercises) {
          if (existingExercises.some((exercise) => exercise.title === seedExercise.title)) continue
          await tx.table('interactiveExercises').add({
            id: crypto.randomUUID(),
            ...seedExercise,
            createdAt: now,
            updatedAt: now,
          })
        }
      })

    // Version 7's first transcription of the groove had the kick/snare
    // landing squarely on the beat — wrong; re-reading the source chart
    // with the user showed the noteheads sit to the right of their hi-hat
    // column, i.e. on the "and". interactive-exercise-seed.ts's events are
    // now corrected; this replaces the events on the specific exercise v7
    // already inserted (matched by title) rather than waiting for a fresh
    // install that will never happen for an existing database.
    this.version(8)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        const seedExercises = buildInteractiveExerciseSeed()
        for (const seedExercise of seedExercises) {
          const existing = await tx
            .table('interactiveExercises')
            .filter((exercise) => exercise.title === seedExercise.title)
            .first()
          if (existing) {
            await tx.table('interactiveExercises').update(existing.id, { events: seedExercise.events })
          }
        }
      })

    // The user asked for a clean slate on this specific exercise after a
    // long back-and-forth verifying it (the underlying data was already
    // confirmed correct three independent ways — this isn't a data fix, it
    // removes any doubt by deleting every copy (in case duplicates ever
    // accumulated) and inserting one fresh record with a new id.
    this.version(9)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        const seedExercises = buildInteractiveExerciseSeed()
        const now = new Date().toISOString()

        for (const seedExercise of seedExercises) {
          await tx
            .table('interactiveExercises')
            .filter((exercise) => exercise.title === seedExercise.title)
            .delete()
          await tx.table('interactiveExercises').add({
            id: crypto.randomUUID(),
            ...seedExercise,
            createdAt: now,
            updatedAt: now,
          })
        }
      })

    // The pattern confirmed at v8/v9 (hits only on off-beats) was still
    // wrong — after enumerating all 8 eighth-note slots explicitly with the
    // user, the real pattern mixes on-beat and off-beat hits (kick on beat
    // 1, snare on beat 2, kick on the "and" of beat 2, kick on beat 3,
    // snare on beat 4). interactive-exercise-seed.ts's events are now
    // final; this replaces the events on the exercise (matched by title)
    // one more time.
    this.version(10)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        const seedExercises = buildInteractiveExerciseSeed()
        for (const seedExercise of seedExercises) {
          const existing = await tx
            .table('interactiveExercises')
            .filter((exercise) => exercise.title === seedExercise.title)
            .first()
          if (existing) {
            await tx.table('interactiveExercises').update(existing.id, { events: seedExercise.events })
          }
        }
      })

    // New second exercise — "מילה טובה — Intro/A/B" — added to
    // interactive-exercise-seed.ts. Same insert-if-missing pattern as v7;
    // doesn't touch the already-correct "האהבה שלי" exercise.
    this.version(11)
      .stores({
        ...storesV1,
        notationPracticeState: 'id',
        interactiveExercises: 'id, difficulty, updatedAt',
      })
      .upgrade(async (tx) => {
        const seedExercises = buildInteractiveExerciseSeed()
        const existingExercises = await tx.table('interactiveExercises').toArray()
        const now = new Date().toISOString()

        for (const seedExercise of seedExercises) {
          if (existingExercises.some((exercise) => exercise.title === seedExercise.title)) continue
          await tx.table('interactiveExercises').add({
            id: crypto.randomUUID(),
            ...seedExercise,
            createdAt: now,
            updatedAt: now,
          })
        }
      })
  }
}
