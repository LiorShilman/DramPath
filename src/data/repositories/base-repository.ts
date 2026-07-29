import type { EntityTable } from 'dexie'
import type { z } from 'zod'
import { createId, nowIso } from '../../domain/shared'

interface HasId {
  id: string
}

// Dexie's EntityTable<T, 'id'> types get()/delete() via IDType<T, 'id'>,
// which doesn't collapse back to plain `string` for a generic T. Since every
// repository here always keys by a plain string id, we operate through this
// narrower structural view instead of fighting that generic inference.
interface IdKeyedTable<T> {
  add: (item: T) => Promise<unknown>
  bulkAdd: (items: T[]) => Promise<unknown>
  get: (id: string) => Promise<T | undefined>
  toArray: () => Promise<T[]>
  put: (item: T) => Promise<unknown>
  delete: (id: string) => Promise<void>
}

export interface Repository<T> {
  add: (item: T) => Promise<T>
  bulkAdd: (items: T[]) => Promise<void>
  getById: (id: string) => Promise<T | undefined>
  getAll: () => Promise<T[]>
  update: (item: T) => Promise<T>
  remove: (id: string) => Promise<void>
}

interface Timestamped extends HasId {
  createdAt: string
  updatedAt: string
}

export interface TimestampedRepository<T extends Timestamped>
  extends Repository<T> {
  create: (input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => Promise<T>
  patch: (
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ) => Promise<T>
}

// Generic CRUD over a Dexie table. Every write is Zod-validated (SPEC §22.3).
// This is the only layer allowed to touch Dexie directly (SPEC §22.5).
export function createRepository<T extends HasId>(
  entityTable: EntityTable<T, 'id'>,
  schema: z.ZodType<T>,
): Repository<T> {
  const table = entityTable as unknown as IdKeyedTable<T>

  return {
    async add(item) {
      const validated = schema.parse(item)
      await table.add(validated)
      return validated
    },
    async bulkAdd(items) {
      const validated = items.map((item) => schema.parse(item))
      await table.bulkAdd(validated)
    },
    async getById(id) {
      return table.get(id)
    },
    async getAll() {
      return table.toArray()
    },
    async update(item) {
      const validated = schema.parse(item)
      await table.put(validated)
      return validated
    },
    async remove(id) {
      await table.delete(id)
    },
  }
}

// Adds create()/patch() timestamp stamping on top of createRepository, for
// entities with id/createdAt/updatedAt fields (SPEC entity tables §14/§15/
// §18/§19/§23 — CoursePlan, Week, Lesson, Exercise, Song, PracticeSession).
export function createTimestampedRepository<T extends Timestamped>(
  table: EntityTable<T, 'id'>,
  schema: z.ZodType<T>,
): TimestampedRepository<T> {
  const base = createRepository(table, schema)

  return {
    ...base,
    async create(input) {
      const now = nowIso()
      const item = { ...input, id: createId(), createdAt: now, updatedAt: now } as T
      return base.add(item)
    },
    async patch(id, patch) {
      const existing = await base.getById(id)
      if (!existing) {
        throw new Error(`Entity ${id} not found`)
      }
      const item = { ...existing, ...patch, updatedAt: nowIso() } as T
      return base.update(item)
    },
  }
}
