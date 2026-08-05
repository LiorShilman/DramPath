import { db } from '../db'
import { resourceSchema, resourceObjectSchema, createId, nowIso, type Resource } from '../../domain'
import { sha256Hex } from '../../lib/checksum'
import { createRepository } from './base-repository'
import { lessonRepository } from './lesson-repository'
import { exerciseRepository } from './exercise-repository'

const base = createRepository<Resource>(db.resources, resourceSchema)

export interface SaveResourceInput {
  fileName: string
  mimeType: string
  blob: Blob
  tags?: string[]
}

export interface SaveLinkResourceInput {
  fileHandle: FileSystemFileHandle
  fileName: string
  mimeType: string
  sizeBytes: number
  tags?: string[]
}

export const resourceRepository = {
  ...base,
  // getAll() (via toArray()) deserializes every row — blob content included
  // — simultaneously into one big in-memory array. That's fine for small
  // files, but with several 100MB+ resources (e.g. converted-from-link
  // videos) it's exactly what made the Library list itself slow/prone to
  // hanging the tab, even before anything on the page was clicked. .each()
  // instead visits one row at a time; stripping `blob` immediately (never
  // held past that one callback) keeps peak memory to roughly one row,
  // regardless of how many large resources exist. Use this for any list
  // view — fetch a single resource's real blob on demand (getById) only
  // when it's actually about to be shown/opened.
  async getAllMetadata(): Promise<Resource[]> {
    const results: Resource[] = []
    await db.resources.each((resource) => {
      const metadata: Resource = { ...resource }
      delete metadata.blob
      results.push(metadata)
    })
    return results
  },
  // Dedupes by SHA-256 checksum: re-uploading the same file returns the
  // existing record instead of storing the blob twice (SPEC §20).
  async save(input: SaveResourceInput): Promise<Resource> {
    const checksum = await sha256Hex(input.blob)
    const existing = await db.resources.where('checksum').equals(checksum).first()
    if (existing) return existing

    return base.add({
      id: createId(),
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.blob.size,
      sourceType: 'blob',
      checksum,
      blob: input.blob,
      tags: input.tags ?? [],
      createdAt: nowIso(),
    })
  },
  // No checksum/dedup here — hashing a 200-300MB video just to dedupe on
  // link isn't worth the cost, and unlike save() we never read the full
  // file content up front anyway.
  async saveLink(input: SaveLinkResourceInput): Promise<Resource> {
    return base.add({
      id: createId(),
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sourceType: 'link',
      fileHandle: input.fileHandle,
      tags: input.tags ?? [],
      createdAt: nowIso(),
    })
  },
  // Partial update (not read-full-object -> revalidate -> put): re-validating
  // the untouched `blob` field on every tag edit is unnecessary, and in this
  // test environment (fake-indexeddb under jsdom) a round-tripped Blob isn't
  // actually a Blob instance, which would fail full-schema re-validation
  // even though nothing about the blob changed.
  async updateTags(id: string, tags: string[]): Promise<Resource> {
    const validatedTags = resourceObjectSchema.shape.tags.parse(tags)
    await db.resources.update(id, { tags: validatedTags })
    const updated = await base.getById(id)
    if (!updated) {
      throw new Error(`Resource ${id} not found`)
    }
    return updated
  },
  // Converts a linked resource (FileSystemFileHandle, never included in
  // backups — a file handle can't be serialized across origins/devices) into
  // a blob resource (content stored in IndexedDB itself, backed up normally
  // going forward). Reads the file's current content once and replaces the
  // record in place — same id, so every existing lesson/exercise reference
  // to it keeps working unchanged. Caller must have already confirmed read
  // permission (ensureReadPermission, from a user-gesture handler) — this
  // itself does no permission handling, matching handleOpenLink's existing
  // split of concerns in LibraryPage.
  async convertLinkToBlob(id: string): Promise<Resource> {
    const existing = await base.getById(id)
    if (!existing) {
      throw new Error(`Resource ${id} not found`)
    }
    if (existing.sourceType !== 'link' || !existing.fileHandle) {
      throw new Error(`Resource ${id} is not a linked resource`)
    }
    const file = await existing.fileHandle.getFile()
    const checksum = await sha256Hex(file)
    return base.update({
      id: existing.id,
      fileName: existing.fileName,
      mimeType: existing.mimeType,
      sizeBytes: file.size,
      sourceType: 'blob',
      checksum,
      blob: file,
      tags: existing.tags,
      createdAt: existing.createdAt,
    })
  },
  // Reverse of convertLinkToBlob — swaps a blob resource back to a linked
  // one, dropping its stored content. The original FileSystemFileHandle is
  // never kept around after a forward conversion (there'd be no point —
  // the whole reason to convert was to stop depending on it), so this
  // needs the file re-picked from disk; the caller is responsible for that
  // (a user-gesture file picker) and passes the resulting handle in. Same
  // id, so lesson/exercise references keep working. Exists specifically
  // because a resources table holding many large (100MB+) blobs makes
  // getAll()-based views (the whole Library list) load painfully slowly or
  // hang the tab outright — large linked files were never meant to be
  // copied into IndexedDB in the first place (see saveLink's own comment).
  async convertBlobToLink(id: string, fileHandle: FileSystemFileHandle): Promise<Resource> {
    const existing = await base.getById(id)
    if (!existing) {
      throw new Error(`Resource ${id} not found`)
    }
    if (existing.sourceType !== 'blob') {
      throw new Error(`Resource ${id} is not a blob resource`)
    }
    const file = await fileHandle.getFile()
    return base.update({
      id: existing.id,
      fileName: existing.fileName,
      mimeType: existing.mimeType,
      sizeBytes: file.size,
      sourceType: 'link',
      fileHandle,
      tags: existing.tags,
      createdAt: existing.createdAt,
    })
  },
  // No lessonResources join table exists (unlike ADR 0003's Lesson<->Exercise
  // one) — datasets here are small (a personal local library), so a full
  // table scan to find references is simpler than adding a Dexie migration
  // just for this cleanup.
  async removeAndUnlink(id: string): Promise<void> {
    await db.transaction('rw', db.resources, db.lessons, db.exercises, async () => {
      const lessons = await db.lessons.toArray()
      for (const lesson of lessons) {
        if (lesson.resourceIds.includes(id)) {
          await lessonRepository.patch(lesson.id, {
            resourceIds: lesson.resourceIds.filter((resourceId) => resourceId !== id),
          })
        }
      }

      const exercises = await db.exercises.toArray()
      for (const exercise of exercises) {
        if (exercise.notationResourceId === id) {
          await exerciseRepository.patch(exercise.id, { notationResourceId: undefined })
        }
      }

      await base.remove(id)
    })
  },
}
