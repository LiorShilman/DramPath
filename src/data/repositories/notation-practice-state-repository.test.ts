import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { notationPracticeStateRepository } from './notation-practice-state-repository'
import { createId } from '../../domain'

afterEach(async () => {
  await db.notationPracticeState.clear()
})

describe('notationPracticeStateRepository', () => {
  it('returns undefined for a resource with no saved state', async () => {
    expect(await notationPracticeStateRepository.getForResource(createId())).toBeUndefined()
  })

  it('saves and retrieves the last BPM for a resource', async () => {
    const resourceId = createId()
    await notationPracticeStateRepository.saveBpm(resourceId, 110)

    const state = await notationPracticeStateRepository.getForResource(resourceId)
    expect(state?.lastBpm).toBe(110)
  })

  it('overwrites the previous BPM on a second save for the same resource', async () => {
    const resourceId = createId()
    await notationPracticeStateRepository.saveBpm(resourceId, 90)
    await notationPracticeStateRepository.saveBpm(resourceId, 140)

    expect(await db.notationPracticeState.count()).toBe(1)
    const state = await notationPracticeStateRepository.getForResource(resourceId)
    expect(state?.lastBpm).toBe(140)
  })
})
