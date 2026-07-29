import JSZip from 'jszip'
import { db } from '../../data/db'
import { sha256Hex } from '../checksum'
import { nowIso } from '../../domain'
import {
  APP_VERSION,
  BACKUP_SCHEMA_VERSION,
  stripBlob,
  type BackupData,
  type BackupManifest,
  type ResourceMetadata,
} from './types'

// §27: export to a ZIP containing manifest.json, data.json and a resources/
// folder — no server involved, everything reads straight from Dexie.
export async function buildBackupArchive(): Promise<Blob> {
  const [
    coursePlans,
    weeks,
    lessons,
    exercises,
    songs,
    resources,
    practiceSessions,
    practiceEntries,
    settings,
    achievements,
  ] = await Promise.all([
    db.coursePlans.toArray(),
    db.weeks.toArray(),
    db.lessons.toArray(),
    db.exercises.toArray(),
    db.songs.toArray(),
    db.resources.toArray(),
    db.practiceSessions.toArray(),
    db.practiceEntries.toArray(),
    db.settings.toArray(),
    db.achievements.toArray(),
  ])

  const resourceMetadata: ResourceMetadata[] = resources.map(stripBlob)

  const data: BackupData = {
    coursePlans,
    weeks,
    lessons,
    exercises,
    songs,
    resources: resourceMetadata,
    practiceSessions,
    practiceEntries,
    settings,
    achievements,
  }

  const dataJsonText = JSON.stringify(data, null, 2)
  const dataJsonChecksum = await sha256Hex(new Blob([dataJsonText]))

  const resourceChecksums: Record<string, string> = {}
  for (const resource of resources) {
    resourceChecksums[resource.id] = resource.checksum
  }

  const manifest: BackupManifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: nowIso(),
    appVersion: APP_VERSION,
    checksums: { dataJson: dataJsonChecksum, resources: resourceChecksums },
  }

  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('data.json', dataJsonText)
  const resourcesFolder = zip.folder('resources')
  for (const resource of resources) {
    resourcesFolder?.file(resource.id, resource.blob)
  }

  return zip.generateAsync({ type: 'blob' })
}
