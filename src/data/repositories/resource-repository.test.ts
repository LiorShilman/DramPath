import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { resourceRepository } from './resource-repository'
import { lessonRepository } from './lesson-repository'
import { exerciseRepository } from './exercise-repository'

afterEach(async () => {
  await db.resources.clear()
  await db.lessons.clear()
  await db.exercises.clear()
  await db.lessonExercises.clear()
})

async function makeResource(content: string) {
  return resourceRepository.save({
    fileName: `${content}.txt`,
    mimeType: 'text/plain',
    blob: new Blob([content], { type: 'text/plain' }),
  })
}

describe('resourceRepository', () => {
  it('saves a Blob and dedupes identical content by checksum', async () => {
    const blob = new Blob(['hello drumpath'], { type: 'text/plain' })

    const first = await resourceRepository.save({
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      blob,
    })

    expect(first.checksum).toHaveLength(64)
    expect(first.sizeBytes).toBe(blob.size)
    expect(await db.resources.count()).toBe(1)

    const duplicate = await resourceRepository.save({
      fileName: 'notes-copy.txt',
      mimeType: 'text/plain',
      blob: new Blob(['hello drumpath'], { type: 'text/plain' }),
    })

    expect(duplicate.id).toBe(first.id)
    expect(await db.resources.count()).toBe(1)

    // Note: jsdom's Blob doesn't survive fake-indexeddb's structuredClone
    // round-trip (a test-environment gap, not a real-browser IndexedDB
    // limitation), so we assert on the metadata instead of the blob object.
    const stored = await resourceRepository.getById(first.id)
    expect(stored?.fileName).toBe('notes.txt')
    expect(stored?.checksum).toBe(first.checksum)
  })

  it('updates tags on an existing resource', async () => {
    const resource = await makeResource('tag-me')
    const updated = await resourceRepository.updateTags(resource.id, ['תווים', 'שבוע 1'])
    expect(updated.tags).toEqual(['תווים', 'שבוע 1'])
  })

  it('saves a link resource with no blob/checksum', async () => {
    // A real FileSystemFileHandle is a native, structured-clone-safe host
    // object. A plain object literal with a `getFile` function property is
    // NOT clone-safe (functions can never survive structured clone, in any
    // environment) and fake-indexeddb enforces that just like a real
    // browser would — so the test double puts getFile on a class prototype
    // instead, where it's non-enumerable and never reaches the cloner.
    class FakeFileHandle {
      kind = 'file'
      name = 'video.mp4'
      async getFile() {
        return new File([], 'video.mp4', { type: 'video/mp4' })
      }
    }
    const fakeHandle = new FakeFileHandle() as unknown as FileSystemFileHandle

    const saved = await resourceRepository.saveLink({
      fileHandle: fakeHandle,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 300_000_000,
    })

    expect(saved.sourceType).toBe('link')
    expect(saved.fileName).toBe('video.mp4')
    expect(saved.blob).toBeUndefined()
    expect(saved.checksum).toBeUndefined()
  })

  // The success path (a real link -> real blob conversion) isn't covered
  // here the way saveLink's own test covers saving: convertLinkToBlob calls
  // getById internally and then calls .getFile() on the round-tripped
  // fileHandle, and a real FileSystemFileHandle is a native host object
  // that a genuine browser's structured-clone knows how to preserve through
  // IndexedDB — fake-indexeddb doesn't replicate that special-cased native
  // behavior (functions in general can't survive structured clone at all,
  // per the existing 'saves a link resource' test's own comment), so a
  // class-prototype test double loses its .getFile method the moment it's
  // fetched back out of the fake DB. This is a test-environment gap, not a
  // production code path — manually verified against the real File System
  // Access API instead.
  it('rejects converting a resource that is already blob-backed', async () => {
    const blobResource = await makeResource('already-blob')
    await expect(resourceRepository.convertLinkToBlob(blobResource.id)).rejects.toThrow(
      'is not a linked resource',
    )
  })

  it('converts a blob resource back into a linked one, keeping the same id', async () => {
    const blobResource = await makeResource('big-video')

    class FakeFileHandle {
      kind = 'file'
      name = 'big-video.mp4'
      async getFile() {
        return new File(['re-picked content'], 'big-video.mp4', { type: 'video/mp4' })
      }
    }
    // Passed directly as an argument (not re-fetched via getById), so this
    // doesn't hit the fake-indexeddb structured-clone/prototype gap
    // documented above — convertBlobToLink never reads fileHandle back out
    // of the DB, unlike convertLinkToBlob.
    const handle = new FakeFileHandle() as unknown as FileSystemFileHandle

    const converted = await resourceRepository.convertBlobToLink(blobResource.id, handle)

    expect(converted.id).toBe(blobResource.id)
    expect(converted.sourceType).toBe('link')
    expect(converted.blob).toBeUndefined()
    expect(converted.checksum).toBeUndefined()
  })

  it('rejects converting to link a resource that is already a link', async () => {
    class FakeFileHandle {
      kind = 'file'
      name = 'video.mp4'
      async getFile() {
        return new File([], 'video.mp4', { type: 'video/mp4' })
      }
    }
    const linked = await resourceRepository.saveLink({
      fileHandle: new FakeFileHandle() as unknown as FileSystemFileHandle,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 300_000_000,
    })

    await expect(
      resourceRepository.convertBlobToLink(linked.id, new FakeFileHandle() as unknown as FileSystemFileHandle),
    ).rejects.toThrow('is not a blob resource')
  })

  it('removes the resource and unlinks it from lessons and exercises', async () => {
    const resource = await makeResource('shared-pdf')

    const lesson = await lessonRepository.create({
      order: 1,
      title: 'שיעור',
      category: 'technique',
      status: 'not_started',
      resourceIds: [resource.id],
      exerciseIds: [],
      tags: [],
    })
    const exercise = await exerciseRepository.create({
      name: 'תרגיל',
      category: 'technique',
      instructions: '',
      startBpm: 60,
      targetBpm: 100,
      minBpm: 40,
      maxBpm: 160,
      durationSeconds: 60,
      repetitionsTarget: 8,
      subdivision: 'quarter',
      difficulty: 2,
      tags: [],
      isArchived: false,
      notationResourceId: resource.id,
    })

    await resourceRepository.removeAndUnlink(resource.id)

    expect(await resourceRepository.getById(resource.id)).toBeUndefined()
    expect((await lessonRepository.getById(lesson.id))?.resourceIds).toEqual([])
    expect((await exerciseRepository.getById(exercise.id))?.notationResourceId).toBeUndefined()
  })
})
