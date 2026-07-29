import { afterEach, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { buildBackupArchive } from './export-backup'
import {
  BackupImportError,
  commitImport,
  parseBackupArchive,
  previewImport,
  validateBackupData,
} from './import-backup'
import { exerciseRepository } from '../../data/repositories'
import { createId, nowIso } from '../../domain'
import type { BackupData, BackupManifest } from './types'

async function clearAllTables() {
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
    db.settings.clear(),
    db.achievements.clear(),
  ])
}

afterEach(async () => {
  await clearAllTables()
})

function emptyBackupData(): BackupData {
  return {
    coursePlans: [],
    weeks: [],
    lessons: [],
    exercises: [],
    songs: [],
    resources: [],
    practiceSessions: [],
    practiceEntries: [],
    settings: [],
    achievements: [],
  }
}

function baseManifest(): BackupManifest {
  return {
    schemaVersion: 1,
    createdAt: nowIso(),
    appVersion: '1.0.0',
    checksums: { dataJson: '', resources: {} },
  }
}

describe('backup export/import round trip', () => {
  it('exports and re-imports (replace mode) with matching structural-entity counts', async () => {
    await runSeedIfNeeded()

    const archiveBlob = await buildBackupArchive()
    const file = new File([archiveBlob], 'backup.zip', { type: 'application/zip' })

    const before = {
      coursePlans: await db.coursePlans.count(),
      weeks: await db.weeks.count(),
      lessons: await db.lessons.count(),
      exercises: await db.exercises.count(),
      songs: await db.songs.count(),
    }

    await clearAllTables()

    const parsed = await parseBackupArchive(file)
    const resources = await validateBackupData(parsed)
    await commitImport(parsed.data, resources, 'replace')

    expect(await db.coursePlans.count()).toBe(before.coursePlans)
    expect(await db.weeks.count()).toBe(before.weeks)
    expect(await db.lessons.count()).toBe(before.lessons)
    expect(await db.exercises.count()).toBe(before.exercises)
    expect(await db.songs.count()).toBe(before.songs)
  })

  it('rejects a corrupted archive and leaves the database unchanged', async () => {
    await runSeedIfNeeded()
    const countBefore = await db.coursePlans.count()

    const brokenZip = new JSZip()
    brokenZip.file('manifest.json', 'not valid json {{{')
    brokenZip.file('data.json', '{}')
    const brokenBlob = await brokenZip.generateAsync({ type: 'blob' })
    const file = new File([brokenBlob], 'broken.zip', { type: 'application/zip' })

    await expect(parseBackupArchive(file)).rejects.toBeInstanceOf(BackupImportError)
    expect(await db.coursePlans.count()).toBe(countBefore)
  })

  it('rejects an unsupported schema version with a clear message', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ ...baseManifest(), schemaVersion: 999 }))
    zip.file('data.json', JSON.stringify(emptyBackupData()))
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'future.zip', { type: 'application/zip' })

    await expect(parseBackupArchive(file)).rejects.toThrow(/גרסת גיבוי 999 אינה נתמכת/)
  })

  it('rejects an archive whose resource checksum does not match its content', async () => {
    // Built by hand (not via buildBackupArchive) so the resource's blob is a
    // real Blob throughout — jsdom/fake-indexeddb don't preserve Blob
    // identity through a real Dexie round-trip (documented in Stage 1/3's
    // resource-repository tests), which isn't what this test is checking.
    const data = emptyBackupData()
    data.resources = [
      {
        id: createId(),
        fileName: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
        checksum: 'a'.repeat(64), // deliberately wrong
        tags: [],
        createdAt: nowIso(),
      },
    ]

    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(baseManifest()))
    zip.file('data.json', JSON.stringify(data))
    zip.file(`resources/${data.resources[0]!.id}`, 'actual content')
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'tampered.zip', { type: 'application/zip' })

    const parsed = await parseBackupArchive(file)
    await expect(validateBackupData(parsed)).rejects.toBeInstanceOf(BackupImportError)
  })

  it('resolves merge conflicts by updatedAt and previews the counts first', async () => {
    await runSeedIfNeeded()
    const exercise = (await db.exercises.toArray())[0]!

    const archiveBlob = await buildBackupArchive()
    const file = new File([archiveBlob], 'backup.zip', { type: 'application/zip' })
    const parsed = await parseBackupArchive(file)

    // Simulate a newer local edit made after the backup was taken.
    await exerciseRepository.patch(exercise.id, { name: 'שם מעודכן מקומית' })

    const preview = await previewImport(parsed.data, 'merge')
    expect(preview.counts.exercises?.total).toBe(65)
    expect(preview.counts.exercises?.unchanged).toBeGreaterThan(0)

    const resources = await validateBackupData(parsed)
    await commitImport(parsed.data, resources, 'merge')

    const afterMerge = await exerciseRepository.getById(exercise.id)
    expect(afterMerge?.name).toBe('שם מעודכן מקומית')
  })
})
