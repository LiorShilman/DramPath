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
