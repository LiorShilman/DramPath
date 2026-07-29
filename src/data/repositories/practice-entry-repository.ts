import { db } from '../db'
import { practiceEntrySchema, createId, type PracticeEntry } from '../../domain'
import { createRepository } from './base-repository'

const base = createRepository<PracticeEntry>(
  db.practiceEntries,
  practiceEntrySchema,
)

export const practiceEntryRepository = {
  ...base,
  async create(input: Omit<PracticeEntry, 'id'>) {
    return base.add({ ...input, id: createId() })
  },
  async getBySessionId(sessionId: string): Promise<PracticeEntry[]> {
    return db.practiceEntries.where('sessionId').equals(sessionId).toArray()
  },
  async getByExerciseId(exerciseId: string): Promise<PracticeEntry[]> {
    return db.practiceEntries.where('exerciseId').equals(exerciseId).toArray()
  },
}
