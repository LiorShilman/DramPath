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

    this.version(1).stores({
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
    })
  }
}
