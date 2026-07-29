import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { weekRepository } from './week-repository'
import { createId } from '../../domain'

afterEach(async () => {
  await db.weeks.clear()
})

describe('weekRepository.activateWeek', () => {
  it('keeps exactly one active week, completing earlier and locking later ones', async () => {
    const coursePlanId = createId()
    const base = {
      coursePlanId,
      title: 'שבוע',
      status: 'locked' as const,
    }

    const week1 = await weekRepository.create({ ...base, order: 1 })
    const week2 = await weekRepository.create({ ...base, order: 2 })
    const week3 = await weekRepository.create({ ...base, order: 3 })

    await weekRepository.activateWeek(week2.id)

    expect((await weekRepository.getById(week1.id))?.status).toBe('completed')
    expect((await weekRepository.getById(week2.id))?.status).toBe('active')
    expect((await weekRepository.getById(week3.id))?.status).toBe('locked')

    await weekRepository.activateWeek(week1.id)

    expect((await weekRepository.getById(week1.id))?.status).toBe('active')
    expect((await weekRepository.getById(week2.id))?.status).toBe('locked')
    expect((await weekRepository.getById(week3.id))?.status).toBe('locked')
  })
})
