import { describe, expect, it } from 'vitest'
import { DrumPathDatabase } from './database'

describe('DrumPathDatabase', () => {
  it('opens at version 1 with the expected stores', async () => {
    const database = new DrumPathDatabase('drumpath-test-schema')
    await database.open()

    const tableNames = database.tables.map((table) => table.name).sort()
    expect(tableNames).toEqual(
      [
        'achievements',
        'coursePlans',
        'exercises',
        'lessonExercises',
        'lessons',
        'practiceEntries',
        'practiceSessions',
        'resources',
        'settings',
        'songs',
        'weeks',
      ].sort(),
    )

    database.close()
  })
})
