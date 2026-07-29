import { z } from 'zod'

// ADR 0001: timestamps are stored as ISO 8601 strings, not Date objects.
export const isoDateTimeSchema = z.iso.datetime()
export const uuidSchema = z.uuid()

export function createId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
