import { db } from '../db'
import { practiceSessionSchema, type PracticeSession, type PracticeEntry } from '../../domain'
import { createTimestampedRepository } from './base-repository'

const base = createTimestampedRepository<PracticeSession>(
  db.practiceSessions,
  practiceSessionSchema,
)

export type SessionWithEntries = PracticeSession & { entries: PracticeEntry[] }

export const practiceSessionRepository = {
  ...base,
  // ADR 0002: entries live in the separate practiceEntries store; compose on read.
  async getSessionWithEntries(id: string): Promise<SessionWithEntries | undefined> {
    const session = await base.getById(id)
    if (!session) return undefined
    const entries = await db.practiceEntries
      .where('sessionId')
      .equals(id)
      .toArray()
    return { ...session, entries }
  },
  // Journal delete: a session's PracticeEntry rows have no meaning without
  // it, so removing a session removes its entries too.
  async removeWithEntries(id: string): Promise<void> {
    await db.transaction('rw', db.practiceSessions, db.practiceEntries, async () => {
      await db.practiceEntries.where('sessionId').equals(id).delete()
      await base.remove(id)
    })
  },
}
