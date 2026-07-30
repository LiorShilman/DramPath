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
  }
}
