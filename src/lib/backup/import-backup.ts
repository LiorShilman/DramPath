import JSZip from 'jszip'
import type { EntityTable } from 'dexie'
import { db } from '../../data/db'
import { sha256Hex } from '../checksum'
import {
  coursePlanSchema,
  weekSchema,
  lessonSchema,
  exerciseSchema,
  songSchema,
  resourceSchema,
  practiceSessionSchema,
  practiceEntrySchema,
  userSettingsSchema,
  achievementSchema,
  interactiveExerciseSchema,
  notationPracticeStateSchema,
  drumImportMetadataSchema,
  type Resource,
} from '../../domain'
import { BACKUP_SCHEMA_VERSION, stripBlob, type BackupData, type BackupManifest } from './types'

export type ImportMode = 'replace' | 'merge'

export class BackupImportError extends Error {}

export interface ParsedBackup {
  manifest: BackupManifest
  data: BackupData
  zip: JSZip
}

// §27 acceptance criteria: a corrupted file must not change the database,
// and an unsupported schema version must show a clear message — both are
// checked here, before anything is written.
export async function parseBackupArchive(file: File): Promise<ParsedBackup> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new BackupImportError('הקובץ אינו ארכיון ZIP תקין.')
  }

  const manifestFile = zip.file('manifest.json')
  const dataFile = zip.file('data.json')
  if (!manifestFile || !dataFile) {
    throw new BackupImportError('הארכיון אינו קובץ גיבוי תקין (חסרים קבצים נדרשים).')
  }

  let manifest: BackupManifest
  let data: BackupData
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as BackupManifest
    data = JSON.parse(await dataFile.async('string')) as BackupData
  } catch {
    throw new BackupImportError('לא ניתן לקרוא את תוכן הגיבוי — הקובץ פגום.')
  }

  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupImportError(
      `גרסת גיבוי ${manifest.schemaVersion} אינה נתמכת (נתמכת גרסה ${BACKUP_SCHEMA_VERSION} בלבד).`,
    )
  }

  // interactiveExercises/notationPracticeState/drumImportMetadata were added
  // to BackupData after schemaVersion 1 shipped — an archive exported before
  // that simply won't have these keys in its parsed JSON. Defaulting to []
  // here (once, centrally) keeps those older archives importable without
  // every downstream reader needing its own fallback, and without forcing a
  // schema version bump for what's a purely additive, backward-readable change.
  data.interactiveExercises ??= []
  data.notationPracticeState ??= []
  data.drumImportMetadata ??= []

  return { manifest, data, zip }
}

async function loadResourceBlobs(parsed: ParsedBackup): Promise<Map<string, Blob>> {
  const blobs = new Map<string, Blob>()

  for (const meta of parsed.data.resources) {
    const entry = parsed.zip.file(`resources/${meta.id}`)
    if (!entry) {
      throw new BackupImportError(`קובץ חסר בארכיון עבור המשאב "${meta.fileName}".`)
    }
    blobs.set(meta.id, await entry.async('blob'))
  }
  return blobs
}

// Full Zod validation over every entity, plus a checksum re-check per
// resource blob (§27: "אין אובדן Blob בעת גיבוי" — a corrupted archive is
// caught here, not discovered later as missing/garbled files).
export async function validateBackupData(parsed: ParsedBackup): Promise<Resource[]> {
  const { data } = parsed

  try {
    data.coursePlans.forEach((item) => coursePlanSchema.parse(item))
    data.weeks.forEach((item) => weekSchema.parse(item))
    data.lessons.forEach((item) => lessonSchema.parse(item))
    data.exercises.forEach((item) => exerciseSchema.parse(item))
    data.songs.forEach((item) => songSchema.parse(item))
    data.practiceSessions.forEach((item) => practiceSessionSchema.parse(item))
    data.practiceEntries.forEach((item) => practiceEntrySchema.parse(item))
    data.settings.forEach((item) => userSettingsSchema.parse(item))
    data.achievements.forEach((item) => achievementSchema.parse(item))
    data.interactiveExercises.forEach((item) => interactiveExerciseSchema.parse(item))
    data.notationPracticeState.forEach((item) => notationPracticeStateSchema.parse(item))
    data.drumImportMetadata.forEach((item) => drumImportMetadataSchema.parse(item))
  } catch {
    throw new BackupImportError('תוכן הגיבוי אינו תקין (נכשלה ולידציה).')
  }

  const resourceBlobs = await loadResourceBlobs(parsed)
  const resources: Resource[] = []
  for (const meta of data.resources) {
    const blob = resourceBlobs.get(meta.id)
    if (!blob) {
      throw new BackupImportError(`קובץ חסר בארכיון עבור המשאב "${meta.fileName}".`)
    }
    const actualChecksum = await sha256Hex(blob)
    if (actualChecksum !== meta.checksum) {
      throw new BackupImportError(`הארכיון פגום — ה-checksum אינו תואם עבור "${meta.fileName}".`)
    }
    resources.push(resourceSchema.parse({ ...meta, blob }))
  }

  return resources
}

export interface EntityCounts {
  total: number
  new: number
  updated: number
  unchanged: number
}

export interface ImportPreview {
  mode: ImportMode
  counts: Record<string, EntityCounts>
}

function summarize<T extends { id: string; updatedAt?: string }>(
  incoming: T[],
  existing: T[],
): EntityCounts {
  const existingById = new Map(existing.map((item) => [item.id, item]))
  let newCount = 0
  let updatedCount = 0
  let unchangedCount = 0

  for (const item of incoming) {
    const current = existingById.get(item.id)
    if (!current) {
      newCount += 1
    } else if (item.updatedAt && current.updatedAt && item.updatedAt > current.updatedAt) {
      updatedCount += 1
    } else {
      unchangedCount += 1
    }
  }

  return { total: incoming.length, new: newCount, updated: updatedCount, unchanged: unchangedCount }
}

function allNew(items: unknown[]): EntityCounts {
  return { total: items.length, new: items.length, updated: 0, unchanged: 0 }
}

// §27: merge conflicts resolve by updatedAt, but only "after showing a
// Preview" — this builds the counts the Settings UI shows before commitImport runs.
export async function previewImport(data: BackupData, mode: ImportMode): Promise<ImportPreview> {
  if (mode === 'replace') {
    return {
      mode,
      counts: {
        coursePlans: allNew(data.coursePlans),
        weeks: allNew(data.weeks),
        lessons: allNew(data.lessons),
        exercises: allNew(data.exercises),
        songs: allNew(data.songs),
        resources: allNew(data.resources),
        practiceSessions: allNew(data.practiceSessions),
        practiceEntries: allNew(data.practiceEntries),
        achievements: allNew(data.achievements),
        interactiveExercises: allNew(data.interactiveExercises),
        notationPracticeState: allNew(data.notationPracticeState),
        drumImportMetadata: allNew(data.drumImportMetadata),
      },
    }
  }

  const [
    existingCoursePlans,
    existingWeeks,
    existingLessons,
    existingExercises,
    existingSongs,
    existingResources,
    existingSessions,
    existingEntries,
    existingAchievements,
    existingInteractiveExercises,
    existingNotationPracticeState,
    existingDrumImportMetadata,
  ] = await Promise.all([
    db.coursePlans.toArray(),
    db.weeks.toArray(),
    db.lessons.toArray(),
    db.exercises.toArray(),
    db.songs.toArray(),
    db.resources.toArray(),
    db.practiceSessions.toArray(),
    db.practiceEntries.toArray(),
    db.achievements.toArray(),
    db.interactiveExercises.toArray(),
    db.notationPracticeState.toArray(),
    db.drumImportMetadata.toArray(),
  ])

  return {
    mode,
    counts: {
      coursePlans: summarize(data.coursePlans, existingCoursePlans),
      weeks: summarize(data.weeks, existingWeeks),
      lessons: summarize(data.lessons, existingLessons),
      exercises: summarize(data.exercises, existingExercises),
      songs: summarize(data.songs, existingSongs),
      resources: summarize(data.resources, existingResources.map(stripBlob)),
      practiceSessions: summarize(data.practiceSessions, existingSessions),
      practiceEntries: summarize(data.practiceEntries, existingEntries),
      achievements: summarize(data.achievements, existingAchievements),
      interactiveExercises: summarize(data.interactiveExercises, existingInteractiveExercises),
      notationPracticeState: summarize(data.notationPracticeState, existingNotationPracticeState),
      drumImportMetadata: summarize(data.drumImportMetadata, existingDrumImportMetadata),
    },
  }
}

async function upsertTimestamped<T extends { id: string; updatedAt: string }>(
  entityTable: EntityTable<T, 'id'>,
  items: T[],
  mode: ImportMode,
): Promise<void> {
  const table = entityTable as unknown as {
    get: (id: string) => Promise<T | undefined>
    put: (item: T) => Promise<unknown>
    add: (item: T) => Promise<unknown>
  }

  for (const item of items) {
    if (mode === 'replace') {
      await table.add(item)
      continue
    }
    const existing = await table.get(item.id)
    if (!existing || item.updatedAt > existing.updatedAt) {
      await table.put(item)
    }
  }
}

// §27: rollback is just "the whole thing is one Dexie transaction" — every
// write below happens inside it, so a mid-write failure aborts atomically
// with nothing partially applied. Everything must already be validated
// (validateBackupData) before this is called.
export async function commitImport(
  data: BackupData,
  resources: Resource[],
  mode: ImportMode,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.coursePlans,
      db.weeks,
      db.lessons,
      db.exercises,
      db.lessonExercises,
      db.songs,
      db.resources,
      db.practiceSessions,
      db.practiceEntries,
      db.settings,
      db.achievements,
      db.interactiveExercises,
      db.notationPracticeState,
      db.drumImportMetadata,
    ],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.coursePlans.clear(),
          db.weeks.clear(),
          db.lessons.clear(),
          db.exercises.clear(),
          db.lessonExercises.clear(),
          db.songs.clear(),
          db.resources.clear(),
          db.practiceSessions.clear(),
          db.practiceEntries.clear(),
          db.achievements.clear(),
          db.interactiveExercises.clear(),
          db.notationPracticeState.clear(),
          db.drumImportMetadata.clear(),
        ])
      }

      await upsertTimestamped(db.coursePlans, data.coursePlans, mode)
      await upsertTimestamped(db.weeks, data.weeks, mode)
      await upsertTimestamped(db.exercises, data.exercises, mode)
      await upsertTimestamped(db.songs, data.songs, mode)
      await upsertTimestamped(db.practiceSessions, data.practiceSessions, mode)
      await upsertTimestamped(db.interactiveExercises, data.interactiveExercises, mode)
      await upsertTimestamped(db.notationPracticeState, data.notationPracticeState, mode)

      // Lessons go through a manual upsert (not lessonRepository) so this
      // stays inside the single outer transaction, but still re-syncs the
      // lessonExercises join table itself (ADR 0003).
      for (const lesson of data.lessons) {
        const existing = mode === 'merge' ? await db.lessons.get(lesson.id) : undefined
        if (!existing || lesson.updatedAt > existing.updatedAt) {
          await db.lessons.put(lesson)
          await db.lessonExercises.where('lessonId').equals(lesson.id).delete()
          await db.lessonExercises.bulkAdd(
            lesson.exerciseIds.map((exerciseId) => ({ lessonId: lesson.id, exerciseId })),
          )
        }
      }

      // Resources / PracticeEntries / Achievements have no updatedAt — treated
      // as immutable historical facts, so existing rows are never overwritten.
      for (const resource of resources) {
        const existing = mode === 'merge' ? await db.resources.get(resource.id) : undefined
        if (!existing) await db.resources.add(resource)
      }
      for (const entry of data.practiceEntries) {
        const existing = mode === 'merge' ? await db.practiceEntries.get(entry.id) : undefined
        if (!existing) await db.practiceEntries.add(entry)
      }
      for (const achievement of data.achievements) {
        const existing = mode === 'merge' ? await db.achievements.get(achievement.id) : undefined
        if (!existing) await db.achievements.add(achievement)
      }
      // drumImportMetadata has no updatedAt (ADR 0006: immutable provenance
      // record, same treatment as resources/practiceEntries/achievements
      // above) — added if missing, never overwritten.
      for (const metadata of data.drumImportMetadata) {
        const existing = mode === 'merge' ? await db.drumImportMetadata.get(metadata.id) : undefined
        if (!existing) await db.drumImportMetadata.add(metadata)
      }

      const incomingSettings = data.settings[0]
      if (incomingSettings) {
        await db.settings.put(incomingSettings)
      }
    },
  )
}
