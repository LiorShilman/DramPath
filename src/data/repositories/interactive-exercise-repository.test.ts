import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { interactiveExerciseRepository } from './interactive-exercise-repository'
import { createId } from '../../domain'
import type { InteractiveExercise } from '../../domain'

afterEach(async () => {
  await db.interactiveExercises.clear()
})

function buildInput(): Omit<InteractiveExercise, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: 'תרגיל שלי',
    difficulty: 'beginner',
    bpm: 90,
    minBpm: 60,
    maxBpm: 140,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'eighth',
    bars: 1,
    loopCount: 2,
    displayMode: 'note_highway',
    events: [
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ],
  }
}

describe('interactiveExerciseRepository', () => {
  it('creates and retrieves a custom exercise', async () => {
    const created = await interactiveExerciseRepository.create(buildInput())

    expect(created.id).toBeTruthy()
    expect(created.title).toBe('תרגיל שלי')
    expect(await interactiveExerciseRepository.getById(created.id)).toEqual(created)
  })

  it('lists all created exercises', async () => {
    await interactiveExerciseRepository.create(buildInput())
    await interactiveExerciseRepository.create({ ...buildInput(), title: 'תרגיל שני' })

    const all = await interactiveExerciseRepository.getAll()
    expect(all).toHaveLength(2)
  })

  it('removes an exercise', async () => {
    const created = await interactiveExerciseRepository.create(buildInput())
    await interactiveExerciseRepository.remove(created.id)
    expect(await interactiveExerciseRepository.getById(created.id)).toBeUndefined()
  })
})
