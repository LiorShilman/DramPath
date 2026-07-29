import { db } from '../db'
import { coursePlanSchema, type CoursePlan } from '../../domain'
import { createTimestampedRepository } from './base-repository'

export const coursePlanRepository = createTimestampedRepository<CoursePlan>(
  db.coursePlans,
  coursePlanSchema,
)
