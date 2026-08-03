import { db } from '../db'
import { drumImportMetadataSchema, type DrumImportMetadata } from '../../domain'
import { createRepository } from './base-repository'

// Write-once provenance rows (ADR 0006) — plain createRepository, no
// patch() needed since nothing ever edits an approved import's record.
export const drumImportMetadataRepository = createRepository<DrumImportMetadata>(
  db.drumImportMetadata,
  drumImportMetadataSchema,
)
