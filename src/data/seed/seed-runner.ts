import { db } from '../db'
import {
  coursePlanRepository,
  weekRepository,
  lessonRepository,
  exerciseRepository,
  songRepository,
} from '../repositories'
import { buildWeekSeed, buildLessonSeed } from './course-seed'
import { buildExerciseSeed } from './exercise-seed'
import { buildSongSeed } from './song-seed'

export interface SeedResult {
  seeded: boolean
}

// Idempotent: if a CoursePlan already exists, seeding already happened and
// this is a no-op (SPEC §34.2 "ייבוא Seed Data פעם אחת בלבד").
export async function runSeedIfNeeded(): Promise<SeedResult> {
  const existingPlanCount = await db.coursePlans.count()
  if (existingPlanCount > 0) {
    return { seeded: false }
  }

  const coursePlan = await coursePlanRepository.create({
    name: 'מסלול 12 השבועות',
    isActive: true,
  })

  const weekIdByOrder = new Map<number, string>()
  for (const weekInput of buildWeekSeed()) {
    const week = await weekRepository.create({
      coursePlanId: coursePlan.id,
      order: weekInput.order,
      title: weekInput.title,
      focus: weekInput.focus,
      status: weekInput.status,
    })
    weekIdByOrder.set(weekInput.order, week.id)
  }

  for (const lessonInput of buildLessonSeed()) {
    const weekId = weekIdByOrder.get(lessonInput.weekOrder)
    await lessonRepository.create({
      order: lessonInput.order,
      title: lessonInput.title,
      description: lessonInput.description,
      weekId,
      category: lessonInput.category,
      status: lessonInput.status,
      resourceIds: lessonInput.resourceIds,
      exerciseIds: lessonInput.exerciseIds,
      tags: lessonInput.tags,
    })
  }

  for (const exerciseInput of buildExerciseSeed()) {
    await exerciseRepository.create(exerciseInput)
  }

  for (const songInput of buildSongSeed()) {
    await songRepository.create(songInput)
  }

  return { seeded: true }
}
