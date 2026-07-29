import { db } from '../db'
import { weekSchema, type Week } from '../../domain'
import { createTimestampedRepository } from './base-repository'

const base = createTimestampedRepository<Week>(db.weeks, weekSchema)

export const weekRepository = {
  ...base,
  // Only one week per course should be `active` at a time (the dashboard
  // picks `weeks.find(w => status === 'active')`). Activating a week marks
  // earlier-order weeks in the same course `completed` and later ones
  // `locked`, so the invariant always holds.
  async activateWeek(weekId: string): Promise<Week> {
    const target = await base.getById(weekId)
    if (!target) {
      throw new Error(`Week ${weekId} not found`)
    }

    const courseWeeks = (await base.getAll()).filter(
      (week) => week.coursePlanId === target.coursePlanId,
    )

    await db.transaction('rw', db.weeks, async () => {
      await Promise.all(
        courseWeeks.map((week) => {
          if (week.id === target.id) {
            return base.patch(week.id, { status: 'active' })
          }
          if (week.order < target.order) {
            return week.status === 'completed'
              ? Promise.resolve(week)
              : base.patch(week.id, { status: 'completed' })
          }
          return week.status === 'locked'
            ? Promise.resolve(week)
            : base.patch(week.id, { status: 'locked' })
        }),
      )
    })

    const updated = await base.getById(weekId)
    if (!updated) {
      throw new Error(`Week ${weekId} not found after activation`)
    }
    return updated
  },
}
