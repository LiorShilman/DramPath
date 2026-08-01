import { describe, expect, it } from 'vitest'
import { db } from '../db'
import { runSeedIfNeeded } from './seed-runner'

describe('runSeedIfNeeded', () => {
  it('seeds the expected structural data once, then is a no-op', async () => {
    const first = await runSeedIfNeeded()
    expect(first.seeded).toBe(true)

    expect(await db.coursePlans.count()).toBe(1)
    expect(await db.weeks.count()).toBe(12)
    expect(await db.lessons.count()).toBe(32)
    expect(await db.exercises.count()).toBe(65)
    expect(await db.songs.count()).toBe(7)
    expect(await db.interactiveExercises.count()).toBe(1)

    const week1 = await db.weeks.where('order').equals(1).first()
    expect(week1?.status).toBe('active')
    const otherWeeks = await db.weeks.where('order').above(1).toArray()
    expect(otherWeeks.every((week) => week.status === 'locked')).toBe(true)

    const second = await runSeedIfNeeded()
    expect(second.seeded).toBe(false)

    expect(await db.coursePlans.count()).toBe(1)
    expect(await db.weeks.count()).toBe(12)
    expect(await db.lessons.count()).toBe(32)
  })
})
