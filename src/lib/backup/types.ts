import type {
  Achievement,
  CoursePlan,
  Exercise,
  Lesson,
  PracticeEntry,
  PracticeSession,
  Resource,
  Song,
  UserSettings,
  Week,
} from '../../domain'

// §27: bump this whenever data.json's shape changes in a way old archives
// can't be read as. Import rejects anything else with a clear message.
export const BACKUP_SCHEMA_VERSION = 1
export const APP_VERSION = '1.0.0'

export interface BackupManifest {
  schemaVersion: number
  createdAt: string
  appVersion: string
  checksums: {
    dataJson: string
    resources: Record<string, string>
  }
}

// The blob itself is a separate zip entry (resources/<id>), not embedded in data.json.
export type ResourceMetadata = Omit<Resource, 'blob'>

export function stripBlob(resource: Resource): ResourceMetadata {
  const meta: ResourceMetadata & { blob?: Blob } = { ...resource }
  delete meta.blob
  return meta
}

export interface BackupData {
  coursePlans: CoursePlan[]
  weeks: Week[]
  lessons: Lesson[]
  exercises: Exercise[]
  songs: Song[]
  resources: ResourceMetadata[]
  practiceSessions: PracticeSession[]
  practiceEntries: PracticeEntry[]
  // At most one row (the singleton, ADR 0004) — kept as an array so every
  // entity collection in a backup shares the same shape.
  settings: UserSettings[]
  achievements: Achievement[]
}
