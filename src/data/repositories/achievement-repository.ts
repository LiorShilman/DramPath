import { db } from '../db'
import { achievementSchema, createId, type Achievement } from '../../domain'
import { createRepository } from './base-repository'

const base = createRepository<Achievement>(db.achievements, achievementSchema)

export const achievementRepository = {
  ...base,
  async create(input: Omit<Achievement, 'id'>) {
    return base.add({ ...input, id: createId() })
  },
}
