import { db } from '../db'
import { songSchema, type Song } from '../../domain'
import { createTimestampedRepository } from './base-repository'

export const songRepository = createTimestampedRepository<Song>(
  db.songs,
  songSchema,
)
