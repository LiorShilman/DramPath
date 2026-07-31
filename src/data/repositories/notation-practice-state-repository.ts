import { db } from '../db'
import { notationPracticeStateSchema, nowIso, type NotationPracticeState } from '../../domain'
import { createRepository } from './base-repository'

const base = createRepository<NotationPracticeState>(db.notationPracticeState, notationPracticeStateSchema)

export const notationPracticeStateRepository = {
  ...base,
  async getForResource(resourceId: string): Promise<NotationPracticeState | undefined> {
    return base.getById(resourceId)
  },
  // put-semantics (not create-then-conflict): re-saving BPM for a resource
  // that already has a row should just overwrite it, one row per song.
  async saveBpm(resourceId: string, lastBpm: number): Promise<NotationPracticeState> {
    return base.update({ id: resourceId, lastBpm, updatedAt: nowIso() })
  },
}
