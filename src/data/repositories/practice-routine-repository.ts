import { db } from '../db'
import { practiceRoutineSchema, type PracticeRoutine } from '../../domain'
import { createTimestampedRepository } from './base-repository'

export const practiceRoutineRepository = createTimestampedRepository<PracticeRoutine>(db.practiceRoutines, practiceRoutineSchema)
