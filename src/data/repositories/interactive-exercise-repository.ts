import { db } from '../db'
import { interactiveExerciseSchema, type InteractiveExercise } from '../../domain'
import { createTimestampedRepository } from './base-repository'

export const interactiveExerciseRepository = createTimestampedRepository<InteractiveExercise>(
  db.interactiveExercises,
  interactiveExerciseSchema,
)
