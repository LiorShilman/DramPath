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
