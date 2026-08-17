import { db } from '../db'
import { practiceRecordingSchema, type PracticeRecording } from '../../domain'
import { createTimestampedRepository } from './base-repository'

export const practiceRecordingRepository = createTimestampedRepository<PracticeRecording>(
  db.practiceRecordings,
  practiceRecordingSchema,
)
